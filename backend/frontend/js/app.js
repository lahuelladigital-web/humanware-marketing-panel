import { UNITS, PIPELINE_STATS, FILTERS, HORIZONTE_DOT } from "./data.js";

const STATUS_LABEL = { pendiente: "Pendiente", progreso: "En progreso", hecho: "Hecho" };
const STATUS_ORDER = ["pendiente", "progreso", "hecho"];

const state = {
  estados: {},
  filter: "todas",
  product: null,
  expandedUnits: { grupo: false, didacta: true, oneclick: false, academy: false, consultoria: false },
  expandedObjs: {},
  detail: null,
};

// Maps action id -> full payload needed to open the detail drawer. Rebuilt on every render().
let actionIndex = new Map();

function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function loadUi() {
  try {
    const ui = JSON.parse(localStorage.getItem("hwgmkt.ui") || "{}");
    if (ui.filter) state.filter = ui.filter;
    if ("product" in ui) state.product = ui.product;
    if (ui.expandedUnits) state.expandedUnits = ui.expandedUnits;
    if (ui.expandedObjs) state.expandedObjs = ui.expandedObjs;
  } catch (e) { /* ignore malformed local storage */ }
}

function saveUi() {
  try {
    localStorage.setItem("hwgmkt.ui", JSON.stringify({
      filter: state.filter, product: state.product,
      expandedUnits: state.expandedUnits, expandedObjs: state.expandedObjs,
    }));
  } catch (e) { /* storage unavailable (private mode, quota) — UI state just won't persist */ }
}

async function loadEstados() {
  try {
    const res = await fetch("api/estados");
    if (!res.ok) throw new Error("bad response " + res.status);
    state.estados = await res.json();
  } catch (e) {
    console.warn("No se pudo cargar el estado compartido desde el servidor; se muestran los valores por defecto.", e);
  }
  render();
}

