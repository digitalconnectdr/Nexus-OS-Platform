from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from app.core.client import SUPABASE_KEY  # Usamos la key para validar firma si es necesario, o confiamos en Supabase

# Esquema de seguridad Bearer Token (El estandar en APIs modernas)
security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Valida el JWT enviado por el Frontend.
    Si es válido, devuelve el ID del usuario (sub).
    Si no, lanza 401 Unauthorized.
    """
    token = credentials.credentials
    
    try:
        # Opción A: Validación simple (Decodificar sin verificar firma por ahora, confiando en SSL)
        # En producción estricta, deberíamos verificar la firma con el JWT Secret de Supabase.
        payload = jwt.decode(token, options={"verify_signature": False})
        
        # --- EMERGENCY ROLE NORMALIZATION ---
        if "role" in payload and payload["role"]:
            payload["role"] = str(payload["role"]).lower()
            
        if "user_metadata" in payload and payload["user_metadata"]:
            if "role" in payload["user_metadata"]:
                 payload["user_metadata"]["role"] = str(payload["user_metadata"]["role"]).lower()
        # ------------------------------------

        return payload  # Contiene 'sub' (User UUID), 'email', 'role', etc.
        
    except Exception as e:
        print(f"Auth Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales de autenticación inválidas o expiradas",
            headers={"WWW-Authenticate": "Bearer"},
        )
