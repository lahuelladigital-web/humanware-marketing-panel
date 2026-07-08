const STATUS_LABEL = { pendiente: "Pendiente", progreso: "En progreso", hecho: "Hecho" };
const STATUS_ORDER = ["pendiente", "progreso", "hecho"];
const HORIZONTE_DOT = {
  "Corto plazo": "#1f9d63",
  "Mediano plazo": "#e0a020",
  "Largo plazo": "#8E2D9E",
  "Continuo": "#2f8ad0",
};
const DELETE_ENDPOINTS = {
  unidad: "unidades", producto: "productos", objetivo: "objetivos",
  accion: "acciones", statcard: "stat-cards", statitem: "stat-items",
};

const state = {
  plan: { unidades: [], statCards: [] },
  filter: "todas",
  product: null,
  expandedUnits: { grupo: false, didacta: true, oneclick: false, academy: false, consultoria: false },
  expandedObjs: {},
  today: new Set(),
  detail: null,
  modal: null,
  modalError: null,
};

function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Finds an acción anywhere in the plan regardless of the active filter — used by the
// "today" panel, status updates and the detail drawer, none of which should be limited
// to whatever unit happens to be visible right now.
function findAccionContext(accionId) {
  for (const unit of state.plan.unidades) {
    for (const o of unit.objetivos) {
      const a = o.acciones.find((x) => x.id === accionId);
      if (a) {
        const groupName = o.prod === "all" ? "Transversal" : (unit.productos.find((p) => p.id === o.prod)?.nombre || "");
        return { accion: a, unit, objetivo: o, groupName };
      }
    }
  }
  return null;
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

function loadToday() {
  try {
    state.today = new Set(JSON.parse(localStorage.getItem("hwgmkt.today") || "[]"));
  } catch (e) { /* ignore malformed local storage */ }
}

function saveToday() {
  try {
    localStorage.setItem("hwgmkt.today", JSON.stringify([...state.today]));
  } catch (e) { /* storage unavailable — the "today" marks just won't persist */ }
}

function toggleToday(id) {
  const next = new Set(state.today);
  if (next.has(id)) next.delete(id); else next.add(id);
  state.today = next;
  saveToday();
  render();
}

async function loadPlan() {
  try {
    const res = await fetch("api/plan");
    if (!res.ok) throw new Error("bad response " + res.status);
    state.plan = await res.json();
    if (state.filter !== "todas" && !state.plan.unidades.some((u) => u.id === state.filter)) {
      state.filter = "todas";
      state.product = null;
      saveUi();
    }
    // Drop "today" marks for acciones someone deleted in the meantime.
    const validIds = new Set();
    state.plan.unidades.forEach((u) => u.objetivos.forEach((o) => o.acciones.forEach((a) => validIds.add(a.id))));
    let prunedToday = false;
    state.today.forEach((id) => {
      if (!validIds.has(id)) { state.today.delete(id); prunedToday = true; }
    });
    if (prunedToday) saveToday();
    refreshDetailIfOpen();
  } catch (e) {
    console.warn("No se pudo cargar el plan desde el servidor.", e);
  }
  render();
}

async function apiRequest(method, url, body, extraHeaders) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...(extraHeaders || {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const j = await res.json();
      if (j.error) message = j.error;
    } catch (e) { /* non-JSON error body, keep the generic message */ }
    throw new Error(message);
  }
  return res.status === 204 ? null : res.json();
}

