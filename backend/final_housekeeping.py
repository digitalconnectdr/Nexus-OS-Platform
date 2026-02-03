import asyncio
import os
import glob
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

FILES_TO_DELETE = [
    "audit_results.log", "audit_results.txt", "audit_results_final*.txt", "audit_results_v2.txt",
    "audit_statuses.py", "audit_tenancy_isolation.py", "audit_data_leakage.py", "audit_masters_isolation.py", "audit_permissions.py",
    "benchmark_auth_local.py", "check_auth_user.py", "check_casing.py", "check_db_health.py", "check_db_perms.py", 
    "check_modules.py", "check_permissions_db.py", "check_rep_perms.py", "check_schema.py", "cleanup_roles.py",
    "diag_perm_query.py", "diagnose_hang.py", "discover_ids.py", "dump_statuses.py", "e2e_toggle_test.py",
    "emergency_db_test.py", "find_dupes.py", "find_function.py", "fix_policies_tenancy.py", "fix_statuses.py",
    "functional_hub.py", "functional_hub_v2.py", "list_user_ids.py", "migrate_add_name.py", "migrate_status_scopes.py",
    "mission_1_sales.py", "normalize_db.py", "output.json", "pentest_suite.py", "qa_audit_perms.py", 
    "qa_award_test.py", "qa_cleanup.py", "qa_full_test.py", "register_commission_perm.py", "repro_db_connect.py", 
    "repro_hang.py", "repro_toggle_conflict.py", "repro_toggle_endpoint.py", "results.json", "search_uuid.py",
    "security_test_skills.py", "seed_full_permissions.py", "seed_history_perms.py", "seed_isolation_data.py", 
    "seed_isolation_data_direct.py", "seed_massive_sales.py", "seed_operational_data.py", "seed_ops_permissions.py",
    "stress_api_benchmark.py", "stress_results.json", "stress_results.txt", "stress_test.py", "sync_juan.py", 
    "test_api_permissions.py", "test_hierarchy_security.py", "test_imports.py", "test_imports_v2.py", 
    "test_imports_v3.py", "test_proxy_fix.py", "test_sale_id.txt", "unlock_db.py", "unlock_db_direct.py",
    "val_ids.json", "verify_isolation.py", "verify_jwt_opt.py", "verify_nuclear_test.py", 
    "verify_policies_isolation.py", "verify_supabase_init.py", "verify_supervisors.py"
]

async def cleanup_db():
    print("🧹 Cleaning Database Records...")
    engine = create_async_engine(DATABASE_URL, connect_args={"statement_cache_size": 0})
    async with engine.begin() as conn:
        # Delete test sales
        print("   🗑️ Purging test sales...")
        await conn.execute(text("""
            DELETE FROM sales_orders 
            WHERE customer_name ILIKE '%Test Flow%' 
               OR customer_name ILIKE '%Stress%' 
               OR customer_name ILIKE '%QA%'
               OR customer_name = 'Juan Perez'
        """))
        
        # Delete test tournaments and participations
        print("   🗑️ Purging test tournaments...")
        # Since participations have FK to tournaments, we use a subquery or join
        await conn.execute(text("""
            DELETE FROM tournament_participations 
            WHERE tournament_id IN (
                SELECT id FROM tournaments 
                WHERE name ILIKE '%QA%' 
                   OR name ILIKE '%Stress%' 
                   OR name ILIKE '%Battle%'
                   OR name = 'PRUEBA NUCLEAR'
            )
        """))
        
        await conn.execute(text("""
            DELETE FROM tournaments 
            WHERE name ILIKE '%QA%' 
               OR name ILIKE '%Stress%' 
               OR name ILIKE '%Battle%'
               OR name = 'PRUEBA NUCLEAR'
        """))
        
        # Cleanup test goals if any
        print("   🗑️ Purging test goals...")
        await conn.execute(text("""
            DELETE FROM sales_goals 
            WHERE target_amount = 5000.0 OR target_amount = 6666.0
        """))

    await engine.dispose()
    print("✅ Database cleaned.")

def cleanup_files():
    print("🧹 Cleaning Temporary Files...")
    count = 0
    for pattern in FILES_TO_DELETE:
        for file_path in glob.glob(pattern):
            try:
                os.remove(file_path)
                print(f"   🗑️ Removed: {file_path}")
                count += 1
            except Exception as e:
                print(f"   ⚠️ Error removing {file_path}: {e}")
    print(f"✅ Files cleaned. Total removed: {count}")

async def main():
    await cleanup_db()
    cleanup_files()
    print("\n✨ Housekeeping Complete. System is READY for Go-Live.")

if __name__ == "__main__":
    asyncio.run(main())
