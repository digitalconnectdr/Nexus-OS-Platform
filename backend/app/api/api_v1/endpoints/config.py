from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def get_config():
    return {"message": "Config module initialized"}
