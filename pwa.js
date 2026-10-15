(function(){
  if(!("serviceWorker" in navigator)) return;

  window.addEventListener("load", function(){
    navigator.serviceWorker.register("service-worker.js").catch(function(){
      // La app sigue funcionando aunque el navegador no permita service workers.
    });
  });
})();