async function persistEstado(id, status) {
  try {
    const res = await fetch(`api/estados/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error("bad response " + res.status);
  } catch (e) {
    console.warn("No se pudo guardar el estado en el servidor; el cambio quedó solo en esta pestaña.", e);
  }
}

function setEstado(id, status) {
  state.estados = { ...state.estados, [id]: status };
  if (state.detail && state.detail.id === id) {
    state.detail = { ...state.detail, estado: status };
  }
  render();
  persistEstado(id, status);
}

function cycleEstado(id, current) {
  const next = STATUS_ORDER[(STATUS_ORDER.indexOf(current) + 1) % STATUS_ORDER.length];
  setEstado(id, next);
}

function toggleUnit(id) {
  state.expandedUnits = { ...state.expandedUnits, [id]: !state.expandedUnits[id] };
  saveUi();
  render();
}

function toggleObj(id) {
  state.expandedObjs = { ...state.expandedObjs, [id]: !state.expandedObjs[id] };
  saveUi();
  render();
}

function setFilter(f) {
  state.filter = f;
  state.product = null;
  saveUi();
  render();
}

function setProduct(p) {
  state.product = p || null;
  saveUi();
  render();
}

function openDetail(actionId) {
  const info = actionIndex.get(actionId);
  if (!info) return;
  state.detail = { ...info, id: actionId, estado: state.estados[actionId] ?? info.def };
  render();
}

function closeDetail() {
  state.detail = null;
  render();
}

function effectiveStatus(id, def) {
  return state.estados[id] ?? def;
}

// ---------- rendering ----------

function renderHeaderProgress() {
  // Always global across every unit, regardless of the active filter —
  // "Avance del plan" reflects the whole plan, not just the current view.
  let done = 0, total = 0;
  UNITS.forEach((u) => {
    const groups = buildGroups(u, false, null);
    groups.forEach((g) => g.objetivos.forEach((o, oi) => o.acciones.forEach((a, ai) => {
      total++;
      const id = `${u.id}|${g.key}|${oi}|${ai}`;
      if (effectiveStatus(id, a.def) === "hecho") done++;
    })));
  });
  const pct = total ? Math.round((done / total) * 100) : 0;
  document.getElementById("overallLabel").textContent = `${pct}% · ${done}/${total} acciones`;
  document.getElementById("overallFill").style.width = pct + "%";
}

function buildGroups(unit, applyProductFilter, selectedProduct) {
  const trans = unit.objetivos.filter((o) => o.prod === "all");
  let groups = trans.length
    ? [{ key: "trans", name: "Transversal de la unidad", tag: "", color: "#8493ab", objetivos: trans, empty: false, note: "" }]
    : [];
  unit.productos.forEach((p) => {
    const objs = unit.objetivos.filter((o) => o.prod === p.id);
    groups.push({
      key: p.id, name: p.name, tag: p.tag, color: unit.accent,
      empty: objs.length === 0,
      note: objs.length === 0 ? (p.emptyNote || `${p.name} es un módulo complementario: aplica la estrategia general de ${unit.name}.`) : "",
      objetivos: objs,
    });
  });
  if (applyProductFilter && selectedProduct) {
    const prodGroup = groups.filter((g) => g.key === selectedProduct);
    const transGroup = groups.filter((g) => g.key === "trans");
    groups = [...prodGroup, ...transGroup];
  }
  return groups;
}

function renderStats() {
  const html = PIPELINE_STATS.map((s) => `
    <div class="stat-card">
      <div class="stat-card-head" style="--bg:${s.bg}">
        <img class="stat-card-iso" src="${s.iso}" alt="">
        <div class="stat-card-name" style="--accent:${s.accent}">${esc(s.name)}</div>
        <div class="stat-card-tag">${esc(s.tag)}</div>
      </div>
      <div class="stat-card-items">
        ${s.items.map((it) => `
          <div class="stat-item">
            <div class="stat-item-label">${esc(it.label)}</div>
            <div class="stat-item-value-row">
              <span class="stat-item-value" style="--value-color:${it.color}">${esc(it.value)}</span>
              <span class="stat-item-sub">${esc(it.sub)}</span>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `).join("");
  document.getElementById("statsGrid").innerHTML = html;
}

function renderFilters() {
  const html = FILTERS.map((f) => {
    const active = state.filter === f.id;
    return `
      <button class="filter-btn${active ? " active" : ""}" data-action="set-filter" data-filter-id="${f.id}">
        <span class="filter-dot" style="--dot:${f.dot}"></span>${esc(f.label)}
      </button>
    `;
  }).join("");
  document.getElementById("filtersList").innerHTML = html;
}

function renderProductRow() {
  const el = document.getElementById("productRow");
  const single = state.filter !== "todas";
  const selUnit = single ? UNITS.find((u) => u.id === state.filter) : null;
  if (!selUnit || selUnit.productos.length === 0) {
    el.classList.remove("visible");
    el.innerHTML = "";
    return;
  }
  const chipDefs = [{ id: "", label: "Toda la unidad", tag: "" }, ...selUnit.productos.map((p) => ({ id: p.id, label: p.name, tag: p.tag }))];
  el.innerHTML = `
    <span class="product-row-label">Productos de ${esc(selUnit.name)}:</span>
    ${chipDefs.map((c) => {
      const active = (state.product || "") === c.id;
      return `
        <button class="product-chip${active ? " active" : ""}" style="--accent:${selUnit.accent}" data-action="set-product" data-product-id="${c.id}">
          ${esc(c.label)}<span class="product-chip-tag">${esc(c.tag)}</span>
        </button>
      `;
    }).join("")}
  `;
  el.classList.add("visible");
}

function renderAccionRow(unit, group, objId, objTitulo, objMeta, a, ai) {
  const id = `${objId}|${ai}`;
  const status = effectiveStatus(id, a.def);
  const groupDisplayName = group.key === "trans" ? "Transversal" : group.name;
  actionIndex.set(id, {
    unitId: unit.id, unitName: unit.name, iso: unit.iso, accent: unit.accent, headBg: unit.headBg, chipBg: unit.chipBg,
    groupName: groupDisplayName, objetivo: objTitulo, meta: objMeta,
    texto: a.t, responsable: a.r, plazo: a.p, canal: a.c, def: a.def,
  });
  return `
    <div class="accion-row" data-status="${status}">
      <button class="status-pill" data-status="${status}" data-action="cycle-status" data-action-id="${id}" data-current="${status}" title="Cambiar estado">
        <span class="status-dot ${status}"></span>${STATUS_LABEL[status]}
      </button>
      <div class="accion-body" data-action="open-detail" data-action-id="${id}">
        <div class="accion-texto${status === "hecho" ? " done" : ""}">${esc(a.t)}</div>
        <div class="accion-chips">
          <span class="accion-chip">${esc(a.r)}</span>
          <span class="accion-chip">${esc(a.p)}</span>
          <span class="accion-chip canal">${esc(a.c)}</span>
        </div>
      </div>
      <button class="accion-open-btn" data-action="open-detail" data-action-id="${id}" title="Ver detalle">›</button>
    </div>
  `;
}

function renderObjetivo(unit, group, o, oi) {
  const objId = `${unit.id}|${group.key}|${oi}`;
  const expanded = !!state.expandedObjs[objId];
  let done = 0;
  const accionesHtml = o.acciones.map((a, ai) => {
    const id = `${objId}|${ai}`;
    if (effectiveStatus(id, a.def) === "hecho") done++;
    return renderAccionRow(unit, group, objId, o.titulo, o.meta, a, ai);
  }).join("");
  const pct = o.acciones.length ? Math.round((done / o.acciones.length) * 100) : 0;
  const horizonteDot = HORIZONTE_DOT[o.horizonte] || "#94a3b8";
  const caretClass = expanded ? " open" : "";
  return `
    <div class="objetivo">
      <div class="objetivo-head" data-action="toggle-obj" data-obj-id="${objId}">
        <div class="objetivo-top">
          <span class="horizonte-chip"><span class="horizonte-dot" style="--horizonte-dot:${horizonteDot}"></span>${esc(o.horizonte)}</span>
          <span class="objetivo-titulo">${esc(o.titulo)}</span>
          <span class="objetivo-caret${caretClass}">⌄</span>
        </div>
        <div class="objetivo-meta-row">
          <span class="objetivo-meta">Meta: <strong>${esc(o.meta)}</strong></span>
          <div class="objetivo-progress">
            <div class="objetivo-progress-track"><div class="objetivo-progress-fill" style="--accent:${unit.accent};width:${pct}%"></div></div>
            <span class="objetivo-progress-label">${done}/${o.acciones.length}</span>
          </div>
        </div>
        <div class="objetivo-hint" style="--accent:${unit.accent}">
          <span class="objetivo-hint-caret${caretClass}">⌄</span>${expanded ? "Ocultar acciones" : `Ver ${o.acciones.length} acciones`}
        </div>
      </div>
      ${expanded ? `<div class="acciones-list">${accionesHtml}</div>` : ""}
    </div>
  `;
}

function renderGroup(unit, group) {
  const objetivosHtml = group.empty
    ? `<div class="group-empty-note">${esc(group.note)}</div>`
    : group.objetivos.map((o, oi) => renderObjetivo(unit, group, o, oi)).join("");
  return `
    <div class="group">
      <div class="group-head">
        <span class="group-dot" style="--group-color:${group.color}"></span>
        <span class="group-name" style="--group-color:${group.color}">${esc(group.name)}</span>
        ${group.tag ? `<span class="group-tag">${esc(group.tag)}</span>` : ""}
        <span class="group-line"></span>
      </div>
      ${objetivosHtml}
    </div>
  `;
}

function renderUnit(unit, single) {
  const groups = buildGroups(unit, single, state.product);

  let uDone = 0, uTot = 0;
  groups.forEach((g, gi) => g.objetivos.forEach((o, oi) => o.acciones.forEach((a, ai) => {
    const id = `${unit.id}|${g.key}|${oi}|${ai}`;
    uTot++;
    if (effectiveStatus(id, a.def) === "hecho") uDone++;
  })));

  const expanded = single ? true : !!state.expandedUnits[unit.id];
  const upct = uTot ? Math.round((uDone / uTot) * 100) : 0;
  const spanFull = unit.root || single;
  const caretClass = expanded ? " open" : "";

  return `
    <div class="unit-card${spanFull ? " span-full" : ""}">
      <div class="unit-head" style="--head-bg:${unit.headBg};--head-border:${unit.headBorder};--accent:${unit.accent}" data-action="${single ? "" : "toggle-unit"}" data-unit="${unit.id}">
        <div class="unit-head-bar"></div>
        <div class="unit-head-top">
          <img class="unit-iso" src="${unit.iso}" alt="">
          <span class="unit-name">${esc(unit.name)}</span>
          <span class="unit-tag" style="--chip-bg:${unit.chipBg}">${esc(unit.tag)}</span>
          <span class="unit-caret${caretClass}">⌄</span>
        </div>
        <div class="unit-sub">${esc(unit.sub)}</div>
        <div class="unit-progress-row">
          <div class="unit-progress-track"><div class="unit-progress-fill" style="width:${upct}%"></div></div>
          <div class="unit-progress-label">${uTot ? `${uDone}/${uTot}` : "Sin"} acciones</div>
        </div>
      </div>
      ${expanded ? `<div class="unit-body">${groups.map((g) => renderGroup(unit, g)).join("")}</div>` : ""}
    </div>
  `;
}

function renderUnits() {
  const single = state.filter !== "todas";
  const vis = single ? UNITS.filter((u) => u.id === state.filter) : UNITS;
  document.getElementById("unitsGrid").innerHTML = vis.map((u) => renderUnit(u, single)).join("");
}

function renderDrawer() {
  const overlay = document.getElementById("drawerOverlay");
  const panel = document.getElementById("drawerPanel");
  const d = state.detail;
  if (!d) {
    overlay.classList.remove("visible");
    panel.innerHTML = "";
    return;
  }
  const estadoBtns = STATUS_ORDER.map((val) => {
    const active = d.estado === val;
    return `
      <button class="estado-btn${active ? " active" : ""}" data-status="${val}" data-action="set-status" data-action-id="${d.id}">
        <span class="estado-btn-dot ${val}"></span>${STATUS_LABEL[val]}
      </button>
    `;
  }).join("");
  panel.innerHTML = `
    <div class="drawer-head" style="--head-bg:${d.headBg}">
      <div class="drawer-head-top">
        <img class="drawer-iso" src="${d.iso}" alt="">
        <span class="drawer-unit-name" style="--accent:${d.accent}">${esc(d.unitName)}</span>
        <span class="drawer-group-chip" style="--accent:${d.accent};--chip-bg:${d.chipBg}">${esc(d.groupName)}</span>
        <button class="drawer-close" data-action="close-detail" title="Cerrar">×</button>
      </div>
      <div class="drawer-label drawer-objetivo-label">Objetivo</div>
      <div class="drawer-objetivo-text">${esc(d.objetivo)}</div>
    </div>
    <div class="drawer-body">
      <div class="drawer-label">Acción</div>
      <div class="drawer-accion-text">${esc(d.texto)}</div>
      <div class="drawer-info-grid">
        <div class="drawer-info-card"><div class="drawer-info-label">Responsable</div><div class="drawer-info-value">${esc(d.responsable)}</div></div>
        <div class="drawer-info-card"><div class="drawer-info-label">Plazo</div><div class="drawer-info-value">${esc(d.plazo)}</div></div>
        <div class="drawer-info-card"><div class="drawer-info-label">Canal</div><div class="drawer-info-value">${esc(d.canal)}</div></div>
        <div class="drawer-info-card"><div class="drawer-info-label">Meta del objetivo</div><div class="drawer-info-value">${esc(d.meta)}</div></div>
      </div>
      <div class="drawer-label drawer-estado-label">Estado</div>
      <div class="drawer-estado-row">${estadoBtns}</div>
      <div class="drawer-nota">Acción del canal ${esc(d.canal)}. Contribuye al objetivo "${esc(d.objetivo)}" (meta: ${esc(d.meta)}). Tocá un estado para actualizar el avance; se guarda para todo el equipo.</div>
    </div>
  `;
  overlay.classList.add("visible");
}

function render() {
  actionIndex = new Map();
  renderHeaderProgress();
  renderStats();
  renderFilters();
  renderProductRow();
  renderUnits();
  renderDrawer();
}

// ---------- event delegation ----------

document.addEventListener("click", (e) => {
  const target = e.target.closest("[data-action]");
  if (!target || !target.dataset.action) return;
  switch (target.dataset.action) {
    case "toggle-unit":
      toggleUnit(target.dataset.unit);
      break;
    case "toggle-obj":
      toggleObj(target.dataset.objId);
      break;
    case "cycle-status":
      e.stopPropagation();
      cycleEstado(target.dataset.actionId, target.dataset.current);
      break;
    case "open-detail":
      openDetail(target.dataset.actionId);
      break;
    case "set-filter":
      setFilter(target.dataset.filterId);
      break;
    case "set-product":
      setProduct(target.dataset.productId);
      break;
    case "set-status":
      setEstado(target.dataset.actionId, target.dataset.status);
      break;
    case "close-detail":
      closeDetail();
      break;
  }
});

document.getElementById("drawerOverlay").addEventListener("click", (e) => {
  if (e.target.id === "drawerOverlay") closeDetail();
});

// Keep the shared status in sync with teammates without needing a manual refresh.
setInterval(loadEstados, 20000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") loadEstados();
});

loadUi();
render();
loadEstados();
