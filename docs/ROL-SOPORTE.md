# Soporte y accesos

Un administrador puede asignar el rol **SOPORTE** al crear o editar un usuario.
El nombre o el cargo «Soporte» no conceden este rol: debe seleccionarse en Rol.

El usuario de soporte entra a `control-soporte.html`: el centro de control muestra
ingresos recientes, tickets pendientes, validación de accesos y auditoría filtrable.
Desde allí puede abrir el portal de tickets o `granadmin.html` para gestionar accesos.
Consulta [la guía de activación del centro de control](CENTRO-CONTROL-SOPORTE.md).

Puede atender todos los tickets y crear, editar, activar, inactivar o renovar las
contraseñas de usuarios de **PEAJE**. No puede modificar administradores,
interventoría ni otros usuarios de soporte, ni conceder roles de mayor permiso.
Al crear o editar un peaje debe elegir una oficina concreta.

No puede consultar planillas, informes ni totales; tampoco crear, editar, anular
o eliminar planillas, incluidas las aprobadas. El servidor aplica estas reglas
aunque se envíen solicitudes manuales o se modifique el menú del navegador.

## Cambios confirmados

Las operaciones de acceso usan el token de sesión y la misma ruta autorizada
por POST, JSONP o `google.script.run`. El servidor vuelve a leer el usuario tras
guardar y confirma sus campos, estado y contraseña antes de responder éxito.
Se retiró la alternativa de formulario oculto que anunciaba éxito sin poder leer
la respuesta del servidor. Si una foto grande impide confirmar la respuesta,
se informa del problema y se indica actualizar la lista antes de reintentar.

Los cambios de contraseña invalidan las sesiones anteriores. En cada solicitud
se consultan el rol, el peaje y el estado actuales de la hoja USUARIOS; no se
conservan permisos antiguos por tener una sesión abierta.

## Auditoría

El panel muestra los últimos 200 movimientos. Registra cambios de usuarios,
contraseñas, estados y seguimiento de tickets, con responsable y fecha.
Las contraseñas nunca se guardan en el detalle de auditoría. Para soporte, los
detalles de movimientos de planillas se sustituyen por un texto sin valores.

Los movimientos anteriores que no se registraron en AUDITORIA no se reconstruyen.

## Activación

1. Actualizar el `code.gs` de la raíz en Apps Script y publicar una nueva versión
   de la implementación actual, conservando la URL.
2. Publicar `granadmin.html`, `login.html`, `zima-ui.js`, `soporte.js` y los cuatro
   archivos `control-soporte.html`, `control-soporte.css`, `control-soporte-core.js`
   y `control-soporte-home.js`.
3. Como administrador, editar la cuenta del técnico y elegir el rol **SOPORTE**.
4. Cerrar su sesión anterior y entrar nuevamente para cargar el menú de soporte.

No es necesario ejecutar `setupSistema()` ni borrar las hojas existentes.

```sh
node tests/support-access.cjs
node tests/password-renewal.cjs
node tests/tickets.cjs
node tests/ticket-conversation.cjs
node tests/admin-ticket-notifications.cjs
```
