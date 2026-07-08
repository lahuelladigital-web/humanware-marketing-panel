const path = require("node:path");
const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");

// DATA_DIR lets a persistent volume (e.g. Railway) be mounted outside the repo checkout;
// defaults to a local folder for development.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, "panel.sqlite"));

db.exec(`
  CREATE TABLE IF NOT EXISTS estados (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

function getAllEstados() {
  const rows = db.prepare("SELECT id, status FROM estados").all();
  const out = {};
  for (const row of rows) out[row.id] = row.status;
  return out;
}

const upsertStmt = db.prepare(`
  INSERT INTO estados (id, status, updated_at) VALUES (?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at
`);

function setEstado(id, status) {
  const updatedAt = new Date().toISOString();
  upsertStmt.run(id, status, updatedAt);
  return { id, status, updatedAt };
}

module.exports = { getAllEstados, setEstado };
