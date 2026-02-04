import asyncio
import sys
import os
import uuid
from sqlalchemy import select, text, func

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

from app.core.database import SessionLocal
from app.models.core import Organization, RolePermission

async def debug_read():
    async with SessionLocal() as db:
        print("🔍 [DEBUG] Starting Permission Visibility Check...")
        
        # 1. Get Latest Organization
        result = await db.execute(select(Organization).order_by(Organization.created_at.desc()).limit(1))
        latest_org = result.scalar_one_or_none()
        
        if not latest_org:
            print("❌ No organizations found!")
            return
            
        print(f"🎯 Latest Org: {latest_org.name} (ID: {latest_org.id})")
        print(f"🔎 Latest Org Status: is_deleted={latest_org.is_deleted}")
        
        # 0. GLOBAL HEALTH CHECK
        try:
             count_total = await db.scalar(select(func.count()).select_from(RolePermission))
             print(f"🌍 TOTAL Permission Rows in DB: {count_total}")
             
             # Check explicitly for THIS org's permissions
             count_org = await db.scalar(select(func.count()).select_from(RolePermission).where(RolePermission.tenant_id == latest_org.id))
             print(f"📉 Permissions for {latest_org.name}: {count_org}")
             
             if count_org == 0:
                 print("🚨 CONFIRMED: Org exists but has NO permissions. Insert failed silently or rolled back partial.")
             else:
                 print(f"✅ CONFIRMED: Data EXISTS ({count_org} rows). Issue is READ/VISIBILITY in UI.")
                 
        except Exception as e:
             print(f"⚠️ Error checking global counts: {e}")
             
        # Skip detailed tenant grouping if we found the answer
        # But keeping JPRS check is useful


        # 2. RAW COUNT
        print("   > Checking permissions WITHOUT RLS context...")
        try:
            stmt = select(func.count()).select_from(RolePermission).where(RolePermission.tenant_id == latest_org.id)
            res = await db.execute(stmt)
            count_raw = res.scalar()
            print(f"     Count (No Context): {count_raw}")
        except Exception as e:
            print(f"     Error (No Context): {e}")

        # 3. SET SESSION TENANT
        print("   > Setting 'app.current_tenant'...")
        try:
            # Postgres requires UUID string
            await db.execute(text(f"SELECT set_config('app.current_tenant', '{str(latest_org.id)}', false);"))
        except Exception as e:
             print(f"❌ Failed to set config: {e}")
             
        # 4. QUERY WITH CONTEXT
        print("   > Checking permissions WITH RLS context...")
        try:
            stmt = select(func.count()).select_from(RolePermission).where(RolePermission.tenant_id == latest_org.id)
            res = await db.execute(stmt)
            count_rls = res.scalar()
            print(f"     Count (With Context): {count_rls}")
            
            if count_rls == 0 and count_raw == 0:
                print("🚨 RESULT: Zero records found. Seeding FAILED.")
            elif count_rls == 0 and count_raw > 0:
                 print("🚨 RESULT: Data exists but RLS HID it. 'set_config' didn't work or Policy is broken.")
            elif count_rls > 0:
                 print("✅ RESULT: Success! Data is visible with context.")
                 
        except Exception as e:
            print(f"     Error (With Context): {e}")

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(debug_read())
