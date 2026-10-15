# Configurar la transmisión desde el CPanel

1. En el proyecto de Google Apps Script que usa `api-config.js`, actualiza el código con `AppsScript_UJECA.gs`.
2. En **Implementar > Gestionar implementaciones**, edita la implementación web existente y selecciona **Nueva versión**. Conserva su URL y los permisos de acceso necesarios para la página pública.
3. Publica los archivos actualizados `cpanel.html`, `live.html`, `live-config.js` y `service-worker.js` en el alojamiento del sitio.
4. Entra al CPanel. En **Transmisión en vivo**, pega el enlace del video y pulsa **Guardar transmisión**. Abre **Ver página Live** para revisar el resultado.

El enlace se guarda en las propiedades del proyecto de Apps Script, por lo que se comparte entre dispositivos. Al vaciar el campo y guardar se retira la transmisión. Si todavía no existe una configuración, se conserva el video predeterminado anterior.

YouTube acepta enlaces de video, enlaces cortos y enlaces `/live/`. Facebook acepta enlaces de videos, `watch`, enlaces compartidos y `fb.watch`. Usa preferiblemente la URL completa del video público de Facebook: los enlaces cortos y las restricciones del video pueden impedir su reproducción integrada. El botón **Abrir live** permite ir directamente a la plataforma.

El servidor comprueba la clave de administrador al guardar. La propiedad opcional `UJECA_PANEL_PASSWORD` permite configurar la clave del servidor; debe coincidir con `PANEL_PASSWORD` del CPanel. Por defecto se usa la clave actual del panel.

La vista pública consulta el enlace cada vez que se abre o recarga. Si falla la consulta, muestra el video predeterminado y un aviso. El panel solo confirma el guardado después de recibir una respuesta válida del servidor.
