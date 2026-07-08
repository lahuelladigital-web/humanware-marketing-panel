const STATUS_LABEL = { pendiente: "Pendiente", progreso: "En progreso", hecho: "Hecho" };

const REPORTS = [
  { id: "fechas", label: "Acciones entre fechas" },
  { id: "objetivos", label: "Objetivos por unidad" },
  { id: "responsable", label: "Acciones por responsable" },
  { id: "progreso", label: "Progreso por unidad" },
  { id: "bitacora", label: "Bitácora reciente" },
];

const state = {
  plan: { unidades: [] },
  activeReport: "fechas",
  dateFrom: "",
  dateTo: "",
};

function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function formatFecha(iso) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  } catch (e) {
    return "—";
  }
}

async function loadPlan() {
  try {
    const res = await fetch("api/plan");
    if (!res.ok) throw new Error("bad response " + res.status);
    state.plan = await res.json();
  } catch (e) {
    console.warn("No se pudo cargar el plan desde el servidor.", e);
  }
  render();
}

// Flattens the plan into one row per acción, each carrying its unidad/objetivo for context.
function allAcciones() {
  const rows = [];
  state.plan.unidades.forEach((u) => u.objetivos.forEach((o) => o.acciones.forEach((a) => {
    rows.push({ ...a, unidad: u, objetivo: o });
  })));
  return rows;
}

function statusChip(status) {
  return `<span class="reporte-status ${status}">${STATUS_LABEL[status] || status}</span>`;
}

function renderFechas() {
  const from = state.dateFrom ? new Date(state.dateFrom) : null;
  const to = state.dateTo ? new Date(state.dateTo + "T23:59:59") : null;
  const rows = allAcciones()
    .filter((a) => a.updatedAt)
    .filter((a) => {
      const d = new Date(a.updatedAt);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    })
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  return `
    <div class="reportes-filters">
      <label>Desde <input type="date" id="dateFrom" value="${state.dateFrom}"></label>
      <label>Hasta <input type="date" id="dateTo" value="${state.dateTo}"></label>
    </div>
    <table class="reportes-table">
      <thead><tr><th>Última actualización</th><th>Unidad</th><th>Objetivo</th><th>Acción</th><th>Responsable</th><th>Estado</th></tr></thead>
      <tbody>
        ${rows.length ? rows.map((a) => `
          <tr>
            <td>${formatFecha(a.updatedAt)}</td>
            <td>${esc(a.unidad.nombre)}</td>
            <td>${esc(a.objetivo.titulo)}</td>
            <td>${esc(a.titulo)}</td>
            <td>${esc(a.responsable)}</td>
            <td>${statusChip(a.status)}</td>
          </tr>
        `).join("") : `<tr><td colspan="6" class="reportes-empty">No hay acciones en ese rango.</td></tr>`}
      </tbody>
    </table>
  `;
}

