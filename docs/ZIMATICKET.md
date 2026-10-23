# ZimaTicket

El menú ZimaTicket abre `soporte.html`. Los usuarios registran el asunto,
categoría, prioridad, correo de contacto y descripción del caso. El servidor
añade su identidad y peaje desde la sesión y crea la hoja `ZIMATICKETS` al
registrar el primer caso. Las hojas de planillas y soporte anterior se conservan.

El botón flotante de herramientas, abajo a la derecha, y los enlaces del menú
abren el portal en una ventana dentro de la pantalla actual. Cerrar conserva
el formulario de soporte y devuelve el foco a la pantalla anterior. La ventana
también se cierra con Escape. El botón no aparece dentro de las vistas de
impresión ni dentro del propio portal incrustado.

El aviso de un nuevo ticket se envía a `CORREOS_NOTIFICACION` de la hoja
`CONFIG`, con respaldo en `sistemaplanillaszima@gmail.com`. El correo de contacto
del ticket se usa como dirección de respuesta. Si falla el correo, el ticket
permanece guardado y la pantalla informa del fallo. Los reintentos del mismo
envío no crean tickets adicionales.

Cada usuario consulta sus propios tickets. Los administradores tienen una
bandeja con todos los casos y pueden cambiar el estado a abierto, en proceso o
resuelto, dejando una respuesta. El usuario ve esa respuesta al actualizar su
lista. Resolver un caso requiere escribir la solución. Este flujo no envía
correos automáticos por cada cambio de estado ni incluye archivos adjuntos.

## Activación

1. Actualizar Apps Script con `code.gs` de la raíz y publicar una nueva versión
   de la implementación existente, conservando la URL `/exec`.
2. Publicar `soporte.html`, `soporte.css`, `soporte.js`, `zima-ui.js` y los HTML
   con el nuevo enlace: `dashboard.html`, `historial.html`, `planilla.html`,
   `informes.html` y `granadmin.html`.
3. Confirmar el destinatario en `CONFIG > CORREOS_NOTIFICACION`.
4. Crear un caso desde una cuenta de peaje, verificar la recepción del correo,
   responder desde una cuenta administradora y actualizar la lista del usuario.

Pruebas locales con servicios simulados: `node tests/tickets.cjs`.
