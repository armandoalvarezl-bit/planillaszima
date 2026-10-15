(function(){
  var MAINTENANCE_MODE = false;
  var MAINTENANCE_PAGE = "evento-cancelado.html";

  if (!MAINTENANCE_MODE) return;

  var path = window.location.pathname || "";
  var currentPage = path.substring(path.lastIndexOf("/") + 1) || "index.html";

  if (currentPage.toLowerCase() === MAINTENANCE_PAGE) return;

  window.location.replace(MAINTENANCE_PAGE);
})();
