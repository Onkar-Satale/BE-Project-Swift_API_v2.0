"""
Ultra-Low Latency History-Grounded RAG Service with Persistent ChromaDB
Optimizations:
1. In-memory LRU vector cache for sub-millisecond query embedding generation.
2. Fast Tokenization & Hashing.
3. Direct Persistent ChromaDB index querying with tight top-k limits.
4. Persistent resolution episodes (Failure ➔ Diagnosis ➔ Applied Fix ➔ Success).
"""

import os
import re
import json
import hashlib
import functools
from typing import List, Dict, Any, Optional
from datetime import datetime
from app.config.settings import logger

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CHROMA_PERSIST_DIR = os.path.join(BASE_DIR, "chroma_db")
os.makedirs(CHROMA_PERSIST_DIR, exist_ok=True)

EMBEDDING_DIM = 64

@functools.lru_cache(maxsize=2048)
def _hash_token_to_idx(token: str) -> int:
    """Cached fast MD5 modulo index computation."""
    return int(hashlib.md5(token.encode()).hexdigest(), 16) % EMBEDDING_DIM

@functools.lru_cache(maxsize=1024)
def tokenize_cached(text: str) -> tuple:
    """Cached tokenization for endpoint strings and error messages."""
    if not text:
        return ()
    return tuple(t.lower() for t in re.findall(r"[A-Za-z0-9_\-]+", str(text)) if len(t) > 1)

def generate_dense_embedding(
    method: str,
    url: str,
    status: Any,
    error_text: str = "",
    headers_keys: Optional[List[str]] = None
) -> List[float]:
    """
    Generates a normalized dense vector embedding (dim=64) in sub-millisecond time.
    """
    vector = [0.0] * EMBEDDING_DIM
    
    # 1. Method feature
    idx = _hash_token_to_idx(f"method:{str(method).upper()}")
    vector[idx] += 2.0

    # 2. Status code feature & family
    status_str = str(status)
    idx1 = _hash_token_to_idx(f"status:{status_str}")
    idx2 = _hash_token_to_idx(f"status_family:{status_str[:1]}xx")
    vector[idx1] += 2.5
    vector[idx2] += 1.5

    # 3. URL path tokens
    try:
        path = url.split("?")[0].replace("https://", "").replace("http://", "")
        url_tokens = tokenize_cached(path)
        for token in url_tokens:
            token_idx = _hash_token_to_idx(f"url:{token}")
            vector[token_idx] += 1.2
    except Exception:
        pass

    # 4. Error text tokens
    if error_text:
        err_tokens = tokenize_cached(error_text[:200])
        for token in err_tokens[:30]:
            token_idx = _hash_token_to_idx(f"err:{token}")
            vector[token_idx] += 1.0

    # 5. Header keys
    if headers_keys:
        for h in headers_keys:
            token_idx = _hash_token_to_idx(f"hdr:{h.lower()}")
            vector[token_idx] += 0.8

    # Fast L2 norm normalization
    sq_sum = sum(x * x for x in vector)
    if sq_sum > 0:
        inv_norm = 1.0 / (sq_sum ** 0.5)
        return [x * inv_norm for x in vector]
    return vector


