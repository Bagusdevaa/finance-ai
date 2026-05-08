"""Health check endpoint untuk load balancer / uptime monitor."""

from fastapi import APIRouter


router = APIRouter()


@router.get("/health", tags=["health"])
async def health() -> dict[str, str]:
	return {"status": "ok"}
