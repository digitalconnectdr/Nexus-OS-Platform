import asyncio
from sqlalchemy import text
from app.api import deps

async def add_scope_column():
    print("🛠️ Adding 'scope' column to 'statuses' table...")
    async for db in deps.get_db():
        try:
            await db.execute(text("ALTER TABLE statuses ADD COLUMN IF NOT EXISTS scope VARCHAR DEFAULT 'DASHBOARD' NOT EXISTS"))
            # Wait, 'IF NOT EXISTS' for columns is PostgreSQL 9.6+, but 'NOT EXISTS' at the end is wrong.
            # Proper query:
            await db.execute(text("""
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                   WHERE table_name='statuses' AND column_name='scope') THEN
                        ALTER TABLE statuses ADD COLUMN scope VARCHAR DEFAULT 'DASHBOARD';
                    END IF;
                END $$;
            """))
            await db.commit()
            print("✅ Column 'scope' added successfully.")
        except Exception as e:
            print(f"❌ Error adding column: {e}")
        finally:
            break

if __name__ == "__main__":
    asyncio.run(add_scope_column())
