# Panel de Estrategia de Marketing — Humanware Group

Panel interactivo con la estrategia de marketing de Humanware Group: organigrama
**Unidad → Producto → Objetivo → Acción**, con filtros, progreso y una vista de
detalle por acción. Implementado a partir del prototipo de Claude Design en
`project/Panel Marketing Humanware.dc.html` (ver `chats/chat1.md` para el
historial de decisiones de producto).

## Arquitectura

- **`backend/frontend/`** — sitio estático (HTML/CSS/JS vanilla, sin build step).
  Vive dentro de `backend/` para que quede en el mismo directorio que se
  despliega en producción (ver sección Deploy).
- **`backend/`** — servidor Express que sirve el frontend y expone una API
  para el estado de las acciones (`Pendiente` / `En progreso` / `Hecho`),
  persistido en SQLite (`node:sqlite`) para que todo el equipo vea el mismo
  avance en tiempo casi real (polling cada 20s + al volver a la pestaña).
- Los filtros de unidad/producto y qué unidades/objetivos están
  expandidos son preferencias de navegación de cada persona — se guardan en
  el `localStorage` del navegador, no en el servidor.

## Cómo correrlo

```bash
cd backend
npm install
npm start
```

Abrí `http://localhost:3000` (puerto configurable con la variable de entorno `PORT`).

La base SQLite se crea sola en `backend/data/panel.sqlite` la primera vez que
corre el servidor.

## Estructura de datos

El contenido del plan (unidades, productos, objetivos y acciones) vive en
`backend/frontend/js/data.js`. Para agregar o editar objetivos/acciones del plan,
se edita ese archivo — no requiere tocar el backend.

## API

- `GET /api/estados` → `{ "<actionId>": "pendiente" | "progreso" | "hecho", ... }`
- `PUT /api/estados/:id` con body `{ "status": "pendiente" | "progreso" | "hecho" }`

No tiene autenticación: cualquiera con acceso a la URL puede ver y actualizar
el estado de las acciones.

## Deploy (para que el equipo lo use)

Recomendado: **Railway**, porque hostea el backend con Node.js corriendo
siempre y soporta un volumen persistente para que la base SQLite no se borre
en cada deploy.

1. Subí este repo a GitHub.
2. En [railway.app](https://railway.app), creá un proyecto → **Deploy from GitHub repo** → elegí este repo.
3. En la configuración del servicio, poné **Root Directory** = `backend`.
4. Agregá un **Volume** (Settings → Volumes) con mount path `/data`.
5. Agregá la variable de entorno `DATA_DIR=/data`.
6. Railway detecta el `package.json`, corre `npm install` y `npm start` solo.
7. Te da una URL pública (tipo `https://tu-proyecto.up.railway.app`) — esa es la que compartís con el equipo.

Variables de entorno soportadas:
- `PORT` — puerto del servidor (Railway la setea sola).
- `DATA_DIR` — carpeta donde vive `panel.sqlite` (default: `backend/data`, para desarrollo local).

## Bundle de diseño original

`project/` y `chats/` son el material exportado desde Claude Design que sirvió
de base para esta implementación (prototipo HTML/CSS/JS y transcripción de la
conversación de diseño). Se conservan como referencia histórica.