class ChromaRAGMemoryStore:
    """
    High-Performance ChromaDB Persistent Vector Store for API Resolution Episodes.
    """
    def __init__(self):
        self.chroma_client = None
        self.collection = None
        self._init_chroma()

    def _init_chroma(self):
        try:
            import chromadb
            from chromadb.config import Settings
            
            self.chroma_client = chromadb.PersistentClient(
                path=CHROMA_PERSIST_DIR,
                settings=Settings(anonymized_telemetry=False)
            )
            self.collection = self.chroma_client.get_or_create_collection(
                name="api_resolution_episodes",
                metadata={"hnsw:space": "cosine"}
            )
            logger.info(f"⚡ ChromaDB connected. Existing episodes: {self.collection.count()}")

            if self.collection.count() == 0:
                self._seed_default_episodes()
        except Exception as e:
            logger.error(f"Failed to initialize ChromaDB: {e}", exc_info=True)

    def _seed_default_episodes(self):
        seed_episodes = [
            {
                "id": "seed_ep_404_comments_typo",
                "method": "GET",
                "url": "https://jsonplaceholder.typicode.com/commentss",
                "failed_status": 404,
                "error_snippet": "Cannot GET /commentss - Endpoint not found (Typo in path)",
                "root_cause_layer": "Server / Business Logic",
                "applied_fix": {
                    "title": "Correct URL Route",
                    "description": "Fixed typo in endpoint URL from /commentss to /comments",
                    "actionPayload": {
                        "type": "set_url",
                        "key": "url",
                        "value": "https://jsonplaceholder.typicode.com/comments"
                    }
                },
                "success_status": 200,
                "success_duration": 340
            },
            {
                "id": "seed_ep_404_comment_typo",
                "method": "GET",
                "url": "https://jsonplaceholder.typicode.com/comment",
                "failed_status": 404,
                "error_snippet": "Cannot GET /comment - Endpoint not found",
                "root_cause_layer": "Server / Business Logic",
                "applied_fix": {
                    "title": "Correct URL Route",
                    "description": "Fixed singular /comment to plural /comments",
                    "actionPayload": {
                        "type": "set_url",
                        "key": "url",
                        "value": "https://jsonplaceholder.typicode.com/comments"
                    }
                },
                "success_status": 200,
                "success_duration": 320
            },
            {
                "id": "seed_ep_401_auth_header",
                "method": "GET",
                "url": "https://api.example.com/protected",
                "failed_status": 401,
                "error_snippet": "Unauthorized: Missing Bearer Token in Authorization header",
                "root_cause_layer": "JWT / Authentication",
                "applied_fix": {
                    "title": "Add Authorization Header",
                    "description": "Configured Bearer authentication token in headers",
                    "actionPayload": {
                        "type": "set_auth",
                        "token": "demo_bearer_token_xyz"
                    }
                },
                "success_status": 200,
                "success_duration": 190
            }
        ]

        for s in seed_episodes:
            self.index_resolution_episode(
                user_id="guest",
                method=s["method"],
                url=s["url"],
                failed_status=s["failed_status"],
                error_snippet=s["error_snippet"],
                root_cause_layer=s["root_cause_layer"],
                applied_fix=s["applied_fix"],
                success_status=s["success_status"],
                success_duration=s["success_duration"],
                custom_id=s["id"]
            )

    def index_resolution_episode(
        self,
        user_id: str,
        method: str,
        url: str,
        failed_status: Any,
        error_snippet: str,
        root_cause_layer: str,
        applied_fix: Dict[str, Any],
        success_status: Any = 200,
        success_duration: int = 0,
        custom_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Stores and indexes a verified resolution episode in persistent ChromaDB.
        """
        episode_id = custom_id or f"ep_{int(datetime.now().timestamp() * 1000)}"
        uid = str(user_id or "guest")

        embedding = generate_dense_embedding(
            method=method,
            url=url,
            status=failed_status,
            error_text=f"{error_snippet} {root_cause_layer}",
            headers_keys=list(applied_fix.keys()) if isinstance(applied_fix, dict) else []
        )

        document_text = f"{method.upper()} {url} -> {failed_status} ({root_cause_layer})"
        
        metadata = {
            "episodeId": episode_id,
            "userId": uid,
            "timestamp": datetime.now().isoformat(),
            "method": method.upper(),
            "url": url,
            "failedStatus": str(failed_status),
            "errorSnippet": str(error_snippet)[:200],
            "rootCauseLayer": root_cause_layer,
            "appliedFixJson": json.dumps(applied_fix),
            "successStatus": str(success_status),
            "successDuration": int(success_duration)
        }

        try:
            if self.collection:
                self.collection.upsert(
                    ids=[episode_id],
                    embeddings=[embedding],
                    documents=[document_text],
                    metadatas=[metadata]
                )
        except Exception as e:
            logger.error(f"Error upserting episode into ChromaDB: {e}", exc_info=True)

        return {
            "episodeId": episode_id,
            "userId": uid,
            "method": method.upper(),
            "url": url,
            "failedStatus": failed_status,
            "errorSnippet": error_snippet,
            "rootCauseLayer": root_cause_layer,
            "appliedFix": applied_fix,
            "successStatus": success_status,
            "successDuration": success_duration
        }

    def retrieve_relevant_episodes(
        self,
        user_id: str,
        method: str,
        url: str,
        status: Any,
        error_text: str = "",
        headers_keys: Optional[List[str]] = None,
        top_k: int = 2,
        min_similarity: float = 0.28
    ) -> List[Dict[str, Any]]:
        """
        Ultra-fast vector similarity search with HNSW Cosine Index in ChromaDB.
        """
        if not self.collection or self.collection.count() == 0:
            return []

        query_embedding = generate_dense_embedding(
            method=method,
            url=url,
            status=status,
            error_text=error_text,
            headers_keys=headers_keys
        )

        try:
            # Query exact top_k directly from Chroma HNSW index
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=min(top_k * 2, self.collection.count()),
                include=["metadatas", "distances"]
            )

            scored = []
            if results and "metadatas" in results and results["metadatas"]:
                metas = results["metadatas"][0]
                distances = results["distances"][0] if "distances" in results and results["distances"] else [0.0] * len(metas)

                current_clean = url.split("?")[0].replace("https://", "").replace("http://", "").lower()
                current_tokens = set(tokenize_cached(current_clean))
                status_str = str(status)

                for meta, dist in zip(metas, distances):
                    # Chroma cosine distance to similarity score
                    sim = max(0.0, min(1.0, 1.0 - (dist / 2.0)))

                    ep_url = meta.get("url", "").split("?")[0].replace("https://", "").replace("http://", "").lower()
                    ep_tokens = set(tokenize_cached(ep_url))

                    # Fast path match boost
                    if ep_url == current_clean:
                        sim = min(1.0, sim + 0.35)
                    elif len(current_tokens.intersection(ep_tokens)) >= 2:
                        sim = min(1.0, sim + 0.25)
                    
                    if str(meta.get("failedStatus")) == status_str:
                        sim = min(1.0, sim + 0.20)

                    try:
                        fix_obj = json.loads(meta.get("appliedFixJson", "{}"))
                    except Exception:
                        fix_obj = {}

                    if sim >= min_similarity:
                        scored.append({
                            "episodeId": meta.get("episodeId"),
                            "timestamp": meta.get("timestamp"),
                            "similarityScore": round(sim, 2),
                            "matchPercentage": int(round(sim * 100)),
                            "endpoint": f"{meta.get('method')} {meta.get('url')}",
                            "failedStatus": meta.get("failedStatus"),
                            "previousError": meta.get("errorSnippet"),
                            "rootCauseLayer": meta.get("rootCauseLayer"),
                            "successfulFixUsed": fix_obj,
                            "resultStatus": meta.get("successStatus"),
                            "resultDuration": meta.get("successDuration")
                        })

                scored.sort(key=lambda x: x["similarityScore"], reverse=True)
                return scored[:top_k]
        except Exception as e:
            logger.error(f"Error querying ChromaDB: {e}", exc_info=True)
            return []

        return []

    def delete_episode(self, user_id: str, episode_id: str) -> bool:
        """
        Deletes a specific resolution episode from ChromaDB by ID.
        """
        if not self.collection:
            return False
        try:
            self.collection.delete(ids=[str(episode_id)])
            logger.info(f"Deleted episode {episode_id} from ChromaDB for user {user_id}")
            return True
        except Exception as e:
            logger.warning(f"ChromaDB episode delete notice for id {episode_id}: {e}")
            return False

    def clear_user_episodes(self, user_id: str) -> bool:
        """
        Purges all indexed episodes belonging to a specific user.
        """
        if not self.collection:
            return False
        try:
            uid = str(user_id or "guest")
            self.collection.delete(where={"userId": uid})
            logger.info(f"Cleared all ChromaDB episodes for user {uid}")
            return True
        except Exception as e:
            logger.warning(f"ChromaDB clear episodes notice for user {user_id}: {e}")
            return False

# Singleton instance of optimized ChromaDB RAG Memory Store
rag_memory_store = ChromaRAGMemoryStore()
