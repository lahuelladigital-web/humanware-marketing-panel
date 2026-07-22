const path = require("node:path");
const express = require("express");
const db = require("./db");

const VALID_ESTADOS = new Set(["pendiente", "progreso", "hecho"]);
const VALID_HORIZONTES = new Set(["Corto plazo", "Mediano plazo", "Largo plazo", "Continuo"]);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());

function requireAdmin(req, res, next) {
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: "Borrar no está habilitado: falta configurar ADMIN_PASSWORD en el servidor." });
  }
  const provided = req.get("x-admin-password") || (req.body && req.body.password);
  if (provided !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Contraseña incorrecta." });
  }
  next();
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

app.get("/api/plan", (req, res) => {
  res.json({ unidades: db.getPlan(), statCards: db.getStatCards() });
});

// ---------- unidades ----------

app.post("/api/unidades", (req, res) => {
  const { nombre, tag, sub } = req.body || {};
  if (!nonEmptyString(nombre)) return res.status(400).json({ error: "Falta el nombre de la unidad." });
  res.status(201).json(db.createUnidad({ nombre: nombre.trim(), tag, sub }));
});

app.delete("/api/unidades/:id", requireAdmin, (req, res) => {
  db.deleteUnidad(req.params.id);
  res.status(204).end();
});

// ---------- productos ----------

app.post("/api/productos", (req, res) => {
  const { unidadId, nombre, tag } = req.body || {};
  if (!nonEmptyString(unidadId) || !nonEmptyString(nombre)) {
    return res.status(400).json({ error: "Falta la unidad o el nombre del producto." });
  }
  res.status(201).json(db.createProducto({ unidadId, nombre: nombre.trim(), tag }));
});

app.delete("/api/productos/:id", requireAdmin, (req, res) => {
  db.deleteProducto(req.params.id);
  res.status(204).end();
});

// ---------- objetivos ----------

app.post("/api/objetivos", (req, res) => {
  const { unidadId, prod, titulo, horizonte, meta } = req.body || {};
  if (!nonEmptyString(unidadId) || !nonEmptyString(titulo)) {
    return res.status(400).json({ error: "Falta la unidad o el título del objetivo." });
  }
  if (!VALID_HORIZONTES.has(horizonte)) {
    return res.status(400).json({ error: "Horizonte inválido." });
  }
  res.status(201).json(db.createObjetivo({ unidadId, prod, titulo: titulo.trim(), horizonte, meta }));
});

app.put("/api/objetivos/:id", (req, res) => {
  const { titulo, horizonte, meta } = req.body || {};
  if (!nonEmptyString(titulo)) {
    return res.status(400).json({ error: "Falta el título del objetivo." });
  }
  if (!VALID_HORIZONTES.has(horizonte)) {
    return res.status(400).json({ error: "Horizonte inválido." });
  }
  const found = db.updateObjetivo(req.params.id, { titulo: titulo.trim(), horizonte, meta });
  if (!found) return res.status(404).json({ error: "Objetivo no encontrado." });
  res.status(204).end();
});

app.delete("/api/objetivos/:id", requireAdmin, (req, res) => {
  db.deleteObjetivo(req.params.id);
  res.status(204).end();
});

// ---------- acciones ----------

app.post("/api/acciones", (req, res) => {
  const { objetivoId, titulo, responsable, plazo, canal } = req.body || {};
  if (!nonEmptyString(objetivoId) || !nonEmptyString(titulo)) {
    return res.status(400).json({ error: "Falta el objetivo o el título de la acción." });
  }
  res.status(201).json(db.createAccion({ objetivoId, titulo: titulo.trim(), responsable, plazo, canal }));
});

app.put("/api/acciones/:id", (req, res) => {
  const { titulo, responsable, plazo, canal } = req.body || {};
  if (!nonEmptyString(titulo)) {
    return res.status(400).json({ error: "Falta el título de la acción." });
  }
  const found = db.updateAccion(req.params.id, { titulo: titulo.trim(), responsable, plazo, canal });
  if (!found) return res.status(404).json({ error: "Acción no encontrada." });
  res.status(204).end();
});

