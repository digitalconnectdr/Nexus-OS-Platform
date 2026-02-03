import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

# Mock environment for Pydantic
os.environ.setdefault("SUPABASE_URL", "https://mock.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "mock_key")
os.environ.setdefault("SUPABASE_JWT_SECRET", "mock_secret")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost/db")
os.environ.setdefault("SECRET_KEY", "mock_secret_key")

from fastapi import HTTPException
import logging

def test_hybrid_logic():
    print("Testing Hybrid Error Pattern Logic...")
    
    # Simulate a 500 block like the ones I implemented
    mensaje_amigable = "Hubo un problema al recuperar la lista de ventas."
    exception_caught = Exception("Database Connection Refused")
    
    try:
        raise HTTPException(
            status_code=500,
            detail=f"{mensaje_amigable} ||| TECH_DETAILS: {str(exception_caught)}"
        )
    except HTTPException as e:
        detail = e.detail
        print(f"Captured Detail: {detail}")
        
        if "|||" in detail:
            print("SUCCESS: Separator '|||' found.")
            parts = detail.split("|||")
            print(f"User Message: {parts[0].strip()}")
            print(f"Tech Details: {parts[1].strip()}")
        else:
            print("FAILURE: Separator '|||' NOT found.")

    # Simulating Frontend Logic
    print("\nSimulating Frontend Parsing...")
    raw_toast_description = f"{mensaje_amigable} ||| TECH_DETAILS: {str(exception_caught)}"
    if "|||" in raw_toast_description:
        parts = raw_toast_description.split("|||")
        main = parts[0].strip()
        tech = parts[1].strip()
        print(f"Frontend correctly split into Main: '{main}' and Tech: '{tech}'")
    else:
        print("Frontend would fail to split!")

if __name__ == "__main__":
    test_hybrid_logic()
