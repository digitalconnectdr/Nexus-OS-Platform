import json
import os
import sys

# Ensure backend path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

from sqlalchemy import create_engine, text
from app.core.config import settings

# Adjust URL for sync driver (asyncpg -> psycopg2)
# Assuming typical async URL is postgresql+asyncpg://...
db_url = str(settings.DATABASE_URL).replace("+asyncpg", "")

engine = create_engine(db_url)

def main():
    with engine.connect() as conn:
        # Find JPRS ID
        res = conn.execute(text("SELECT id FROM organizations WHERE name = 'JPRS DIGITAL CONNECT'"))
        jprs_id = res.scalar()
        
        if not jprs_id:
            print("JPRS_NOT_FOUND")
            return

        # Fetch perms
        perms = conn.execute(text(f"SELECT role, module, resource, action, is_allowed, name FROM role_permissions WHERE tenant_id = '{jprs_id}'"))
        
        matrix = {}
        for row in perms:
            # Row(role, module, resource, action, is_allowed, name)
            role, module, resource, action, is_allowed, name = row
            
            if role not in matrix: matrix[role] = {}
            if module not in matrix[role]: matrix[role][module] = {}
            if resource not in matrix[role][module]: matrix[role][module][resource] = []
            
            matrix[role][module][resource].append({
                'action': action, 
                'is_allowed': is_allowed,
                'name': name
            })
        
        with open('jprs_matrix.json', 'w', encoding='utf-8') as f:
            json.dump(matrix, f, indent=2)
        print("JSON_SAVED")

if __name__ == "__main__":
    main()
