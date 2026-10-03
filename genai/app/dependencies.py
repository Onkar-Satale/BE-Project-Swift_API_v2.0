# API Key verification dependency for protecting GenAI microservice endpoints

from fastapi import Header, HTTPException
from app.config.settings import GENAI_API_SECRET, logger

# Verifies incoming x-api-key header against GENAI_API_SECRET
def verify_api_key(x_api_key: str = Header(None)):
    if not GENAI_API_SECRET:
        logger.warning("GENAI_API_SECRET is not set. Service is unprotected!")
    elif x_api_key != GENAI_API_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid or missing x-api-key.")
