# Walkthrough: Rendimiento por Campaña y Producto

Este documento detalla la implementación de la nueva pestaña de **Rendimiento por Campaña y Producto** en el Dashboard de Analítica.

## 1. Backend: Nuevo Endpoint de Rendimiento

Se ha creado un nuevo endpoint dedicado para calcular las métricas agregadas por campaña y producto, evitando la saturación de la base de datos que podría causar el uso de endpoints genéricos.

- **Archivo:** `backend/app/api/api_v1/endpoints/campaign_performance.py`
- **Ruta:** `GET /api/v1/campaign-performance/`
- **Parámetros:** `month` (formato `YYYY-MM`)
- **Funcionalidad:**
  - Recupera las metas de ventas (`SalesGoal`) para el mes especificado.
  - Agrega las ventas aprobadas (`SalesOrder`) del mes actual y del mes anterior.
  - Calcula métricas clave: Logro ($ y #), Objetivo ($ y #), % de Cumplimiento, Proyección al cierre y Ritmo (% de mejora vs mes anterior).
  - Categoriza el estatus en: **Óptimo** (>=100%), **Alerta** (80-99%) y **Riesgo** (<80%).

## 2. Frontend: Componente de Visualización

Se implementó un componente especializado que sigue la línea estética de alta gama del proyecto.

- **Archivo:** `frontend/src/components/analytics/CampaignProductPerformance.tsx`
- **Características:**
  - **Doble Nivel de Análisis:** Una tabla superior para Campañas y una inferior para Productos.
  - **Filtrado Interactivo:** Al hacer clic en una campaña, la tabla de productos se filtra automáticamente para mostrar solo los productos de esa campaña.
  - **Integración Global:** Respeta los filtros de fecha (`startDate`) y búsqueda (`searchTerm`) del Dashboard.
  - **Feedback Visual:** Uso de badges de estado vibrantes, tooltips informativos y micro-animaciones.

## 3. Integración en el Dashboard

Se actualizó el dashboard principal para incluir el acceso a esta nueva analítica.

- **Archivo:** `frontend/src/components/AnalyticsDashboard.tsx` y `frontend/src/components/analytics/OperationalEfficiency.tsx`
- **Cambios:**
  - **Reorganización:** La vista de Eficiencia Operativa ahora contiene dos sub-pestañas:
    1. **Jerarquía de Ventas:** Vista clásica de Supervisores y Agentes.
    2. **Campaña y Producto:** Nueva vista de rendimiento agregada.
  - **Navegación:** Se gestiona mediante un estado local en el dashboard que controla la sub-pestaña activa.
  - **Exportación:** El botón de "Exportar Reporte" se adapta dinámicamente según la sub-pestaña activa (Eficiencia vs. Campañas).

## 4. Mejoras de UI/UX

- Se corrigió un problema de visibilidad en los tooltips de la pestaña de "Eficiencia Operativa" (z-index y overflow).
- Se estandarizó el uso de iconos (`LayersIcon`, `PackageIcon`) para representar niveles jerárquicos.

## 5. Exportación de Datos

Se implementó la capacidad de exportar los datos de rendimiento de campañas y productos.

- **Endpoint:** `GET /api/v1/campaign-performance/export`
- **Formato:** CSV
- **Contenido:**
  - **Sección 1:** Rendimiento de Campañas (Metas, Logros, Proyecciones).
  - **Sección 2:** Rendimiento desglosado por Productos.
- **Integración:** Accesible desde el botón "Reporte Campañas" en el encabezado del Dashboard.

---
**Nota:** Esta implementación separa el procesamiento de datos por entidad, asegurando que el dashboard siga siendo fluido incluso con grandes volúmenes de ventas.
