// One-time seed content for the database, migrated from the original static
// frontend/js/data.js. Only used by db.js the first time the app boots
// against an empty database — after that, everything lives in SQLite and
// this file is never read again.

function accion(t, r, p, c, def) {
  return { t, r, p, c, def };
}

function objetivo(titulo, horizonte, meta, prod, acciones) {
  return { titulo, horizonte, meta, prod, acciones };
}

const UNITS = [
  {
    id: "grupo",
    root: true,
    name: "Humanware Group",
    tag: "Transversal",
    iso: "assets/icon-color.png",
    sub: "Marca paraguas · canales y procesos compartidos",
    accent: "#8E2D9E",
    headBg: "#f7eef9",
    headBorder: "#ecdcf1",
    chipBg: "#efe0f4",
    productos: [],
    objetivos: [
      objetivo("Sistematizar LinkedIn orgánico y outreach", "Corto plazo", "Cadencia documentada", "all", [
        accion("Documentar la cadencia de contenido y comentarios que ya se ejecuta", "Mkt Grupo", "Q3 2026", "LinkedIn", "progreso"),
        accion("Formalizar el proceso de outreach en 5 pasos (identificar → conectar → abrir → nutrir → reunión)", "Mkt Grupo", "Q3 2026", "LinkedIn", "progreso"),
        accion("Rotar 3 tipos de contenido: perspectiva sectorial, casos/resultados y producto en contexto", "Content Lead", "Continuo", "LinkedIn", "progreso"),
      ]),
      objetivo("Sumar email marketing como canal de conversión", "Corto plazo", "Canal activo en Ago 26", "all", [
        accion("Definir la plataforma de email (Mailchimp / HubSpot / ActiveCampaign)", "Mkt Grupo", "Jul 2026", "Email", "pendiente"),
        accion("Auditar y segmentar la base de contactos por vertical", "Mkt Grupo", "Jul 2026", "CRM", "pendiente"),
        accion("Lanzar la secuencia de nurturing de 5 emails", "Mkt Grupo", "Ago 2026", "Email", "pendiente"),
        accion("Enviar newsletter mensual segmentada (1er jueves de cada mes)", "Mkt Grupo", "Mensual", "Email", "pendiente"),
      ]),
      objetivo("Medir y reportar resultados a dirección", "Corto plazo", "1 reporte / mes", "all", [
        accion("Reporte mensual de KPIs de marketing a gerencias", "Mkt Grupo", "Mensual", "Reporte", "pendiente"),
        accion("Tablero de lead velocity por unidad y por producto", "Mkt Grupo", "Q3 2026", "Reporte", "pendiente"),
      ]),
      objetivo("Posicionar a Humanware Group como referente en LinkedIn", "Largo plazo", "Top Voice en nichos", "all", [
        accion("Consolidar la identidad de contenido del grupo (posteo de los jueves)", "Content Lead", "Continuo", "LinkedIn", "progreso"),
        accion("Apuntar a referente / Top Voice en los nichos objetivo", "Mkt Grupo", "Q2 2027", "LinkedIn", "pendiente"),
        accion("Instagram: marca y cultura de equipo, 2–3 posts por semana", "Content Lead", "Semanal", "Instagram", "pendiente"),
      ]),
    ],
  },
  {
    id: "didacta",
    name: "Didacta",
    tag: "Educación",
    iso: "assets/didacta-orange.png",
    sub: "Gestión académica · universidades y colegios privados de LATAM",
    accent: "#FF8000",
    headBg: "#fff3e6",
    headBorder: "#ffe0c2",
    chipBg: "#ffe6cc",
    productos: [
      { id: "d_edu", name: "Didacta Educativa", tag: "Educación Superior" },
      { id: "d_school", name: "Didacta School", tag: "Secundarios privados" },
      { id: "d_lite", name: "Didacta Lite", tag: "Instituciones chicas" },
    ],
    objetivos: [
      objetivo("Generar 3 demos calificadas por mes (meta de la unidad)", "Corto plazo", "3 demos / mes", "all", [
        accion("Outreach directo a 10 decisores nuevos/mes (rectores, directores, secretarios académicos)", "Mkt Didacta", "Mensual", "LinkedIn", "progreso"),
        accion("Comentarios estratégicos en páginas de universidades y colegios privados", "Mkt Didacta", "Semanal", "LinkedIn", "progreso"),
        accion("Seguimiento post-demo dentro de las 48 h e ingreso a nurturing", "Comercial", "Continuo", "Email", "progreso"),
        accion("Registrar y calificar cada contacto en el CRM segmentado (frío/tibio/caliente)", "Mkt Didacta", "Continuo", "CRM", "progreso"),
      ]),
      objetivo("Escalar y expandir el outreach educativo", "Mediano plazo", "20 contactos / mes", "all", [
        accion("Ampliar a un segundo batch de 20 prospectos calificados por mes", "Mkt Didacta", "Q4 2026", "LinkedIn", "pendiente"),
        accion("Expansión progresiva a México, Colombia, Chile y Perú", "Mkt Didacta", "Q1 2027", "LinkedIn", "pendiente"),
      ]),
      objetivo("Sostener contenido de perspectiva sectorial educativa", "Corto plazo", "1 posteo / semana", "all", [
        accion("Posteo semanal de gestión / educación superior (martes)", "Content Lead", "Semanal", "LinkedIn", "progreso"),
        accion("2 episodios de Academy con foco en gestión educativa", "Content Lead", "Q3 2026", "Contenido", "pendiente"),
        accion("Alimentar la newsletter mensual segmentada de educación", "Mkt Grupo", "Mensual", "Email", "pendiente"),
      ]),
      objetivo("Capitalizar los 2 eventos educativos confirmados", "Mediano plazo", "EdTech (2 sep) + Siglo 21 Innova Educa", "all", [
        accion("EdTech (2 sep) · Pre-evento: preparar kit institucional, mensajes clave y lista de instituciones objetivo", "Mkt Didacta", "Ago 2026", "Eventos", "progreso"),
        accion("EdTech (2 sep) · Durante: registrar contactos de decisores en CRM y agendar demos", "Comercial", "2 Sep 2026", "Eventos", "pendiente"),
        accion("Siglo 21 Innova Educa · Pre-evento: confirmar presencia/rol y agendar reuniones previas", "Mkt Didacta", "Sep 2026", "Eventos", "pendiente"),
        accion("Siglo 21 Innova Educa · Durante: networking con rectores y directivos, captura de leads", "Mkt Didacta", "Sep 2026", "Eventos", "pendiente"),
        accion("Post-evento (ambos): seguimiento dentro de las 48 h e ingreso a nurturing", "Comercial", "Por evento", "Eventos", "pendiente"),
        accion("Evaluar una participación activa (panel o charla) en Siglo 21 Innova Educa", "Mkt Didacta", "Sep 2026", "Eventos", "pendiente"),
      ]),
      objetivo("Documentar un caso de éxito de Didacta", "Mediano plazo", "1 caso documentado", "all", [
        accion("Seleccionar cliente y documentar el caso (post largo + landing)", "Mkt Didacta", "Q4 2026", "Contenido", "pendiente"),
        accion("Usar el caso como activo de ventas en las secuencias", "Comercial", "Q4 2026", "Email", "pendiente"),
      ]),
      objetivo("Foco Educación Superior: demanda en universidades", "Corto plazo", "universidades +300 alumnos", "d_edu", [
        accion("Outreach a rectores, secretarios académicos y responsables de sistemas", "Mkt Didacta", "Mensual", "LinkedIn", "progreso"),
        accion("Comentarios en páginas de universidades y redes de gestión (UDUAL, OUI-IOHE)", "Mkt Didacta", "Semanal", "LinkedIn", "progreso"),
        accion("Priorizar instituciones con +300 alumnos y gestión académica activa", "Mkt Didacta", "Q3 2026", "CRM", "progreso"),
      ]),
      objetivo("Foco Secundarios: colegios privados", "Corto plazo", "colegios secundarios privados", "d_school", [
        accion("Outreach a directores de colegios privados (redes CAIEP / AIEPBA)", "Mkt Didacta", "Mensual", "LinkedIn", "pendiente"),
        accion("Contenido de gestión escolar y administración de secundarios", "Content Lead", "Quincenal", "LinkedIn", "pendiente"),
      ]),
      objetivo("Foco Didacta Lite: instituciones chicas", "Mediano plazo", "institutos y colegios pequeños", "d_lite", [
        accion('Mensaje "arranque rápido, menos módulos" para instituciones chicas', "Mkt Didacta", "Q4 2026", "LinkedIn", "pendiente"),
        accion("Identificar institutos terciarios y colegios pequeños de la región", "Mkt Didacta", "Q4 2026", "CRM", "pendiente"),
      ]),
    ],
  },
  {
    id: "oneclick",
    name: "One Click",
    tag: "Finanzas",
    iso: "assets/oc-dark.png",
    sub: "Ecosistema financiero · SGRs, fondos, FCIs, avales y portales PyME",
    accent: "#16242B",
    headBg: "#eef1f4",
    headBorder: "#d9dfe6",
    chipBg: "#dde3ea",
    productos: [
      { id: "oc_sgr", name: "SGR One Click", tag: "SGRs" },
      { id: "oc_fci", name: "FCI One Click", tag: "Fondos / FCI" },
      { id: "oc_aval", name: "Aval One Click", tag: "Fondos de aval" },
      { id: "oc_pyme", name: "Portal de Financiamiento PyME", tag: "nombre por definir" },
      { id: "oc_financia", name: "FinancIA", tag: "Portal de Riesgo" },
      { id: "oc_onb", name: "Onboarding", tag: "Módulo" },
      { id: "oc_protector", name: "Portal del Socio Protector", tag: "Portal" },
      { id: "oc_ref", name: "Portal del Referidor", tag: "Portal" },
      { id: "oc_cliente", name: "Portal del Cliente", tag: "Portal" },
    ],
    objetivos: [
      objetivo("Generar 5 demos calificadas por mes (meta de la unidad)", "Corto plazo", "5 demos / mes", "all", [
        accion("Outreach directo a 10 gerentes de SGR / FCI / ALYC nuevos por mes", "Mkt One Click", "Mensual", "LinkedIn", "progreso"),
        accion("Comentarios en CASFOG, CASGRA, CNV, BYMA, fondos y fintechs", "Mkt One Click", "Semanal", "LinkedIn", "progreso"),
        accion("Calificar y hacer avanzar las oportunidades activas en el pipeline", "Comercial", "Continuo", "CRM", "progreso"),
        accion("Seguimiento de demos programadas y agendadas", "Comercial", "Continuo", "Email", "progreso"),
      ]),
      objetivo("Sostener contenido sectorial de finanzas", "Corto plazo", "1 posteo / semana", "all", [
        accion("Posteo semanal sobre SGRs, FCIs y mercado de capitales PyME (lunes)", "Content Lead", "Semanal", "LinkedIn", "progreso"),
        accion("2 episodios de Academy sobre financiamiento PyME", "Content Lead", "Q3 2026", "Contenido", "pendiente"),
        accion("Alimentar la newsletter mensual segmentada de finanzas", "Mkt Grupo", "Mensual", "Email", "pendiente"),
      ]),
      objetivo("Capitalizar el Foro Iberoamericano (Perú) confirmado", "Mediano plazo", "Foro Iberoamericano · Perú", "all", [
        accion("Foro Iberoamericano (Perú) · Pre-evento: preparar material, definir SGRs/fondos objetivo y agenda de reuniones", "Mkt One Click", "Q4 2026", "Eventos", "progreso"),
        accion("Foro Iberoamericano (Perú) · Durante: networking regional y registro de contactos en CRM", "Mkt One Click", "Q4 2026", "Eventos", "pendiente"),
        accion("Foro Iberoamericano (Perú) · Post: seguimiento dentro de las 48 h e ingreso a nurturing", "Comercial", "Por evento", "Eventos", "pendiente"),
        accion("Evaluar una participación activa (panel o charla) en el Foro", "Mkt One Click", "Q4 2026", "Eventos", "pendiente"),
        accion("Sostener asistencia a jornadas de CASFOG / CASGRA y eventos de BYMA / CNV", "Mkt One Click", "Q3–Q4 2026", "Eventos", "pendiente"),
      ]),
      objetivo("Documentar un caso de éxito de One Click", "Mediano plazo", "1 caso documentado", "all", [
        accion("Documentar caso de una SGR o FCI (post largo + landing)", "Mkt One Click", "Q4 2026", "Contenido", "pendiente"),
      ]),
      objetivo("Foco SGRs: demanda en sociedades de garantía", "Corto plazo", "gerentes de SGR", "oc_sgr", [
        accion("Outreach a gerentes generales y de operaciones de SGRs (Garantizar, Avalando, Acindar Pymes…)", "Mkt One Click", "Mensual", "LinkedIn", "progreso"),
        accion("Comentarios en CASFOG, CASGRA y páginas de SGRs", "Mkt One Click", "Semanal", "LinkedIn", "progreso"),
      ]),
      objetivo("Foco FCI: administradoras de fondos", "Corto plazo", "administradoras de FCI", "oc_fci", [
        accion("Outreach a administradoras de FCI y áreas de operaciones", "Mkt One Click", "Mensual", "LinkedIn", "pendiente"),
        accion("Contenido sobre valuación, CNV y régimen informativo", "Content Lead", "Quincenal", "LinkedIn", "pendiente"),
      ]),
      objetivo("Foco Aval: fondos de garantía y avales", "Mediano plazo", "fondos de garantía", "oc_aval", [
        accion("Outreach a fondos de garantía provinciales y nacionales", "Mkt One Click", "Q4 2026", "LinkedIn", "pendiente"),
      ]),
      objetivo("Lanzar y posicionar el Portal de Financiamiento PyME", "Mediano plazo", "naming + propuesta", "oc_pyme", [
        accion("Definir naming del portal y propuesta de valor", "Mkt One Click", "Q3 2026", "Marca", "pendiente"),
        accion("Mensaje de originación y acceso al crédito PyME", "Content Lead", "Q4 2026", "LinkedIn", "pendiente"),
      ]),
      objetivo("Posicionar FinancIA como portal de riesgo", "Mediano plazo", "gestión de riesgo", "oc_financia", [
        accion("Contenido sobre scoring, riesgo y monitoreo continuo", "Content Lead", "Mensual", "LinkedIn", "pendiente"),
        accion("Outreach a áreas de riesgo y compliance", "Mkt One Click", "Q4 2026", "LinkedIn", "pendiente"),
      ]),
    ],
  },
  {
    id: "academy",
    name: "Humanware Academy",
    tag: "Contenido",
    iso: "assets/academy-iso.png",
    sub: "Canal de contenido y comunidad que nutre a las verticales",
    accent: "#616E7D",
    headBg: "#f1f3f5",
    headBorder: "#e2e6ea",
    chipBg: "#e4e8ec",
    productos: [],
    objetivos: [
      objetivo("Nutrir a las verticales con contenido y comunidad", "Continuo", "2 episodios / trimestre", "all", [
        accion("Producir 2 episodios por trimestre (educación + finanzas)", "Content Lead", "Trimestral", "Contenido", "progreso"),
        accion("Generar clips cortos y reels para Instagram y LinkedIn", "Content Lead", "Semanal", "Instagram", "pendiente"),
        accion("Posteo semanal de Academy (miércoles)", "Content Lead", "Semanal", "LinkedIn", "progreso"),
      ]),
      objetivo("Organizar el primer evento propio de Academy", "Largo plazo", "1 webinar", "all", [
        accion("Webinar de cierre con invitados del sector", "Content Lead", "Q1 2027", "Eventos", "pendiente"),
      ]),
    ],
  },
  {
    id: "consultoria",
    name: "Consultoría",
    tag: "Servicios",
    iso: "assets/icon-color.png",
    sub: "Servicios y sistemas a medida · construcción y licenciamiento",
    accent: "#2D6CDF",
    headBg: "#eef3fc",
    headBorder: "#d3e0f6",
    chipBg: "#dde7fa",
    productos: [
      {
        id: "c_obras",
        name: "Sistema de Construcción",
        tag: "gestión de obras · sin nombre",
        emptyNote: "Sistema de gestión de obras (en definición). Objetivos y acciones de marketing por definir — falta el naming y confirmar el go-to-market.",
      },
      {
        id: "c_ms",
        name: "Licenciamiento Microsoft",
        tag: "Partner",
        emptyNote: "Licenciamiento Microsoft. Objetivos y acciones de marketing por definir.",
      },
    ],
    objetivos: [],
  },
];

const PIPELINE_STATS = [
  {
    name: "Didacta",
    tag: "meta 3 demos/mes",
    accent: "#FF8000",
    bg: "#fff3e6",
    iso: "assets/didacta-orange.png",
    items: [
      { label: "Demos realizadas", value: "3", sub: "/ 3 ✓", color: "#1f9d63" },
      { label: "Demos programadas", value: "3", sub: "", color: "#FF8000" },
      { label: "En seguimiento", value: "5", sub: "", color: "#b7791f" },
    ],
  },
  {
    name: "One Click",
    tag: "meta 5 demos/mes",
    accent: "#16242B",
    bg: "#eef1f4",
    iso: "assets/oc-dark.png",
    items: [
      { label: "Demos realizadas", value: "3", sub: "/ 5", color: "#b7791f" },
      { label: "Demos programadas", value: "5", sub: "", color: "#16242B" },
      { label: "Oport. activas", value: "6", sub: "", color: "#2f8ad0" },
      { label: "En seguimiento", value: "3", sub: "", color: "#b7791f" },
    ],
  },
];

module.exports = { UNITS, PIPELINE_STATS };
