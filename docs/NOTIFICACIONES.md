# Avisos de actualización y sonido

El aviso vigente del 26 de octubre de 2026 explica el modo sin internet, la preparación automática y la sincronización de pendientes. Reemplaza el anuncio anterior de ZimaTicket; se retiraron el saludo navideño de las notificaciones y la imagen antigua de renovación del login. La campana muestra las novedades; los resúmenes de cantidad de planillas, estados y valor administrado permanecen en el dashboard y no se incluyen como notificaciones.

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
