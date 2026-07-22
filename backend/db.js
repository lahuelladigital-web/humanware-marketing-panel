const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const { UNITS: SEED_UNITS, PIPELINE_STATS: SEED_STATS } = require("./seed-data");

// DATA_DIR lets a persistent volume (e.g. Railway) be mounted outside the repo checkout;
// defaults to a local folder for development.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, "panel.sqlite"));
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS unidades (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    tag TEXT NOT NULL DEFAULT '',
    sub TEXT NOT NULL DEFAULT '',
    accent TEXT NOT NULL,
    head_bg TEXT NOT NULL,
    head_border TEXT NOT NULL,
    chip_bg TEXT NOT NULL,
    iso TEXT NOT NULL,
    root INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS productos (
    id TEXT PRIMARY KEY,
    unidad_id TEXT NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    tag TEXT NOT NULL DEFAULT '',
    empty_note TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS objetivos (
    id TEXT PRIMARY KEY,
    unidad_id TEXT NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
    prod TEXT NOT NULL DEFAULT 'all',
    titulo TEXT NOT NULL,
    horizonte TEXT NOT NULL,
    meta TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS acciones (
    id TEXT PRIMARY KEY,
    objetivo_id TEXT NOT NULL REFERENCES objetivos(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    responsable TEXT NOT NULL DEFAULT '',
    plazo TEXT NOT NULL DEFAULT '',
    canal TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pendiente',
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS stat_cards (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    tag TEXT NOT NULL DEFAULT '',
    accent TEXT NOT NULL,
    bg TEXT NOT NULL,
    iso TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS stat_items (
    id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL REFERENCES stat_cards(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    value TEXT NOT NULL,
    sub TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT '#475569'
  );

  -- Manual, append-only progress log per acción; entries are never deleted so the
  -- history of what was done stays intact.
  CREATE TABLE IF NOT EXISTS notas (
    id TEXT PRIMARY KEY,
    accion_id TEXT NOT NULL REFERENCES acciones(id) ON DELETE CASCADE,
    texto TEXT NOT NULL,
    hecho INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  -- Named leads behind a stat_item; the item's displayed value is the count of
  -- these rather than a manually typed number, so it can't drift out of sync.
  CREATE TABLE IF NOT EXISTS stat_leads (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES stat_items(id) ON DELETE CASCADE,
    empresa TEXT NOT NULL DEFAULT '',
    nombre TEXT NOT NULL,
    fecha TEXT NOT NULL DEFAULT ''
  );

  -- legacy table from the previous status-only storage; kept only so the
  -- one-time seed below can recover in-progress statuses, then unused.
  CREATE TABLE IF NOT EXISTS estados (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

// One-time migration for databases created before the `fecha` column existed
// (CREATE TABLE IF NOT EXISTS above doesn't alter an already-existing table).
const statLeadsColumns = db.prepare("PRAGMA table_info(stat_leads)").all().map((c) => c.name);
if (!statLeadsColumns.includes("fecha")) {
  db.exec("ALTER TABLE stat_leads ADD COLUMN fecha TEXT NOT NULL DEFAULT ''");
}

function seedIfEmpty() {
  const { count } = db.prepare("SELECT COUNT(*) AS count FROM unidades").get();
  if (count > 0) return;

  const insertUnidad = db.prepare(`
    INSERT INTO unidades (id, nombre, tag, sub, accent, head_bg, head_border, chip_bg, iso, root)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertProducto = db.prepare(`
    INSERT INTO productos (id, unidad_id, nombre, tag, empty_note) VALUES (?, ?, ?, ?, ?)
  `);
  const insertObjetivo = db.prepare(`
    INSERT INTO objetivos (id, unidad_id, prod, titulo, horizonte, meta) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertAccion = db.prepare(`
    INSERT INTO acciones (id, objetivo_id, titulo, responsable, plazo, canal, status, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const legacyStatus = db.prepare("SELECT status FROM estados WHERE id = ?");

  let objSeq = 0;
  let accSeq = 0;
  const now = new Date().toISOString();

  SEED_UNITS.forEach((u) => {
    insertUnidad.run(u.id, u.name, u.tag || "", u.sub || "", u.accent, u.headBg, u.headBorder, u.chipBg, u.iso, u.root ? 1 : 0);
    (u.productos || []).forEach((p) => {
      insertProducto.run(p.id, u.id, p.name, p.tag || "", p.emptyNote || "");
    });

    // Replicate the legacy grouping (transversal + per-producto) so the old
    // "unit|group|oi|ai" status keys line up with the migrated rows.
    const groups = [{ key: "trans", objetivos: u.objetivos.filter((o) => o.prod === "all") }].concat(
      (u.productos || []).map((p) => ({ key: p.id, objetivos: u.objetivos.filter((o) => o.prod === p.id) }))
    );

    groups.forEach((g) => {
      g.objetivos.forEach((o, oi) => {
        const objId = `o_${objSeq++}`;
        insertObjetivo.run(objId, u.id, o.prod, o.titulo, o.horizonte, o.meta || "");
        o.acciones.forEach((a, ai) => {
          const legacyId = `${u.id}|${g.key}|${oi}|${ai}`;
          const prev = legacyStatus.get(legacyId);
          const status = prev ? prev.status : a.def;
          insertAccion.run(`a_${accSeq++}`, objId, a.t, a.r, a.p, a.c, status, now);
        });
      });
    });
  });

  const insertCard = db.prepare(`INSERT INTO stat_cards (id, nombre, tag, accent, bg, iso) VALUES (?, ?, ?, ?, ?, ?)`);
  const insertItem = db.prepare(`INSERT INTO stat_items (id, card_id, label, value, sub, color) VALUES (?, ?, ?, ?, ?, ?)`);
  let cardSeq = 0;
  let itemSeq = 0;
  SEED_STATS.forEach((s) => {
    const cardId = `sc_${cardSeq++}`;
    insertCard.run(cardId, s.name, s.tag || "", s.accent, s.bg, s.iso);
    s.items.forEach((it) => {
      insertItem.run(`si_${itemSeq++}`, cardId, it.label, it.value, it.sub || "", it.color || "#475569");
    });
  });
}

seedIfEmpty();

const UNIT_PALETTE = [
  { accent: "#8E2D9E", headBg: "#f7eef9", headBorder: "#ecdcf1", chipBg: "#efe0f4" },
  { accent: "#FF8000", headBg: "#fff3e6", headBorder: "#ffe0c2", chipBg: "#ffe6cc" },
  { accent: "#16242B", headBg: "#eef1f4", headBorder: "#d9dfe6", chipBg: "#dde3ea" },
  { accent: "#616E7D", headBg: "#f1f3f5", headBorder: "#e2e6ea", chipBg: "#e4e8ec" },
  { accent: "#2D6CDF", headBg: "#eef3fc", headBorder: "#d3e0f6", chipBg: "#dde7fa" },
  { accent: "#1f9d63", headBg: "#eafaf1", headBorder: "#c9ecd9", chipBg: "#d7f2e2" },
];

function genId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function getPlan() {
  const unidades = db.prepare("SELECT * FROM unidades ORDER BY rowid").all();
  const productos = db.prepare("SELECT * FROM productos ORDER BY rowid").all();
  const objetivos = db.prepare("SELECT * FROM objetivos ORDER BY rowid").all();
  const acciones = db.prepare("SELECT * FROM acciones ORDER BY rowid").all();
  const notas = db.prepare("SELECT * FROM notas ORDER BY rowid").all();

  return unidades.map((u) => ({
    id: u.id,
    nombre: u.nombre,
    tag: u.tag,
    sub: u.sub,
    accent: u.accent,
    headBg: u.head_bg,
    headBorder: u.head_border,
    chipBg: u.chip_bg,
    iso: u.iso,
    root: !!u.root,
    productos: productos
      .filter((p) => p.unidad_id === u.id)
      .map((p) => ({ id: p.id, nombre: p.nombre, tag: p.tag, emptyNote: p.empty_note })),
    objetivos: objetivos
      .filter((o) => o.unidad_id === u.id)
      .map((o) => ({
        id: o.id,
        prod: o.prod,
        titulo: o.titulo,
        horizonte: o.horizonte,
        meta: o.meta,
        acciones: acciones
          .filter((a) => a.objetivo_id === o.id)
          .map((a) => ({
            id: a.id,
            titulo: a.titulo,
            responsable: a.responsable,
            plazo: a.plazo,
            canal: a.canal,
            status: a.status,
            updatedAt: a.updated_at,
            notas: notas
              .filter((n) => n.accion_id === a.id)
              .map((n) => ({ id: n.id, texto: n.texto, hecho: !!n.hecho, createdAt: n.created_at })),
          })),
      })),
  }));
}

function getStatCards() {
  const cards = db.prepare("SELECT * FROM stat_cards ORDER BY rowid").all();
  const items = db.prepare("SELECT * FROM stat_items ORDER BY rowid").all();
  const leads = db.prepare("SELECT * FROM stat_leads ORDER BY rowid").all();
  return cards.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    tag: c.tag,
    accent: c.accent,
    bg: c.bg,
    iso: c.iso,
    items: items
      .filter((it) => it.card_id === c.id)
      .map((it) => {
        const itemLeads = leads
          .filter((l) => l.item_id === it.id)
          .map((l) => ({ id: l.id, empresa: l.empresa, nombre: l.nombre, fecha: l.fecha }));
        return { id: it.id, label: it.label, value: String(itemLeads.length), sub: it.sub, color: it.color, leads: itemLeads };
      }),
  }));
}

function createUnidad({ nombre, tag, sub }) {
  const { count } = db.prepare("SELECT COUNT(*) AS count FROM unidades").get();
  const palette = UNIT_PALETTE[count % UNIT_PALETTE.length];
  const id = genId("u");
  db.prepare(`
    INSERT INTO unidades (id, nombre, tag, sub, accent, head_bg, head_border, chip_bg, iso, root)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(id, nombre, tag || "", sub || "", palette.accent, palette.headBg, palette.headBorder, palette.chipBg, "assets/icon-color.png");
  return { id };
}

function deleteUnidad(id) {
  db.prepare("DELETE FROM unidades WHERE id = ?").run(id);
}

function createProducto({ unidadId, nombre, tag }) {
  const id = genId("p");
  db.prepare(`INSERT INTO productos (id, unidad_id, nombre, tag, empty_note) VALUES (?, ?, ?, ?, '')`).run(id, unidadId, nombre, tag || "");
  return { id };
}

function deleteProducto(id) {
  const producto = db.prepare("SELECT unidad_id FROM productos WHERE id = ?").get(id);
  if (!producto) return;
  // objetivos reference their producto via the free-form `prod` column (it can also be
  // "all"), not a foreign key, so cascading here has to be done by hand; the acciones
  // under each of those objetivos still cascade automatically via the real FK below.
  db.prepare("DELETE FROM objetivos WHERE unidad_id = ? AND prod = ?").run(producto.unidad_id, id);
  db.prepare("DELETE FROM productos WHERE id = ?").run(id);
}

function createObjetivo({ unidadId, prod, titulo, horizonte, meta }) {
  const id = genId("o");
  db.prepare(`INSERT INTO objetivos (id, unidad_id, prod, titulo, horizonte, meta) VALUES (?, ?, ?, ?, ?, ?)`).run(
    id, unidadId, prod || "all", titulo, horizonte, meta || ""
  );
  return { id };
}

function deleteObjetivo(id) {
  db.prepare("DELETE FROM objetivos WHERE id = ?").run(id);
}

function updateObjetivo(id, { titulo, horizonte, meta }) {
  const result = db.prepare("UPDATE objetivos SET titulo = ?, horizonte = ?, meta = ? WHERE id = ?").run(titulo, horizonte, meta || "", id);
  return result.changes > 0;
}

function createAccion({ objetivoId, titulo, responsable, plazo, canal }) {
  const id = genId("a");
  db.prepare(`
    INSERT INTO acciones (id, objetivo_id, titulo, responsable, plazo, canal, status, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pendiente', ?)
  `).run(id, objetivoId, titulo, responsable || "", plazo || "", canal || "", new Date().toISOString());
  return { id };
}

function deleteAccion(id) {
  db.prepare("DELETE FROM acciones WHERE id = ?").run(id);
}

function updateAccion(id, { titulo, responsable, plazo, canal }) {
  const result = db.prepare("UPDATE acciones SET titulo = ?, responsable = ?, plazo = ?, canal = ? WHERE id = ?").run(
    titulo, responsable || "", plazo || "", canal || "", id
  );
  return result.changes > 0;
}

function setEstado(id, status) {
  const updatedAt = new Date().toISOString();
  const result = db.prepare("UPDATE acciones SET status = ?, updated_at = ? WHERE id = ?").run(status, updatedAt, id);
  return result.changes > 0;
}

function createStatCard({ unidadId, nombre, tag }) {
  const unidad = db.prepare("SELECT accent, head_bg, iso FROM unidades WHERE id = ?").get(unidadId);
  if (!unidad) return null;
  const id = genId("sc");
  db.prepare(`INSERT INTO stat_cards (id, nombre, tag, accent, bg, iso) VALUES (?, ?, ?, ?, ?, ?)`).run(
    id, nombre, tag || "", unidad.accent, unidad.head_bg, unidad.iso
  );
  return { id };
}

function deleteStatCard(id) {
  db.prepare("DELETE FROM stat_cards WHERE id = ?").run(id);
}

function createStatItem({ cardId, label, sub, color }) {
  const id = genId("si");
  // The "value" column is legacy — the displayed value is now computed from
  // stat_leads (see getStatCards), so it's just left blank here.
  db.prepare(`INSERT INTO stat_items (id, card_id, label, value, sub, color) VALUES (?, ?, ?, '', ?, ?)`).run(
    id, cardId, label, sub || "", color || "#475569"
  );
  return { id };
}

function deleteStatItem(id) {
  db.prepare("DELETE FROM stat_items WHERE id = ?").run(id);
}

function createStatLead({ itemId, empresa, nombre, fecha }) {
  const id = genId("sl");
  db.prepare(`INSERT INTO stat_leads (id, item_id, empresa, nombre, fecha) VALUES (?, ?, ?, ?, ?)`).run(
    id, itemId, empresa || "", nombre, fecha || ""
  );
  return { id };
}

function updateStatLead(id, { empresa, nombre, fecha, itemId }) {
  const result = db.prepare("UPDATE stat_leads SET empresa = ?, nombre = ?, fecha = ?, item_id = ? WHERE id = ?").run(
    empresa || "", nombre, fecha || "", itemId, id
  );
  return result.changes > 0;
}

function deleteStatLead(id) {
  db.prepare("DELETE FROM stat_leads WHERE id = ?").run(id);
}

function createNota({ accionId, texto }) {
  const id = genId("n");
  db.prepare(`INSERT INTO notas (id, accion_id, texto, hecho, created_at) VALUES (?, ?, ?, 0, ?)`).run(
    id, accionId, texto, new Date().toISOString()
  );
  return { id };
}

function setNotaHecho(id, hecho) {
  const result = db.prepare("UPDATE notas SET hecho = ? WHERE id = ?").run(hecho ? 1 : 0, id);
  return result.changes > 0;
}

module.exports = {
  getPlan,
  getStatCards,
  createUnidad,
  deleteUnidad,
  createProducto,
  deleteProducto,
  createObjetivo,
  deleteObjetivo,
  updateObjetivo,
  createAccion,
  deleteAccion,
  updateAccion,
  setEstado,
  createNota,
  setNotaHecho,
  createStatCard,
  deleteStatCard,
  createStatItem,
  deleteStatItem,
  createStatLead,
  updateStatLead,
  deleteStatLead,
};
