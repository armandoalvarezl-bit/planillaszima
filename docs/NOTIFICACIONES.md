# Avisos de actualización y sonido

Publicar `dashboard.html` y `zima-updates.js` junto con los demás archivos.
El panel muestra las novedades a todos los roles al entrar, después de la
bienvenida. También pueden consultarse desde la campana.

Para cada nueva publicación, cambiar `release.id`, `release.title` y
`release.message` en `zima-updates.js`. Publicar ese archivo junto con los
cambios. Cada usuario verá el nuevo aviso en su siguiente entrada al panel.
La lectura se recuerda por usuario y versión en ese navegador; otro dispositivo
o borrar los datos del navegador puede volver a mostrarlo.

El sonido es breve y de volumen bajo. Si el navegador bloquea el audio
automático, queda pendiente para el siguiente clic o pulsación. También suena
cuando una consulta del panel detecta cambios en las planillas después de la
primera carga. La recepción de cambios depende de las consultas del panel;
no se envían notificaciones con la plataforma cerrada.

Verificación: `node tests/notifications.cjs`.
