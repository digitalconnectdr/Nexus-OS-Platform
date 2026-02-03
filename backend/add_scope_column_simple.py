import asyncio
from sqlalchemy import text
from app.api import deps

async def add_scope_column():
    print("🛠️ Adding 'scope' column to 'statuses' table...")
    async for db in deps.get_db():
        try:
            # Check if column exists
            check_res = await db.execute(text("""
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='statuses' AND column_name='scope'
            """))
            if not check_res.fetchone():
                print("Adding column 'scope'...")
                await db.execute(text("ALTER TABLE statuses ADD COLUMN scope VARCHAR DEFAULT 'DASHBOARD'"))
                await db.commit()
                print("✅ Column 'scope' added successfully.")
            else:
                print("✨ Column 'scope' already exists.")
        except Exception as e:
            print(f"❌ Error adding column: {e}")
        finally:
            break

if __name__ == "__main__":
    asyncio.run(add_scope_column())
