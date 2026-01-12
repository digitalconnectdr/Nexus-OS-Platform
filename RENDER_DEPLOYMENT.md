# Render Deployment Guide - Backend FastAPI

## Paso 1: Preparar el Repositorio

### 1.1 Verificar que tienes estos archivos:

✅ `backend/requirements.txt` - Dependencias Python
✅ `backend/app/main.py` - Aplicación FastAPI
✅ `.env` - Variables de entorno (NO subir a GitHub)

### 1.2 Crear archivo de configuración para Render

Ya creado: `render.yaml` en la raíz del proyecto

---

## Paso 2: Subir a GitHub

### 2.1 Inicializar Git (si no lo has hecho)

```bash
cd C:\Users\JCPENALO\.gemini\antigravity\scratch\ai-saas-platform

# Inicializar git
git init

# Crear .gitignore
# (ya existe, verificar que incluya .env)

# Agregar archivos
git add .
git commit -m "Initial commit - Backend optimizado para producción"
```

### 2.2 Crear repositorio en GitHub

1. Ve a github.com
2. Click "New repository"
3. Nombre: `ai-saas-platform`
4. Visibilidad: Private (recomendado)
5. NO inicialices con README
6. Click "Create repository"

### 2.3 Conectar y subir

```bash
# Conectar con GitHub
git remote add origin https://github.com/TU-USUARIO/ai-saas-platform.git

# Subir código
git branch -M main
git push -u origin main
```

---

## Paso 3: Configurar en Render

### 3.1 Crear Web Service

1. En Render Dashboard, click **"New Web Service"**
2. Click **"Connect GitHub"** (autoriza Render)
3. Selecciona el repositorio `ai-saas-platform`
4. Click **"Connect"**

### 3.2 Configuración del Servicio

**Name:** `ai-saas-backend` (o el que prefieras)

**Region:** `Oregon (US West)` (más cercano si estás en América)

**Branch:** `main`

**Root Directory:** `backend`

**Runtime:** `Python 3`

**Build Command:**
```bash
pip install -r requirements.txt
```

**Start Command:**
```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

**Instance Type:** `Free`

### 3.3 Variables de Entorno

Click **"Advanced"** → **"Add Environment Variable"**

Agrega estas variables (copia de tu `.env` local):

```
DATABASE_URL=tu_supabase_connection_string
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

**IMPORTANTE:** NO incluyas comillas en los valores

### 3.4 Deploy

Click **"Create Web Service"**

Render comenzará a:
1. Clonar tu repositorio
2. Instalar dependencias
3. Iniciar el servidor

**Tiempo estimado:** 3-5 minutos

---

## Paso 4: Verificar Deployment

### 4.1 Esperar a que termine

Verás logs en tiempo real. Busca:
```
==> Your service is live 🎉
```

### 4.2 Obtener URL

Tu backend estará en:
```
https://ai-saas-backend.onrender.com
```

### 4.3 Probar

```bash
# Health check
curl https://ai-saas-backend.onrender.com/health

# Docs
https://ai-saas-backend.onrender.com/docs
```

---

## Paso 5: Configurar CORS

### 5.1 Actualizar origins en main.py

```python
# backend/app/main.py
origins = [
    "http://localhost:3000",
    "https://tu-frontend.vercel.app",  # Agregar cuando tengas Vercel
    "https://ai-saas-backend.onrender.com"
]
```

### 5.2 Commit y push

```bash
git add backend/app/main.py
git commit -m "Update CORS origins for production"
git push
```

Render detectará el cambio y redesplegará automáticamente.

---

## Troubleshooting

### Error: "Build failed"

**Causa:** Falta alguna dependencia en requirements.txt

**Solución:**
```bash
cd backend
pip freeze > requirements.txt
git add requirements.txt
git commit -m "Update requirements"
git push
```

### Error: "Application failed to start"

**Causa:** Variables de entorno incorrectas

**Solución:**
1. Ve a Render Dashboard → tu servicio
2. Environment → Verifica las variables
3. Asegúrate que DATABASE_URL sea correcto

### Backend se duerme

**Causa:** Plan gratuito (normal)

**Solución:** Configuraremos UptimeRobot después

---

## Próximos Pasos

1. ✅ Backend en Render
2. ⏳ Frontend en Vercel
3. ⏳ UptimeRobot para mantener despierto
4. ⏳ Configurar dominio (opcional)

---

## URLs Importantes

**Render Dashboard:** https://dashboard.render.com
**Tu Backend:** https://ai-saas-backend.onrender.com
**Logs:** Dashboard → tu servicio → Logs
**Variables:** Dashboard → tu servicio → Environment