function createEntity(kind, ctx, data) {
  switch (kind) {
    case "add-unidad":
      return apiRequest("POST", "api/unidades", { nombre: data.nombre, tag: data.tag, sub: data.sub });
    case "add-producto":
      return apiRequest("POST", "api/productos", { unidadId: ctx.unidadId, nombre: data.nombre, tag: data.tag });
    case "add-objetivo":
      return apiRequest("POST", "api/objetivos", {
        unidadId: ctx.unidadId, prod: ctx.prod, titulo: data.titulo, horizonte: data.horizonte, meta: data.meta,
      });
    case "add-accion":
      return apiRequest("POST", "api/acciones", {
        objetivoId: ctx.objetivoId, titulo: data.titulo, responsable: data.responsable, plazo: data.plazo, canal: data.canal,
      });
    case "add-statcard":
      return apiRequest("POST", "api/stat-cards", { unidadId: data.unidadId, nombre: data.nombre, tag: data.tag });
    case "add-statitem":
      return apiRequest("POST", "api/stat-items", { cardId: ctx.cardId, label: data.label, value: data.value, sub: data.sub, color: data.color });
    default:
      return Promise.reject(new Error("Acción no reconocida."));
  }
}

function deleteEntity(type, id, password) {
  return apiRequest("DELETE", `api/${DELETE_ENDPOINTS[type]}/${encodeURIComponent(id)}`, null, { "x-admin-password": password });
}

