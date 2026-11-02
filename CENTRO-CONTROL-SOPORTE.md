# Centro de control de soporte

El inicio del rol SOPORTE es `control-soporte.html`. Administración también puede
abrirlo directamente. Los peajes no pueden consultar su API.

El ingreso propio del equipo está en `login-soporte.html`, con el mismo diseño
del login general. Acepta SOPORTE, ADMIN y ADMINISTRADOR, y abre directamente el
centro de control. El backend valida `portal: soporte` antes de crear una sesión.
El ingreso general conserva un enlace a este acceso.

## Qué incluye

- Vista general con accesos activos, usuarios que ingresaron hoy, tickets
  pendientes y accesos inactivos o con contraseña vencida.
- Actividad reciente de ingresos confirmados de usuarios de peaje. No se presenta
  como presencia en línea: un ingreso no demuestra que alguien siga conectado.
- Casos pendientes ordenados por prioridad y fecha, con acceso a su conversación.
- Validación de estado, peaje, último ingreso y vigencia de contraseña. Es una
  consulta de controles actuales, no una prueba de credenciales.
- Auditoría con búsqueda, filtro por tipo y período y exportación CSV de la vista.
- Acceso directo a la gestión del usuario seleccionado.

El servidor entrega solamente metadatos operativos. Para SOPORTE se mantienen
ocultos los valores de las planillas, contraseñas y detalles financieros de auditoría.
Los permisos para cambiar usuarios y planillas mantienen las restricciones del rol.

## Notificaciones de escritorio

1. En el PC de soporte, abrir el sistema publicado con HTTPS e iniciar sesión.
2. Pulsar **Activar notificaciones** en el centro de control, o **Notificaciones**
   en la barra superior de las otras pantallas de Soporte y administración.
3. Pulsar **Activar notificaciones** y permitirlas en el navegador.
4. Usar **Probar aviso** para comprobar la configuración del navegador y del PC.

Los permisos se solicitan solo al pulsar el botón. La preferencia se guarda por
usuario y navegador. Puede desactivarse en el mismo panel. Si el permiso está
bloqueado, se explica cómo habilitarlo desde la configuración del sitio.

El centro utiliza el menú con los logos y los botones del sistema general.
Para Soporte y administración, la bandeja se abre dentro del área central de
`control-soporte.html#tickets`, manteniendo el menú y la cabecera del sistema.
Los enlaces a un caso abren su conversación dentro de esa misma bandeja.
El gestor de usuarios también se abre en el área central, en `#usuarios`.
Desde la validación de acceso se puede abrir directamente el perfil seleccionado.
El menú y las acciones del gestor utilizan Bootstrap Icons.

Con el sistema abierto se consulta el servidor aproximadamente cada 30 segundos,
también al volver a una pestaña. Soporte conserva este servicio al navegar a
tickets o accesos. El navegador puede retrasar los temporizadores en segundo
plano y el sistema operativo puede silenciar avisos mediante sus propias opciones.
No se envían avisos con todas las pestañas cerradas; no se implementa Web Push.

La primera consulta del navegador establece una base sin notificar ingresos históricos.
Esta base se conserva al cambiar de página o recargar: los ingresos nuevos que
lleguen durante la navegación se avisan en la siguiente consulta. Si el navegador
no puede crear un aviso, se muestra el error y se reintenta al sincronizar. Cada
ingreso nuevo tiene un ID único. El historial local y la etiqueta del aviso evitan
repetirlo al sincronizar. Hacer clic en el aviso abre la actividad del centro.

Los eventos PEAJE_LOGIN se registran desde la actualización del backend. El último
ingreso del usuario puede ser anterior, pero no se inventan eventos pasados ni se
registran intentos fallidos como ingresos correctos.

## Publicar

1. Actualizar `code.gs` en Apps Script y publicar una nueva versión de la misma
   implementación. No es necesario borrar hojas ni ejecutar `setupSistema()`.
2. Publicar juntos:
   - `control-soporte.html`
   - `control-soporte.css`
   - `control-soporte-core.js`
   - `control-soporte-home.js`
   - `login.html`
   - `login-soporte.html`
   - `zima-ui.js`
   - `granadmin.html`
   - `soporte.js`
   - `soporte.css`
3. Volver a iniciar sesión con rol SOPORTE y activar los avisos en el equipo.

## Verificación local

```sh
node tests/support-access.cjs
node tests/support-desktop.cjs
node tests/support-control-browser.cjs
```

La prueba de navegador utiliza datos y permisos simulados; no envía notificaciones
reales al escritorio ni consulta la base de producción.
