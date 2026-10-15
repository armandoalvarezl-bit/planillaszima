window.UJECA_API = {
  registro: "https://script.google.com/macros/s/AKfycby33FCZ87pblW8UV60mNZh4Vy94K7GwBYSWFm3lybJODCKtZiK31aITa3-g116MAFM/exec",
  listado: "https://script.google.com/macros/s/AKfycby33FCZ87pblW8UV60mNZh4Vy94K7GwBYSWFm3lybJODCKtZiK31aITa3-g116MAFM/exec",
  listadoAlterno: "https://script.google.com/macros/s/AKfycby33FCZ87pblW8UV60mNZh4Vy94K7GwBYSWFm3lybJODCKtZiK31aITa3-g116MAFM/exec",
  pagos: "https://script.google.com/macros/s/AKfycby33FCZ87pblW8UV60mNZh4Vy94K7GwBYSWFm3lybJODCKtZiK31aITa3-g116MAFM/exec"
};

window.UJECA_STORAGE_KEY = "ujeca_registros_locales";
window.UJECA_CACHE_REMOTA_KEY = "ujeca_registros_remotos_cache";
window.UJECA_CACHE_REMOTA_TTL = 1000 * 60 * 10;
window.UJECA_HOJA_INSCRIPCIONES = "Inscripciones2026";

window.UJECA_COLUMNAS_INSCRITOS = [
  "FechaRegistro",
  "Codigo",
  "Nombre",
  "Documento",
  "Edad",
  "Sexo",
  "Telefono",
  "Correo",
  "Iglesia",
  "Pastor",
  "Municipio",
  "Departamento",
  "TipoZona",
  "ZonaAsignada",
  "LiderAsignado",
  "tipo",
  "DeseaCamisa",
  "TipoCamiseta",
  "TallaCamisa",
  "ColorCamisa",
  "EstadoRegistro",
  "SeguimientoNota",
  "SeguimientoFecha",
  "SeguimientoActualizado"
];

window.UJECA_ETIQUETAS_INSCRITOS = {
  FechaRegistro: "Fecha",
  Codigo: "Codigo",
  Nombre: "Nombre",
  Documento: "Documento",
  Edad: "Edad",
  Sexo: "Sexo",
  Telefono: "Telefono",
  Correo: "Correo",
  Iglesia: "Iglesia",
  Pastor: "Pastor",
  Municipio: "Municipio",
  Departamento: "Departamento",
  TipoZona: "Tipo zona",
  ZonaAsignada: "Zona",
  LiderAsignado: "Lider de pago",
  tipo: "Tipo",
  DeseaCamisa: "Camisa",
  TipoCamiseta: "Corte",
  TallaCamisa: "Talla",
  ColorCamisa: "Color",
  EstadoRegistro: "Estado",
  SeguimientoNota: "Seguimiento",
  SeguimientoFecha: "Proximo contacto",
  SeguimientoActualizado: "Actualizado"
};

