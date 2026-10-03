"""
Pydantic Data Models & Validation Schemas
Defines structured input payload requirements for AI service endpoints (V1 & V2 + RAG).
"""

from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, Union, List



class BotRequest(BaseModel):
    """Payload schema for interactive developer assistant chatbot requests."""
    userId: Optional[str] = "guest"
    message: str
    currentApiContext: Optional[Dict[str, Any]] = None
    requestHistory: Optional[list] = Field(default_factory=list)

class FailureAssistRequest(BaseModel):
    """Payload schema for the Automatic AI Failure Assistant & Auto-Fix workflow."""
    userId: Optional[str] = "guest"
    method: str
    url: str
    headers: Dict[str, Any] = Field(default_factory=dict)
    params: Optional[Union[Dict, list, Any]] = None
    body: Optional[Union[Dict, list, str, Any]] = None
    status: Union[int, str] = Field(default=500)
    response: Optional[Union[Dict, list, str, Any]] = None
    duration: Optional[int] = 0
    previousAttempts: Optional[List[Dict[str, Any]]] = Field(default_factory=list)

class CompareRequest(BaseModel):
    """Payload schema for comparing two execution history capsules."""
    attemptA: Dict[str, Any]
    attemptB: Dict[str, Any]

class IndexEpisodeRequest(BaseModel):
    """Payload schema for recording a verified resolution episode (Failure -> Diagnosis -> Fix -> Success)."""
    userId: Optional[str] = "guest"
    method: str
    url: str
    failedStatus: Union[int, str] = 500
    errorSnippet: Optional[str] = ""
    rootCauseLayer: Optional[str] = "General"
    appliedFix: Optional[Dict[str, Any]] = Field(default_factory=dict)
    successStatus: Union[int, str] = 200
    successDuration: Optional[int] = 0
    customId: Optional[str] = None

class RetrieveEpisodesRequest(BaseModel):
    """Payload schema for retrieving grounded past historical episodes via RAG."""
    userId: Optional[str] = "guest"
    method: str
    url: str
    status: Union[int, str] = 500
    errorText: Optional[str] = ""
    headersKeys: Optional[List[str]] = Field(default_factory=list)
    topK: Optional[int] = 2

class DeleteEpisodeRequest(BaseModel):
    """Payload schema for deleting a specific episode from ChromaDB."""
    userId: Optional[str] = "guest"
    episodeId: str

class ClearUserMemoryRequest(BaseModel):
    """Payload schema for purging all vector memory of a user."""
    userId: str