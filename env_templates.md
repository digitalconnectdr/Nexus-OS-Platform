# 📄 PLANTILLA DE VARIABLES DE ENTORNO (GO-LIVE)

Utiliza estos bloques para configurar los servicios en la nube. **IMPORTANTE:** No incluyas espacios alrededor del signo `=`.

---

## 🚀 1. Configuración RENDER (Backend)
Configura estas variables en el panel de **"Environment"** de tu servicio en Render.

```bash
# --- DATABASE ---
DATABASE_URL=postgresql+asyncpg://user:password@hostname:5432/dbname

# --- SECURITY ---
JWT_SECRET=tu_secreto_para_firmar_tokens
SECRET_KEY=clave_aleatoria_para_sesiones_cors

# --- SUPABASE INTEGRATION ---
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_KEY=tu_service_role_key_anom_key

# --- NETWORKING (PROD) ---
# Lista de dominios permitidos separados por coma (ej. Vercel)
# O usa "*" para permitir cualquier origen temporalmente.
ALLOWED_ORIGINS=https://tu-frontend.vercel.app,http://localhost:3000
```

---

## ⚛️ 2. Configuración VERCEL (Frontend)
Configura estas variables en el panel de **"Environment Variables"** de tu proyecto en Vercel.

```bash
# --- API CONNECTION ---
# Debe ser la URL de tu servicio en Render, SIN el "/" al final.
NEXT_PUBLIC_API_URL=https://tu-backend.onrender.com

# --- PUBLIC SUPABASE (Navegador) ---
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
```

---

## 💾 NOTA SOBRE SUPABASE
Asegúrate de que en el panel de Supabase (Authentication > URL Configuration) hayas añadido el dominio de tu frontend en Vercel como **Redirect URL** permitido.

---

## 🏗️ 3. CONFIGURACIÓN TÉCNICA (Render Dashboard)
Aplica estos valores en la configuración de **"Build & Deploy"** de tu servicio Web en Render.

- **Environment:** `Python 3`
- **Build Command:** `pip install -r backend/requirements.txt`
- **Start Command:** `gunicorn app.main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT` (El puerto se asigna automáticamente mediante la variable `$PORT`).
- **Root Directory:** `./backend` (Si despliegas la subcarpeta backend por separado) o déjalo vacío si despliegas el repo completo y ajustas los paths.

> [!TIP]
> **Inicialización Automática:** El sistema detectará si la base de datos está vacía y creará las tablas automáticamente al primer arranque. No necesitas ejecutar scripts manuales de migración para el lanzamiento inicial.
