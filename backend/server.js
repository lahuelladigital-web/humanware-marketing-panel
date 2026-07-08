const path = require("node:path");
const express = require("express");
const { getAllEstados, setEstado } = require("./db");

const VALID_ESTADOS = new Set(["pendiente", "progreso", "hecho"]);
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());

app.get("/api/estados", (req, res) => {
  res.json(getAllEstados());
});

app.put("/api/estados/:id", (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  if (!VALID_ESTADOS.has(status)) {
    return res.status(400).json({ error: "status must be one of: pendiente, progreso, hecho" });
  }
  const saved = setEstado(id, status);
  res.json(saved);
});

app.use(express.static(path.join(__dirname, "..", "frontend")));

app.listen(PORT, () => {
  console.log(`Humanware marketing panel running at http://localhost:${PORT}`);
});
