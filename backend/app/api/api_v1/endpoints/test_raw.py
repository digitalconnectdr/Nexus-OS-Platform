from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.api.deps import get_db

router = APIRouter()

@router.get("/raw-test")
async def raw_test(db: AsyncSession = Depends(get_db)):
    """Test endpoint using RAW SQL to bypass SQLAlchemy models"""
    try:
        # Direct SQL query without models
        result = await db.execute(
            text("SELECT id, email, role, tenant_id FROM users_profiles WHERE email = 'jcpenalo@gmail.com'")
        )
        row = result.fetchone()
        
        if row:
            return {
                "success": True,
                "data": {
                    "id": str(row[0]),
                    "email": row[1],
                    "role": row[2],
                    "tenant_id": str(row[3]) if row[3] else None
                }
            }
        else:
            return {"success": False, "error": "User not found"}
            
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }
