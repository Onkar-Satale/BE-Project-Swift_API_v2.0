"""
AI Service Router (/bot, /failure-assist, /compare, /rag/index-episode, /rag/retrieve)
Provides endpoints for API analysis, debugging, auto-fix, RAG memory indexing, and retrieval.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from app.config.settings import logger
from app.dependencies import verify_api_key
from app.schemas.request import (
    BotRequest,
    FailureAssistRequest,
    CompareRequest,
    IndexEpisodeRequest,
    RetrieveEpisodesRequest,
    DeleteEpisodeRequest,
    ClearUserMemoryRequest
)
from app.services.llm_service import (
    generate_bot_response,
    generate_failure_diagnosis,
    generate_history_comparison,
)
from app.services.rag_service import rag_memory_store

router = APIRouter(dependencies=[Depends(verify_api_key)])

@router.post("/bot")
async def bot_api(request: Request, req_data: BotRequest):
    """Processes interactive developer chatbot prompts using contextual API execution history (V1)."""
    logger.info(f"Incoming /bot request for user: {req_data.userId}")
    try:
        result = await generate_bot_response(req_data)
        return result
    except Exception as e:
        logger.error(f"Error executing bot route: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while processing the chat bot request."
        )

@router.post("/failure-assist")
async def failure_assist_api(request: Request, req_data: FailureAssistRequest):
    """History-Grounded RAG failure diagnosis, root-cause prediction, and confirmed auto-fix (V2)."""
    logger.info(f"Incoming /failure-assist request for status: {req_data.status} on URL: {req_data.url}")
    try:
        result = await generate_failure_diagnosis(req_data)
        return result
    except Exception as e:
        logger.error(f"Error in failure assist route: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred during failure diagnosis."
        )

@router.post("/compare")
async def compare_history_api(request: Request, req_data: CompareRequest):
    """Side-by-side execution comparison and historical divergence explanation (V2)."""
    logger.info(f"Incoming /compare request between attempts")
    try:
        result = await generate_history_comparison(req_data)
        return result
    except Exception as e:
        logger.error(f"Error in compare history route: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred during history comparison."
        )

# ============================================================================
# 🔹 RAG ENDPOINTS: INDEX RESOLUTION EPISODE & RETRIEVE MEMORY
# ============================================================================

@router.post("/rag/index-episode")
async def index_episode_api(request: Request, req_data: IndexEpisodeRequest):
    """
    Indexes a verified resolution episode (Failure -> Diagnosis -> Fix -> Success)
    into the user's persistent RAG memory store.
    """
    logger.info(f"Indexing RAG episode for user {req_data.userId}: {req_data.method} {req_data.url}")
    try:
        episode = rag_memory_store.index_resolution_episode(
            user_id=req_data.userId or "guest",
            method=req_data.method,
            url=req_data.url,
            failed_status=req_data.failedStatus,
            error_snippet=req_data.errorSnippet or "",
            root_cause_layer=req_data.rootCauseLayer or "General",
            applied_fix=req_data.appliedFix or {},
            success_status=req_data.successStatus,
            success_duration=req_data.successDuration or 0,
            custom_id=req_data.customId
        )
        return {"success": True, "indexedEpisode": episode}
    except Exception as e:
        logger.error(f"Error indexing RAG episode: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to index resolution episode.")

@router.post("/rag/retrieve")
async def retrieve_episodes_api(request: Request, req_data: RetrieveEpisodesRequest):
    """
    Retrieves top-k similar historical resolution episodes via vector search + metadata filters.
    """
    logger.info(f"Retrieving RAG episodes for user {req_data.userId}: {req_data.method} {req_data.url}")
    try:
        episodes = rag_memory_store.retrieve_relevant_episodes(
            user_id=req_data.userId or "guest",
            method=req_data.method,
            url=req_data.url,
            status=req_data.status,
            error_text=req_data.errorText or "",
            headers_keys=req_data.headersKeys or [],
            top_k=req_data.topK or 2
        )
        return {"success": True, "episodes": episodes}
    except Exception as e:
        logger.error(f"Error retrieving RAG episodes: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve resolution episodes.")

@router.post("/rag/delete-episode")
async def delete_episode_api(request: Request, req_data: DeleteEpisodeRequest):
    """Deletes a specific episode from ChromaDB vector memory."""
    logger.info(f"Deleting ChromaDB episode {req_data.episodeId} for user {req_data.userId}")
    success = rag_memory_store.delete_episode(req_data.userId, req_data.episodeId)
    return {"success": success, "episodeId": req_data.episodeId}

@router.post("/rag/clear-user-memory")
async def clear_user_memory_api(request: Request, req_data: ClearUserMemoryRequest):
    """Purges all vector memory for a user from ChromaDB."""
    logger.info(f"Clearing all ChromaDB episodes for user {req_data.userId}")
    success = rag_memory_store.clear_user_episodes(req_data.userId)
    return {"success": success, "userId": req_data.userId}