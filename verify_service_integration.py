import asyncio
import sys
import os
import uuid
import logging

# Configure logging to verify "Clonación exitosa" message
logging.basicConfig(level=logging.INFO)

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

from app.services.permission_service import initialize_organization_permissions
# We don't need database.py for this specific test if we just mock the UUID, 
# BUT `initialize_organization_permissions` queries Supabase directly.
# We just need to trigger it with a fake tenant_id to see if it tries to READ JPRS.
# But better: Create a dummy org via Supabase API (Service Key) first so Foreign Key works if enforced?
# Actually, Tenant ID in role_permissions usually enforces FK to organizations.
# So I must create an Org first.

from app.core.client import supabase

async def main():
    print("🧪 Testing Permission Service Integration...")
    
    # 1. Create Dummy Org via Service Key (Bypass RLS)
    test_id = str(uuid.uuid4())
    org_data = {
        "id": test_id,
        "name": "SERVICE_LAYER_TEST",
        "slug": f"svc-layer-{test_id[:8]}"
    }
    
    print(f"   > Creating Org {test_id}...")
    try:
        supabase.table('organizations').insert(org_data).execute()
        print("   ✅ Org Created.")
        
        # 2. Call Service Function
        print("   > Calling initialize_organization_permissions...")
        await initialize_organization_permissions(uuid.UUID(test_id))
        
        # 3. Verify
        res = supabase.table('role_permissions').select('count', count='exact').eq('tenant_id', test_id).execute()
        count = res.count
        print(f"   > Permission Count: {count}")
        
        if count == 473:
            print("   🏆 SUCCESS: Service clone worked perfect.")
        else:
            print(f"   ❌ FAILURE: Expected 473, got {count}")
            
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
    finally:
        # Cleanup
        print("   🧹 Cleanup...")
        supabase.table('organizations').delete().eq('id', test_id).execute()
        print("   ✨ Done.")

if __name__ == "__main__":
    asyncio.run(main())