async function persistEstado(id, status) {
  try {
    const res = await fetch(`api/acciones/${encodeURIComponent(id)}/estado`, {
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
  const ctx = findAccionContext(id);
  if (ctx) ctx.accion.status = status;
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

async function persistNota(id, hecho) {
  try {
    const res = await fetch(`api/notas/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hecho }),
    });
    if (!res.ok) throw new Error("bad response " + res.status);
  } catch (e) {
    console.warn("No se pudo guardar la bitácora en el servidor; el cambio quedó solo en esta pestaña.", e);
  }
}

function toggleNota(accionId, notaId, hecho) {
  const ctx = findAccionContext(accionId);
  const nota = ctx && ctx.accion.notas.find((n) => n.id === notaId);
  if (nota) nota.hecho = hecho;
  if (state.detail && state.detail.id === accionId) {
    state.detail = { ...state.detail, notas: ctx.accion.notas };
  }
  render();
  persistNota(notaId, hecho);
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
  const ctx = findAccionContext(actionId);
  if (!ctx) return;
  const { accion: a, unit, objetivo: o, groupName } = ctx;
  state.detail = {
    id: a.id, unitId: unit.id, unitName: unit.nombre, iso: unit.iso, accent: unit.accent, headBg: unit.headBg, chipBg: unit.chipBg,
    groupName, objetivo: o.titulo, meta: o.meta,
    texto: a.titulo, responsable: a.responsable, plazo: a.plazo, canal: a.canal, estado: a.status,
    notas: a.notas || [],
  };
  render();
}

function closeDetail() {
  state.detail = null;
  render();
}

// Keeps an open drawer in sync after loadPlan() refetches — a teammate may have
// added a bitácora entry or changed the status while you had it open.
function refreshDetailIfOpen() {
  if (!state.detail) return;
  const ctx = findAccionContext(state.detail.id);
  if (!ctx) { state.detail = null; return; }
  state.detail = { ...state.detail, estado: ctx.accion.status, notas: ctx.accion.notas || [] };
}

function formatFecha(iso) {
  try {
    return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  } catch (e) {
    return "";
  }
}

function openModal(kind, ctx) {
  state.modal = { kind, ...ctx };
  state.modalError = null;
  render();
}

function closeModal() {
  state.modal = null;
  state.modalError = null;
  render();
}

// ---------- rendering ----------

function renderHeaderProgress() {
  // Always global across every unit, regardless of the active filter —
  // "Avance del plan" reflects the whole plan, not just the current view.
  let done = 0, total = 0;
  state.plan.unidades.forEach((u) => u.objetivos.forEach((o) => o.acciones.forEach((a) => {
    total++;
    if (a.status === "hecho") done++;
  })));
  const pct = total ? Math.round((done / total) * 100) : 0;
  document.getElementById("overallLabel").textContent = `${pct}% · ${done}/${total} acciones`;
  document.getElementById("overallFill").style.width = pct + "%";
}

function buildGroups(unit, applyProductFilter, selectedProduct) {
  const trans = unit.objetivos.filter((o) => o.prod === "all");
  let groups = [{
    key: "trans", name: "Transversal de la unidad", tag: "", color: "#8493ab",
    objetivos: trans, empty: trans.length === 0,
    note: trans.length === 0 ? `Todavía no hay objetivos transversales para ${unit.nombre}.` : "",
  }];
  unit.productos.forEach((p) => {
    const objs = unit.objetivos.filter((o) => o.prod === p.id);
    groups.push({
      key: p.id, name: p.nombre, tag: p.tag, color: unit.accent,
      empty: objs.length === 0,
      note: objs.length === 0 ? (p.emptyNote || `${p.nombre} es un módulo complementario: aplica la estrategia general de ${unit.nombre}.`) : "",
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

function renderToday() {
  const el = document.getElementById("todayList");
  const entries = [...state.today].map((id) => findAccionContext(id)).filter(Boolean);
  if (entries.length === 0) {
    el.innerHTML = `<div class="today-empty">No tenés tareas marcadas para hoy. Tocá la ${"☆"} en cualquier acción para agregarla acá.</div>`;
    return;
  }
  el.innerHTML = entries.map(({ accion: a, unit, groupName }) => `
    <div class="today-row" data-status="${a.status}">
      <button class="status-pill" data-status="${a.status}" data-action="cycle-status" data-action-id="${a.id}" data-current="${a.status}" title="Cambiar estado">
        <span class="status-dot ${a.status}"></span>${STATUS_LABEL[a.status]}
      </button>
      <div class="today-body" data-action="open-detail" data-action-id="${a.id}">
        <div class="today-texto${a.status === "hecho" ? " done" : ""}">${esc(a.titulo)}</div>
        <div class="today-context">${esc(unit.nombre)} · ${esc(groupName)}</div>
      </div>
      <button class="icon-btn star active" data-action="toggle-today" data-action-id="${a.id}" title="Quitar de hoy">★</button>
    </div>
  `).join("");
}

function renderStats() {
  const cards = state.plan.statCards || [];
  const cardsHtml = cards.map((s) => `
    <div class="stat-card">
      <div class="stat-card-head" style="--bg:${s.bg}">
        <img class="stat-card-iso" src="${s.iso}" alt="">
        <div class="stat-card-name" style="--accent:${s.accent}">${esc(s.nombre)}</div>
        <div class="stat-card-tag">${esc(s.tag)}</div>
        <button class="icon-btn danger" data-action="open-modal" data-modal-kind="confirm-delete" data-entity-type="statcard" data-entity-id="${s.id}" data-entity-label="${esc(s.nombre)}" title="Borrar tarjeta">🗑</button>
      </div>
      <div class="stat-card-items">
        ${s.items.map((it) => `
          <div class="stat-item">
            <div class="stat-item-label">
              <span>${esc(it.label)}</span>
              <button class="icon-btn danger tiny" data-action="open-modal" data-modal-kind="confirm-delete" data-entity-type="statitem" data-entity-id="${it.id}" data-entity-label="${esc(it.label)}" title="Borrar ítem">×</button>
            </div>
            <div class="stat-item-value-row">
              <span class="stat-item-value" style="--value-color:${it.color}">${esc(it.value)}</span>
              <span class="stat-item-sub">${esc(it.sub)}</span>
            </div>
          </div>
        `).join("")}
        <div class="stat-item stat-item-add">
          <button class="text-btn" data-action="open-modal" data-modal-kind="add-statitem" data-card-id="${s.id}">+ Ítem</button>
        </div>
      </div>
    </div>
  `).join("");
  document.getElementById("statsGrid").innerHTML = cardsHtml + `
    <div class="stat-card stat-card-add">
      <button class="text-btn" data-action="open-modal" data-modal-kind="add-statcard">+ Tarjeta</button>
    </div>
  `;
}

function renderFilters() {
  const filters = [{ id: "todas", label: "Todas", dot: "#16242B" }, ...state.plan.unidades.map((u) => ({ id: u.id, label: u.nombre, dot: u.accent }))];
  const html = filters.map((f) => {
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
  const selUnit = single ? state.plan.unidades.find((u) => u.id === state.filter) : null;
  if (!selUnit || selUnit.productos.length === 0) {
    el.classList.remove("visible");
    el.innerHTML = "";
    return;
  }
  const chipDefs = [{ id: "", label: "Toda la unidad", tag: "" }, ...selUnit.productos.map((p) => ({ id: p.id, label: p.nombre, tag: p.tag }))];
  el.innerHTML = `
    <span class="product-row-label">Productos de ${esc(selUnit.nombre)}:</span>
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

function renderAccionRow(unit, a) {
  const status = a.status;
  const isToday = state.today.has(a.id);
  return `
    <div class="accion-row" data-status="${status}">
      <button class="status-pill" data-status="${status}" data-action="cycle-status" data-action-id="${a.id}" data-current="${status}" title="Cambiar estado">
        <span class="status-dot ${status}"></span>${STATUS_LABEL[status]}
      </button>
      <div class="accion-body" data-action="open-detail" data-action-id="${a.id}">
        <div class="accion-texto${status === "hecho" ? " done" : ""}">${esc(a.titulo)}</div>
        <div class="accion-chips">
          <span class="accion-chip">${esc(a.responsable)}</span>
          <span class="accion-chip">${esc(a.plazo)}</span>
          <span class="accion-chip canal">${esc(a.canal)}</span>
        </div>
      </div>
      <button class="accion-open-btn" data-action="open-detail" data-action-id="${a.id}" title="Ver detalle">›</button>
      <button class="icon-btn star${isToday ? " active" : ""}" data-action="toggle-today" data-action-id="${a.id}" title="${isToday ? "Quitar de hoy" : "Marcar para hoy"}">${isToday ? "★" : "☆"}</button>
      <button class="icon-btn danger" data-action="open-modal" data-modal-kind="confirm-delete" data-entity-type="accion" data-entity-id="${a.id}" data-entity-label="${esc(a.titulo)}" title="Borrar acción">🗑</button>
    </div>
  `;
}

function renderObjetivo(unit, o) {
  const expanded = !!state.expandedObjs[o.id];
  let done = 0;
  const accionesHtml = o.acciones.map((a) => {
    if (a.status === "hecho") done++;
    return renderAccionRow(unit, a);
  }).join("");
  const pct = o.acciones.length ? Math.round((done / o.acciones.length) * 100) : 0;
  const horizonteDot = HORIZONTE_DOT[o.horizonte] || "#94a3b8";
  const caretClass = expanded ? " open" : "";
  return `
    <div class="objetivo">
      <div class="objetivo-head" data-action="toggle-obj" data-obj-id="${o.id}">
        <div class="objetivo-top">
          <span class="horizonte-chip"><span class="horizonte-dot" style="--horizonte-dot:${horizonteDot}"></span>${esc(o.horizonte)}</span>
          <span class="objetivo-titulo">${esc(o.titulo)}</span>
          <button class="icon-btn danger" data-action="open-modal" data-modal-kind="confirm-delete" data-entity-type="objetivo" data-entity-id="${o.id}" data-entity-label="${esc(o.titulo)}" title="Borrar objetivo">🗑</button>
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
      ${expanded ? `
        <div class="acciones-list">
          ${accionesHtml}
          <button class="text-btn add-accion-btn" data-action="open-modal" data-modal-kind="add-accion" data-objetivo-id="${o.id}">+ Acción</button>
        </div>
      ` : ""}
    </div>
  `;
}

function renderGroup(unit, group) {
  const isProducto = group.key !== "trans";
  const objetivosHtml = group.empty
    ? `<div class="group-empty-note">${esc(group.note)}</div>`
    : group.objetivos.map((o) => renderObjetivo(unit, o)).join("");
  return `
    <div class="group">
      <div class="group-head">
        <span class="group-dot" style="--group-color:${group.color}"></span>
        <span class="group-name" style="--group-color:${group.color}">${esc(group.name)}</span>
        ${group.tag ? `<span class="group-tag">${esc(group.tag)}</span>` : ""}
        <span class="group-line"></span>
        ${isProducto ? `<button class="icon-btn danger" data-action="open-modal" data-modal-kind="confirm-delete" data-entity-type="producto" data-entity-id="${group.key}" data-entity-label="${esc(group.name)}" title="Borrar producto">🗑</button>` : ""}
      </div>
      ${objetivosHtml}
      <button class="text-btn" data-action="open-modal" data-modal-kind="add-objetivo" data-unidad-id="${unit.id}" data-prod="${isProducto ? group.key : "all"}">+ Objetivo${isProducto ? "" : " transversal"}</button>
    </div>
  `;
}

function renderUnit(unit, single) {
  const groups = buildGroups(unit, single, state.product);

  let uDone = 0, uTot = 0;
  groups.forEach((g) => g.objetivos.forEach((o) => o.acciones.forEach((a) => {
    uTot++;
    if (a.status === "hecho") uDone++;
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
          <span class="unit-name">${esc(unit.nombre)}</span>
          <span class="unit-tag" style="--chip-bg:${unit.chipBg}">${esc(unit.tag)}</span>
          <span class="unit-caret${caretClass}">⌄</span>
        </div>
        <div class="unit-sub">${esc(unit.sub)}</div>
        <div class="unit-progress-row">
          <div class="unit-progress-track"><div class="unit-progress-fill" style="width:${upct}%"></div></div>
          <div class="unit-progress-label">${uTot ? `${uDone}/${uTot}` : "Sin"} acciones</div>
        </div>
      </div>
      ${expanded ? `
        <div class="unit-body">
          <div class="unit-toolbar">
            <button class="text-btn" data-action="open-modal" data-modal-kind="add-producto" data-unidad-id="${unit.id}">+ Producto</button>
            <button class="text-btn danger" data-action="open-modal" data-modal-kind="confirm-delete" data-entity-type="unidad" data-entity-id="${unit.id}" data-entity-label="${esc(unit.nombre)}">🗑 Borrar unidad</button>
          </div>
          ${groups.map((g) => renderGroup(unit, g)).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function renderUnits() {
  const single = state.filter !== "todas";
  const vis = single ? state.plan.unidades.filter((u) => u.id === state.filter) : state.plan.unidades;
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
  const notas = d.notas || [];
  const notasHtml = notas.length
    ? notas.map((n) => `
        <label class="nota-row${n.hecho ? " done" : ""}">
          <input type="checkbox" data-action="toggle-nota" data-accion-id="${d.id}" data-nota-id="${n.id}" ${n.hecho ? "checked" : ""}>
          <span class="nota-texto">${esc(n.texto)}</span>
          <span class="nota-fecha">${formatFecha(n.createdAt)}</span>
        </label>
      `).join("")
    : `<div class="bitacora-empty">Sin entradas todavía.</div>`;
  panel.innerHTML = `
    <div class="drawer-head" style="--head-bg:${d.headBg}">
      <div class="drawer-head-top">
        <img class="drawer-iso" src="${d.iso}" alt="">
        <span class="drawer-unit-name" style="--accent:${d.accent}">${esc(d.unitName)}</span>
        <span class="drawer-group-chip" style="--accent:${d.accent};--chip-bg:${d.chipBg}">${esc(d.groupName)}</span>
        <button class="icon-btn star${state.today.has(d.id) ? " active" : ""}" data-action="toggle-today" data-action-id="${d.id}" title="${state.today.has(d.id) ? "Quitar de hoy" : "Marcar para hoy"}">${state.today.has(d.id) ? "★" : "☆"}</button>
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
      <div class="drawer-label drawer-bitacora-label">Bitácora</div>
      <div class="bitacora-list">${notasHtml}</div>
      <form id="notaForm" class="bitacora-form" data-accion-id="${d.id}">
        <input type="text" name="texto" placeholder="Agregar una entrada..." required>
        <button type="submit" class="btn btn-primary">Agregar</button>
      </form>
    </div>
  `;
  overlay.classList.add("visible");
}

function renderModal() {
  const overlay = document.getElementById("modalOverlay");
  const box = document.getElementById("modalBox");
  const m = state.modal;
  if (!m) {
    overlay.classList.remove("visible");
    box.innerHTML = "";
    return;
  }

  const errorHtml = state.modalError ? `<div class="modal-error">${esc(state.modalError)}</div>` : "";
  let title = "";
  let fields = "";
  let submitLabel = "Guardar";
  let danger = false;

  switch (m.kind) {
    case "add-unidad":
      title = "Nueva unidad de negocio";
      fields = `
        <label class="form-field">Nombre<input name="nombre" required autofocus></label>
        <label class="form-field">Tag corto<input name="tag" placeholder="Ej: Educación"></label>
        <label class="form-field">Descripción<input name="sub" placeholder="Ej: Gestión académica..."></label>
      `;
      break;
    case "add-producto":
      title = "Nuevo producto";
      fields = `
        <label class="form-field">Nombre<input name="nombre" required autofocus></label>
        <label class="form-field">Tag corto<input name="tag" placeholder="Ej: SGRs"></label>
      `;
      break;
    case "add-objetivo":
      title = m.prod === "all" ? "Nuevo objetivo transversal" : "Nuevo objetivo";
      fields = `
        <label class="form-field">Título<input name="titulo" required autofocus></label>
        <label class="form-field">Horizonte
          <select name="horizonte">
            <option>Corto plazo</option>
            <option>Mediano plazo</option>
            <option>Largo plazo</option>
            <option>Continuo</option>
          </select>
        </label>
        <label class="form-field">Meta<input name="meta" placeholder="Ej: 3 demos / mes"></label>
      `;
      break;
    case "add-accion":
      title = "Nueva acción";
      fields = `
        <label class="form-field">Título<textarea name="titulo" required autofocus></textarea></label>
        <label class="form-field">Responsable<input name="responsable" placeholder="Ej: Mkt Didacta"></label>
        <label class="form-field">Plazo<input name="plazo" placeholder="Ej: Mensual"></label>
        <label class="form-field">Canal<input name="canal" placeholder="Ej: LinkedIn"></label>
      `;
      break;
    case "add-statcard":
      title = "Nueva tarjeta de pipeline";
      fields = `
        <label class="form-field">Unidad
          <select name="unidadId" required>
            ${state.plan.unidades.map((u) => `<option value="${u.id}">${esc(u.nombre)}</option>`).join("")}
          </select>
        </label>
        <label class="form-field">Nombre a mostrar<input name="nombre" required></label>
        <label class="form-field">Tag corto<input name="tag" placeholder="Ej: meta 3 demos/mes"></label>
      `;
      break;
    case "add-statitem":
      title = "Nuevo ítem de la tarjeta";
      fields = `
        <label class="form-field">Etiqueta<input name="label" required autofocus placeholder="Ej: Demos realizadas"></label>
        <label class="form-field">Valor<input name="value" required placeholder="Ej: 3"></label>
        <label class="form-field">Subtexto<input name="sub" placeholder="Ej: / 5"></label>
        <label class="form-field">Color
          <select name="color">
            <option value="#1f9d63">Verde</option>
            <option value="#FF8000">Naranja</option>
            <option value="#2f8ad0">Azul</option>
            <option value="#b7791f">Ámbar</option>
            <option value="#16242B">Gris oscuro</option>
          </select>
        </label>
      `;
      break;
    case "confirm-delete": {
      danger = true;
      submitLabel = "Borrar";
      title = `¿Borrar "${m.entityLabel}"?`;
      const cascadeNote = {
        unidad: " y va a borrar también sus productos, objetivos y acciones.",
        producto: " y va a borrar también los objetivos y acciones de este producto.",
        objetivo: " y va a borrar también sus acciones.",
      }[m.entityType] || ".";
      fields = `
        <p class="modal-warning">Esta acción no se puede deshacer${cascadeNote}</p>
        <label class="form-field">Contraseña<input type="password" name="password" required autofocus></label>
      `;
      break;
    }
  }

  box.innerHTML = `
    <div class="modal-head">
      <span class="modal-title">${esc(title)}</span>
      <button class="drawer-close" data-action="close-modal" title="Cerrar">×</button>
    </div>
    <form id="modalForm" class="modal-form">
      ${errorHtml}
      ${fields}
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-action="close-modal">Cancelar</button>
        <button type="submit" class="btn ${danger ? "btn-danger" : "btn-primary"}">${submitLabel}</button>
      </div>
    </form>
  `;
  overlay.classList.add("visible");

  const pwInput = box.querySelector('input[name="password"]');
  if (pwInput) {
    const cached = sessionStorage.getItem("hwgmkt.adminPw");
    if (cached) pwInput.value = cached;
  }
}

function render() {
  renderHeaderProgress();
  renderToday();
  renderStats();
  renderFilters();
  renderProductRow();
  renderUnits();
  renderDrawer();
  renderModal();
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
    case "toggle-today":
      e.stopPropagation();
      toggleToday(target.dataset.actionId);
      break;
    case "open-modal":
      e.stopPropagation();
      openModal(target.dataset.modalKind, { ...target.dataset });
      break;
    case "close-modal":
      closeModal();
      break;
  }
});

document.addEventListener("submit", async (e) => {
  if (e.target.id === "notaForm") {
    e.preventDefault();
    const accionId = e.target.dataset.accionId;
    const texto = new FormData(e.target).get("texto");
    if (!texto || !texto.trim()) return;
    try {
      await apiRequest("POST", "api/notas", { accionId, texto: texto.trim() });
      await loadPlan();
    } catch (err) {
      console.warn("No se pudo guardar la entrada de la bitácora.", err);
    }
    return;
  }
  if (e.target.id !== "modalForm") return;
  e.preventDefault();
  const m = state.modal;
  if (!m) return;
  const data = Object.fromEntries(new FormData(e.target).entries());
  try {
    if (m.kind === "confirm-delete") {
      await deleteEntity(m.entityType, m.entityId, data.password);
      try { sessionStorage.setItem("hwgmkt.adminPw", data.password); } catch (err) { /* storage unavailable */ }
    } else {
      await createEntity(m.kind, m, data);
    }
    closeModal();
    await loadPlan();
  } catch (err) {
    state.modalError = err.message || "Ocurrió un error.";
    render();
  }
});

document.addEventListener("change", (e) => {
  const target = e.target.closest('[data-action="toggle-nota"]');
  if (!target) return;
  toggleNota(target.dataset.accionId, target.dataset.notaId, target.checked);
});

document.getElementById("drawerOverlay").addEventListener("click", (e) => {
  if (e.target.id === "drawerOverlay") closeDetail();
});

document.getElementById("modalOverlay").addEventListener("click", (e) => {
  if (e.target.id === "modalOverlay") closeModal();
});

// Keep the shared plan in sync with teammates without needing a manual refresh.
// Skipped while a modal is open so it doesn't wipe out an in-progress form.
setInterval(() => { if (!state.modal) loadPlan(); }, 20000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && !state.modal) loadPlan();
});

loadUi();
loadToday();
render();
loadPlan();