function renderObjetivosPorUnidad() {
  const groups = state.plan.unidades
    .filter((u) => u.objetivos.length > 0)
    .map((u) => `
      <div class="reporte-group">
        <div class="reporte-group-title" style="--accent:${u.accent}">${esc(u.nombre)}</div>
        <table class="reportes-table">
          <thead><tr><th>Objetivo</th><th>Horizonte</th><th>Meta</th><th>Progreso</th></tr></thead>
          <tbody>
            ${u.objetivos.map((o) => {
              const done = o.acciones.filter((a) => a.status === "hecho").length;
              const pct = o.acciones.length ? Math.round((done / o.acciones.length) * 100) : 0;
              return `
                <tr>
                  <td>${esc(o.titulo)}</td>
                  <td>${esc(o.horizonte)}</td>
                  <td>${esc(o.meta)}</td>
                  <td>${done}/${o.acciones.length} (${pct}%)</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `);
  return groups.join("") || `<div class="reportes-empty">No hay objetivos cargados.</div>`;
}

function renderPorResponsable() {
  const map = new Map();
  allAcciones().forEach((a) => {
    const key = (a.responsable || "").trim() || "Sin asignar";
    if (!map.has(key)) map.set(key, { pendiente: 0, progreso: 0, hecho: 0, total: 0 });
    const entry = map.get(key);
    entry[a.status] = (entry[a.status] || 0) + 1;
    entry.total++;
  });
  const rows = [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  return `
    <table class="reportes-table">
      <thead><tr><th>Responsable</th><th>Total</th><th>Pendiente</th><th>En progreso</th><th>Hecho</th></tr></thead>
      <tbody>
        ${rows.length ? rows.map(([nombre, c]) => `
          <tr>
            <td>${esc(nombre)}</td>
            <td>${c.total}</td>
            <td>${c.pendiente || 0}</td>
            <td>${c.progreso || 0}</td>
            <td>${c.hecho || 0}</td>
          </tr>
        `).join("") : `<tr><td colspan="5" class="reportes-empty">No hay acciones cargadas.</td></tr>`}
      </tbody>
    </table>
  `;
}

function renderProgresoPorUnidad() {
  return `
    <table class="reportes-table">
      <thead><tr><th>Unidad</th><th>Total</th><th>Pendiente</th><th>En progreso</th><th>Hecho</th><th>% Avance</th></tr></thead>
      <tbody>
        ${state.plan.unidades.map((u) => {
          let pendiente = 0, progreso = 0, hecho = 0;
          u.objetivos.forEach((o) => o.acciones.forEach((a) => {
            if (a.status === "pendiente") pendiente++;
            else if (a.status === "progreso") progreso++;
            else if (a.status === "hecho") hecho++;
          }));
          const total = pendiente + progreso + hecho;
          const pct = total ? Math.round((hecho / total) * 100) : 0;
          return `
            <tr>
              <td>${esc(u.nombre)}</td>
              <td>${total}</td>
              <td>${pendiente}</td>
              <td>${progreso}</td>
              <td>${hecho}</td>
              <td>${pct}%</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

function renderBitacoraReciente() {
  const rows = [];
  allAcciones().forEach((a) => {
    (a.notas || []).forEach((n) => rows.push({ ...n, unidad: a.unidad, accion: a }));
  });
  rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const LIMIT = 100;
  const limited = rows.slice(0, LIMIT);
  return `
    ${rows.length > LIMIT ? `<div class="reportes-note">Mostrando las ${LIMIT} entradas más recientes de ${rows.length}.</div>` : ""}
    <table class="reportes-table">
      <thead><tr><th>Fecha</th><th>Unidad</th><th>Acción</th><th>Entrada</th><th>Hecho</th></tr></thead>
      <tbody>
        ${limited.length ? limited.map((n) => `
          <tr>
            <td>${formatFecha(n.createdAt)}</td>
            <td>${esc(n.unidad.nombre)}</td>
            <td>${esc(n.accion.titulo)}</td>
            <td>${esc(n.texto)}</td>
            <td>${n.hecho ? "✓" : ""}</td>
          </tr>
        `).join("") : `<tr><td colspan="5" class="reportes-empty">No hay entradas de bitácora todavía.</td></tr>`}
      </tbody>
    </table>
  `;
}

const RENDERERS = {
  fechas: renderFechas,
  objetivos: renderObjetivosPorUnidad,
  responsable: renderPorResponsable,
  progreso: renderProgresoPorUnidad,
  bitacora: renderBitacoraReciente,
};

function renderTabs() {
  document.getElementById("reportesTabs").innerHTML = REPORTS.map((r) => `
    <button class="reporte-tab-btn${state.activeReport === r.id ? " active" : ""}" data-report-id="${r.id}">${esc(r.label)}</button>
  `).join("");
}

function renderContent() {
  document.getElementById("reportesContent").innerHTML = RENDERERS[state.activeReport]();
}

function render() {
  renderTabs();
  renderContent();
}

document.addEventListener("click", (e) => {
  const tabBtn = e.target.closest(".reporte-tab-btn");
  if (!tabBtn) return;
  state.activeReport = tabBtn.dataset.reportId;
  render();
});

document.addEventListener("change", (e) => {
  if (e.target.id === "dateFrom") {
    state.dateFrom = e.target.value;
    renderContent();
  } else if (e.target.id === "dateTo") {
    state.dateTo = e.target.value;
    renderContent();
  }
});

loadPlan();
