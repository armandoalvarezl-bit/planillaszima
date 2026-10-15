(function () {
  "use strict";
  window.UJECA_LIVE_DEFAULT = "https://www.youtube.com/watch?v=FmAd3Ljn42A";

  window.normalizarLiveUJECA = function (valor) {
    const texto = String(valor || "").trim();
    if (!texto) return null;
    try {
      const url = new URL(texto);
      if (url.protocol !== "https:") return null;
      const host = url.hostname.toLowerCase();
      const pertenece = (dominio) => host === dominio || host.endsWith("." + dominio);
      const partes = url.pathname.split("/").filter(Boolean);
      if (pertenece("youtube.com") || pertenece("youtube-nocookie.com") || host === "youtu.be") {
        const id = host === "youtu.be" ? partes[0] : url.searchParams.get("v") ||
          (["embed", "live", "shorts"].includes(partes[0]) ? partes[1] : "");
        if (!/^[\w-]{11}$/.test(id || "")) return null;
        return { url: "https://www.youtube.com/watch?v=" + id, canal: "YouTube",
          embed: "https://www.youtube.com/embed/" + id + "?rel=0" };
      }
      if (pertenece("facebook.com") || host === "fb.watch") {
        if (url.pathname === "/plugins/video.php") {
          const original = url.searchParams.get("href");
          if (!original || original === texto || /\/plugins\//i.test(original)) return null;
          return window.normalizarLiveUJECA(original);
        }
        if (host !== "fb.watch" && !(/\/videos\/[^/]+/i.test(url.pathname) ||
          /^\/watch\/?$/.test(url.pathname) && /^\d+$/.test(url.searchParams.get("v") || "") ||
          /^\/share\/(v|r)\/[^/]+/i.test(url.pathname))) return null;
        if (host === "fb.watch" && !partes[0]) return null;
        return { url: url.href, canal: "Facebook", embed:
          "https://www.facebook.com/plugins/video.php?href=" + encodeURIComponent(url.href) + "&show_text=false" };
      }
    } catch {}
    return null;
  };

  window.cargarLiveUJECA = function () {
    return new Promise((resolve, reject) => {
      const nombre = "ujecaLive_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
      const script = document.createElement("script");
      let timer;
      const terminar = (error, data) => {
        clearTimeout(timer);
        script.remove();
        delete window[nombre];
        error ? reject(error) : resolve(data);
      };
      window[nombre] = (data) => {
        if (data?.resultado !== "ok" || typeof data.url !== "string") {
          terminar(new Error("Actualiza AppsScript_UJECA.gs y su implementación para configurar la transmisión."));
        } else terminar(null, data);
      };
      script.onerror = () => terminar(new Error("No se pudo consultar la transmisión. Revisa la conexión."));
      script.src = window.crearUrlUJECA(window.UJECA_API.registro, { accion: "obtenerLive", callback: nombre });
      timer = setTimeout(() => terminar(new Error("No se pudo consultar la transmisión. Intenta de nuevo.")), 12000);
      document.body.appendChild(script);
    });
  };
})();