window.escaparHtmlUJECA = function(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

window.normalizarRegistroUJECA = function(registro) {
  if (!registro || typeof registro !== "object") return null;

  const limpio = {};
  Object.keys(registro).forEach((clave) => {
    limpio[clave] = registro[clave] ?? "";
  });

  limpio.Nombre = limpio.Nombre || limpio.nombre || "";
  limpio.Documento = String(limpio.Documento || limpio.documento || limpio.cedula || "").trim();
  limpio.Telefono = limpio.Telefono || limpio.telefono || "";
  limpio.Correo = limpio.Correo || limpio.correo || "";
  limpio.Iglesia = limpio.Iglesia || limpio.iglesia || "";
  limpio.Municipio = limpio.Municipio || limpio.Ciudad || limpio.ciudad || "";
  limpio.Codigo = limpio.Codigo || limpio.codigo || limpio.ID || "";
  limpio.FechaRegistro = limpio.FechaRegistro || limpio.fechaRegistro || limpio.Fecha || limpio.FechaSistema || "";
  limpio.TipoZona = limpio.TipoZona || limpio.tipoZona || limpio["Tipo zona"] || limpio.Tipozona || "";
  limpio.ZonaAsignada = limpio.ZonaAsignada || limpio.zonaAsignada || limpio.Zona || limpio.zona || "";
  limpio.LiderAsignado = limpio.LiderAsignado || limpio.liderAsignado || limpio.Asignado || limpio.asignado || "";
  limpio.DeseaCamisa = limpio.DeseaCamisa || limpio.deseaCamisa || "No";
  limpio.TipoCamiseta = limpio.TipoCamiseta || limpio.tipoCamiseta || "";
  limpio.TallaCamisa = limpio.TallaCamisa || limpio.tallaCamisa || "";
  limpio.ColorCamisa = limpio.ColorCamisa || limpio.colorCamisa || "";
  limpio.EstadoRegistro = limpio.EstadoRegistro || limpio.estadoRegistro || "";
  limpio.SeguimientoNota = limpio.SeguimientoNota || limpio.seguimientoNota || "";
  limpio.SeguimientoFecha = limpio.SeguimientoFecha || limpio.seguimientoFecha || "";
  limpio.SeguimientoActualizado = limpio.SeguimientoActualizado || limpio.seguimientoActualizado || "";

  return limpio;
};

window.obtenerRegistrosLocalesUJECA = function() {
  return [];
};

window.guardarRegistroLocalUJECA = function(registro) {
  // No se guarda registro localmente en este sitio.
};

window.eliminarRegistroLocalUJECA = function(registro) {
  // No se elimina registro localmente en este sitio.
};

window.obtenerCacheRegistrosRemotosUJECA = function(maxEdad = window.UJECA_CACHE_REMOTA_TTL) {
  return [];
};

window.guardarCacheRegistrosRemotosUJECA = function(registros) {
  // No se guarda cache remota localmente.
};

window.unificarRegistrosUJECA = function(remotos) {
  const mapa = new Map();
  const todos = Array.isArray(remotos) ? remotos : [];

  todos.forEach((item) => {
    const normalizado = window.normalizarRegistroUJECA(item);
    if (!normalizado) return;
    const clave = `${normalizado.Documento}::${normalizado.Correo || normalizado.Nombre}`;
    if (!mapa.has(clave)) {
      mapa.set(clave, normalizado);
    }
  });

  return Array.from(mapa.values());
};

window.extraerListaUJECA = function(respuesta) {
  if (Array.isArray(respuesta)) return respuesta;
  if (!respuesta || typeof respuesta !== "object") return [];

  const posibles = [
    respuesta.data,
    respuesta.datos,
    respuesta.registros,
    respuesta.inscritos,
    respuesta.listado,
    respuesta.rows,
    respuesta.resultado
  ];

  for (const item of posibles) {
    if (Array.isArray(item)) return item;
  }

  return [];
};

window.crearUrlUJECA = function(base, params = {}) {
  const url = new URL(base, window.location.href);
  Object.entries(params).forEach(([clave, valor]) => {
    if (valor !== undefined && valor !== null && valor !== "") {
      url.searchParams.set(clave, valor);
    }
  });
  url.searchParams.set("_", Date.now().toString());
  return url.toString();
};

window.cargarPagosRemotosUJECA = async function(baseUrl = window.UJECA_API.pagos) {
  const pagosUrl = window.crearUrlUJECA(baseUrl, { accion: "pagos" });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const respuesta = await fetch(pagosUrl, {
      cache: "no-store",
      signal: controller.signal
    });
    clearTimeout(timeout);
    const texto = await respuesta.text();
    if (!respuesta.ok) {
      throw new Error("No se pudo leer el listado de pagos");
    }

    let json = null;
    try {
      json = JSON.parse(texto);
    } catch {
      const match = texto.match(/^[\w$]+\(([\s\S]*)\);?$/);
      if (match) json = JSON.parse(match[1]);
    }

    const lista = window.extraerListaUJECA(json);
    if (lista.length) return lista;
  } catch {
    // Si fetch falla por CORS o red, se intenta JSONP abajo.
  }

  return new Promise((resolve) => {
    const callbackName = "ujecaPagosCallback_" + Date.now();
    const script = document.createElement("script");
    let terminado = false;

    const finalizar = (datos) => {
      if (terminado) return;
      terminado = true;
      delete window[callbackName];
      script.remove();
      resolve(window.extraerListaUJECA(datos));
    };

    window[callbackName] = finalizar;
    script.onerror = () => finalizar([]);
    script.src = window.crearUrlUJECA(baseUrl, {
      accion: "pagos",
      callback: callbackName
    });

    document.body.appendChild(script);
    setTimeout(() => finalizar([]), 6000);
  });
};