app.put("/api/acciones/:id/estado", (req, res) => {
  const { status } = req.body || {};
  if (!VALID_ESTADOS.has(status)) {
    return res.status(400).json({ error: "status must be one of: pendiente, progreso, hecho" });
  }
  const found = db.setEstado(req.params.id, status);
  if (!found) return res.status(404).json({ error: "Acción no encontrada." });
  res.json({ id: req.params.id, status });
});

app.delete("/api/acciones/:id", requireAdmin, (req, res) => {
  db.deleteAccion(req.params.id);
  res.status(204).end();
});

// ---------- bitácora (notas) ----------
// Append-only by design (see db.js): no delete endpoint, entries are never removed.

app.post("/api/notas", (req, res) => {
  const { accionId, texto } = req.body || {};
  if (!nonEmptyString(accionId) || !nonEmptyString(texto)) {
    return res.status(400).json({ error: "Falta la acción o el texto de la entrada." });
  }
  res.status(201).json(db.createNota({ accionId, texto: texto.trim() }));
});

app.put("/api/notas/:id", (req, res) => {
  const { hecho } = req.body || {};
  const found = db.setNotaHecho(req.params.id, !!hecho);
  if (!found) return res.status(404).json({ error: "Entrada no encontrada." });
  res.json({ id: req.params.id, hecho: !!hecho });
});

// ---------- pipeline stats ----------

app.post("/api/stat-cards", (req, res) => {
  const { unidadId, nombre, tag } = req.body || {};
  if (!nonEmptyString(unidadId) || !nonEmptyString(nombre)) {
    return res.status(400).json({ error: "Falta la unidad o el nombre de la tarjeta." });
  }
  const created = db.createStatCard({ unidadId, nombre: nombre.trim(), tag });
  if (!created) return res.status(400).json({ error: "La unidad indicada no existe." });
  res.status(201).json(created);
});

app.delete("/api/stat-cards/:id", requireAdmin, (req, res) => {
  db.deleteStatCard(req.params.id);
  res.status(204).end();
});

app.post("/api/stat-items", (req, res) => {
  const { cardId, label, sub, color } = req.body || {};
  if (!nonEmptyString(cardId) || !nonEmptyString(label)) {
    return res.status(400).json({ error: "Falta la tarjeta o la etiqueta del ítem." });
  }
  res.status(201).json(db.createStatItem({ cardId, label: label.trim(), sub, color }));
});

app.delete("/api/stat-items/:id", requireAdmin, (req, res) => {
  db.deleteStatItem(req.params.id);
  res.status(204).end();
});

app.post("/api/stat-leads", (req, res) => {
  const { itemId, empresa, nombre, fecha, comentarios } = req.body || {};
  if (!nonEmptyString(itemId) || !nonEmptyString(nombre)) {
    return res.status(400).json({ error: "Falta el ítem o el nombre del lead." });
  }
  res.status(201).json(db.createStatLead({ itemId, empresa, nombre: nombre.trim(), fecha, comentarios }));
});

app.put("/api/stat-leads/:id", (req, res) => {
  const { empresa, nombre, fecha, itemId, comentarios } = req.body || {};
  if (!nonEmptyString(nombre)) {
    return res.status(400).json({ error: "Falta el nombre del lead." });
  }
  if (!nonEmptyString(itemId)) {
    return res.status(400).json({ error: "Falta el ítem." });
  }
  const found = db.updateStatLead(req.params.id, { empresa, nombre: nombre.trim(), fecha, itemId, comentarios });
  if (!found) return res.status(404).json({ error: "Lead no encontrado." });
  res.status(204).end();
});

app.delete("/api/stat-leads/:id", requireAdmin, (req, res) => {
  db.deleteStatLead(req.params.id);
  res.status(204).end();
});

app.use(express.static(path.join(__dirname, "frontend")));

app.listen(PORT, () => {
  console.log(`Humanware marketing panel running at http://localhost:${PORT}`);
});
