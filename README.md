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
  para todo el contenido del plan (unidades, productos, objetivos, acciones)
  y su estado (`Pendiente` / `En progreso` / `Hecho`), persistido en SQLite
  (`node:sqlite`) para que todo el equipo vea el mismo avance en tiempo casi
  real (polling cada 20s + al volver a la pestaña).
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
corre el servidor, con el contenido inicial del plan ya cargado.

## Estructura de datos

Todo el plan (unidades, productos, objetivos, acciones y las tarjetas de
pipeline de arriba) vive en la base SQLite, no en un archivo estático — se
edita desde el propio panel con los botones **+** (agregar) y **🗑** (borrar)
en cada nivel. `backend/seed-data.js` sólo se usa una vez, la primera vez que
arranca el servidor contra una base vacía, para cargar el contenido inicial;
después de eso no se vuelve a leer.

Borrar cualquier cosa pide una contraseña compartida (ver `ADMIN_PASSWORD`
más abajo); agregar contenido no la pide.

## API

- `GET /api/plan` → `{ unidades: [...], statCards: [...] }` con todo el árbol
  del plan y el estado de cada acción.
- `POST /api/unidades` `/api/productos` `/api/objetivos` `/api/acciones`
  `/api/stat-cards` `/api/stat-items` `/api/stat-leads` — crean cada tipo de
  entidad (ver `backend/server.js` para el body esperado de cada una). El
  `value` de un stat-item no se carga a mano: es la cantidad de stat-leads
  que tiene cargados.
- `DELETE` en cualquiera de esas mismas rutas + `/:id` — borra esa entidad
  (y lo que cuelga de ella). Requiere el header `x-admin-password` con el
  valor de `ADMIN_PASSWORD`.
- `PUT /api/acciones/:id/estado` con body `{ "status": "pendiente" | "progreso" | "hecho" }`.
- `POST /api/notas` con body `{ "accionId", "texto" }` — agrega una entrada a la
  bitácora de esa acción. `PUT /api/notas/:id` con body `{ "hecho": true|false }`
  tilda/destilda una entrada. No hay borrado de entradas: la bitácora es
  intencionalmente de solo agregar, para no perder el historial.

No tiene autenticación de usuarios: cualquiera con acceso a la URL puede ver
y actualizar el plan. Borrar además requiere la contraseña compartida.

## Deploy (para que el equipo lo use)

Recomendado: **Railway**, porque hostea el backend con Node.js corriendo
siempre y soporta un volumen persistente para que la base SQLite no se borre
en cada deploy.

1. Subí este repo a GitHub.
2. En [railway.app](https://railway.app), creá un proyecto → **Deploy from GitHub repo** → elegí este repo.
3. En la configuración del servicio, poné **Root Directory** = `backend`.
4. Agregá un **Volume** (Settings → Volumes) con mount path `/data`.
5. Agregá las variables de entorno `DATA_DIR=/data` y `ADMIN_PASSWORD=<una contraseña a elección>`.
6. Railway detecta el `package.json`, corre `npm install` y `npm start` solo.
7. Te da una URL pública (tipo `https://tu-proyecto.up.railway.app`) — esa es la que compartís con el equipo.

Variables de entorno soportadas:
- `PORT` — puerto del servidor (Railway la setea sola).
- `DATA_DIR` — carpeta donde vive `panel.sqlite` (default: `backend/data`, para desarrollo local).
- `ADMIN_PASSWORD` — contraseña compartida que pide el panel antes de borrar
  cualquier unidad/producto/objetivo/acción/tarjeta. Si no está configurada,
  todos los borrados quedan deshabilitados (el servidor responde error en vez
  de dejar borrar sin contraseña).

## Bundle de diseño original

`project/` y `chats/` son el material exportado desde Claude Design que sirvió
de base para esta implementación (prototipo HTML/CSS/JS y transcripción de la
conversación de diseño). Se conservan como referencia histórica.