window.filtrarRegistrosConPagoUJECA = function(registros, pagos) {
  const documentosConPago = new Set();
  const codigosConPago = new Set();

  (Array.isArray(pagos) ? pagos : []).forEach((pago) => {
    if (!pago || typeof pago !== "object") return;
    const valor = Number(pago.ValorAbono || pago.abono || pago.valor || 0);
    if (!(valor > 0)) return;

    const documento = String(pago.Documento || pago.documento || pago.cedula || "").trim();
    const codigo = String(pago.Codigo || pago.codigo || pago.ID || "").trim().toLowerCase();
    if (documento) documentosConPago.add(documento);
    if (codigo) codigosConPago.add(codigo);
  });

  return (Array.isArray(registros) ? registros : []).filter((registro) => {
    const documento = String(registro?.Documento || registro?.documento || registro?.cedula || "").trim();
    const codigo = String(registro?.Codigo || registro?.codigo || registro?.ID || "").trim().toLowerCase();
    return (documento && documentosConPago.has(documento)) || (codigo && codigosConPago.has(codigo));
  });
};

window.cargarRegistrosRemotosUJECA = async function(baseUrl = window.UJECA_API.listado) {
  const listadoUrl = window.crearUrlUJECA(baseUrl, {
    accion: "listado",
    hoja: window.UJECA_HOJA_INSCRIPCIONES
  });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const respuesta = await fetch(listadoUrl, {
      cache: "no-store",
      signal: controller.signal
    });
    clearTimeout(timeout);
    const texto = await respuesta.text();
    if (!respuesta.ok) {
      throw new Error("No se pudo leer el listado remoto");
    }

    let json = null;
    try {
      json = JSON.parse(texto);
    } catch {
      const match = texto.match(/^[\w$]+\(([\s\S]*)\);?$/);
      if (match) json = JSON.parse(match[1]);
    }

    const lista = window.extraerListaUJECA(json);
    if (lista.length) return lista;
  } catch {
    // Si fetch falla por CORS o red, se intenta JSONP abajo.
  }

  return new Promise((resolve) => {
    const callbackName = "ujecaListadoCallback_" + Date.now();
    const script = document.createElement("script");
    let terminado = false;

    const finalizar = (datos) => {
      if (terminado) return;
      terminado = true;
      delete window[callbackName];
      script.remove();
      resolve(window.extraerListaUJECA(datos));
    };

    window[callbackName] = finalizar;
    script.onerror = () => finalizar([]);
    script.src = window.crearUrlUJECA(baseUrl, {
      accion: "listado",
      hoja: window.UJECA_HOJA_INSCRIPCIONES,
      callback: callbackName
    });

    document.body.appendChild(script);
    setTimeout(() => finalizar([]), 6000);
  });
};

window.cargarRegistrosUJECA = async function(baseUrl = window.UJECA_API.listado) {
  const remotos = await window.cargarRegistrosRemotosUJECA(baseUrl);
  return window.unificarRegistrosUJECA(remotos);
};

window.cargarInscritosConfirmadosUJECA = async function(baseUrl = window.UJECA_API.listado, pagosUrl = window.UJECA_API.pagos) {
  const [registros, pagos] = await Promise.all([
    window.cargarRegistrosRemotosUJECA(baseUrl),
    window.cargarPagosRemotosUJECA(pagosUrl)
  ]);

  return window.unificarRegistrosUJECA(window.filtrarRegistrosConPagoUJECA(registros, pagos));
};

window.obtenerColumnasInscritosUJECA = function(registros) {
  const columnasBase = window.UJECA_COLUMNAS_INSCRITOS.filter((columna) =>
    (registros || []).some((registro) => String(registro?.[columna] ?? "").trim() !== "")
  );

  const extras = new Set();
  (registros || []).forEach((registro) => {
    Object.keys(registro || {}).forEach((clave) => {
      const valor = String(registro[clave] ?? "").trim();
      if (
        valor &&
        !window.UJECA_COLUMNAS_INSCRITOS.includes(clave) &&
        !["token", "accion", "hoja", "HojaDestino"].includes(clave)
      ) {
        extras.add(clave);
      }
    });
  });

  return columnasBase.concat(Array.from(extras));
};

window.obtenerEtiquetaInscritoUJECA = function(columna) {
  return window.UJECA_ETIQUETAS_INSCRITOS[columna] || columna;
};
