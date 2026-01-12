from fastapi import APIRouter

router = APIRouter()

@router.get("/status")
async def auth_status():
    return {"status": "auth module initialized"}
