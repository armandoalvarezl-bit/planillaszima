(function(){
  // El mantenimiento termina el lunes 23 de noviembre de 2026 a las 10:00 (BogotÃ¡, UTC-5).
  var MAINTENANCE_END = Date.parse("2026-11-23T15:00:00Z");
  var MAINTENANCE_MODE = Date.now() < MAINTENANCE_END;
  var MAINTENANCE_PAGE = "mantenimiento.html";

  if (!MAINTENANCE_MODE) return;

  var path = window.location.pathname || "";
  var currentPage = path.substring(path.lastIndexOf("/") + 1) || "index.html";

  if (currentPage.toLowerCase() === MAINTENANCE_PAGE) return;

  window.location.replace(MAINTENANCE_PAGE);
})();


