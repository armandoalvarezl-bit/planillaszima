# Trabajo sin internet y sincronización

## Qué incluye

- Primer ingreso con internet: se valida la cuenta, se descarga su lista de planillas y se prepara un almacén cifrado para ese usuario en ese navegador. Se intenta descargar también peajes, tickets y, para administradores, la lista de usuarios.
- Con internet, la preparación trabaja en segundo plano y no muestra un aviso permanente. Cada ingreso online actualiza la copia; si se abre o se vuelve a una sesión activa en un día nuevo de Colombia, también se descarga una copia diaria y se renueva su permiso local. Las consultas normales mantienen los datos disponibles al día durante la operación. Una descarga diaria nunca reemplaza cambios locales pendientes.
- El aviso solo aparece al perder internet, cuando existen pendientes o conflictos, o si ocurre un error que requiere atención. Después de confirmar todos los envíos vuelve a ocultarse.
- Después de preparar el equipo: ingreso local con la misma contraseña, consulta del historial, dashboard e informes a partir de los datos descargados, creación, edición, anulación e impresión de planillas. Las planillas nuevas no necesitan haber sido abiertas antes.
- Tickets nuevos: se guardan en la cola y se registran al sincronizar. El correo se envía cuando el servidor procesa el ticket. El seguimiento administrativo requiere internet.
- Los cambios locales se conservan en IndexedDB al recargar o cerrar la página y después de cerrar sesión. Están cifrados con AES-GCM; la clave se deriva de la contraseña con PBKDF2-SHA256, 210000 iteraciones y sal aleatoria. La contraseña no se almacena. La clave desbloqueada se mantiene en sessionStorage durante la sesión y se elimina al cerrar sesión.
- La cola se comparte entre pestañas con bloqueos del navegador. Cada registro mantiene el orden de sus cambios. Los reintentos usan una identificación persistente y un diario del servidor para no duplicar escrituras.
- Al volver la conexión se intenta sincronizar automáticamente; también se reintenta cada 30 segundos mientras haya una sesión local activa. Debe haber una pestaña abierta. Si la app está cerrada, el siguiente ingreso continúa con los pendientes.
- La interfaz distingue los pendientes de los datos confirmados. Las impresiones locales llevan «COPIA LOCAL · PENDIENTE DE SINCRONIZACIÓN». Una creación sin código recibe una identificación provisional; el servidor asigna su código definitivo al sincronizar.

## Límites de acceso

El primer ingreso de cada cuenta en cada navegador requiere internet. No es posible validar por primera vez una cuenta desconocida sin consultar el servidor. El acceso local dura hasta siete días desde la validación, o hasta el vencimiento de la contraseña si ocurre antes. Se conserva el cierre local a los 15 minutos sin actividad.

Los cambios de usuarios, roles, contraseñas, perfiles y seguimiento de tickets necesitan internet. Las cuentas desactivadas, contraseñas modificadas y permisos cambiados se vuelven a comprobar antes de sincronizar. Cuando no hay red, el dispositivo no puede conocer revocaciones posteriores a su última descarga; el permiso local tiene por eso una duración limitada.

Un cambio de rol o peaje al reingresar bloquea los pendientes anteriores para revisión; no se trasladan automáticamente a otro peaje. Las respuestas y notificaciones de correo necesitan al servidor. Las consultas muestran la copia más reciente descargada en ese dispositivo, que puede estar desactualizada.

## Preparación y publicación

1. Guardar un respaldo de producción. Mantener el mismo `ZIMA_SPREADSHEET_ID` y la misma URL `/exec`.
2. Actualizar el proyecto existente de Apps Script con `code.gs` de la raíz. Publicar una nueva versión de esa misma implementación. No ejecutar `setupSistema()` ni `pruebaBackend()` para activar este cambio: la segunda crea una planilla de prueba.
3. Publicar juntos `zima-offline.js`, `service-worker.js`, `manifest.json`, `zima-ui.js`, `soporte.js`, las siete páginas (`login`, `dashboard`, `planilla`, `historial`, `informes`, `granadmin`, `soporte`), todos los CSS e imágenes y `assets/vendor/lucide.min.js`. No publicar únicamente el HTML de login.
4. Servir el sitio por HTTPS o por localhost durante desarrollo. Usar un navegador actualizado con Service Workers, Web Crypto, IndexedDB y Web Locks, como Edge o Chrome. Abrir archivos con doble clic (`file://`) no prepara una aplicación web sin conexión.
5. Abrir el sitio con internet e ingresar con una cuenta de prueba. La preparación es automática y silenciosa. En el primer ingreso, dejar terminar la descarga de datos y pantallas antes de desconectar. Para verificar técnicamente la preparación sin mostrar un aviso a los usuarios, `ZimaOffline.status().prepared` debe ser `true` en la consola del navegador.
6. En ese mismo navegador, desconectar internet, cerrar sesión e ingresar de nuevo. Crear una planilla de prueba, volver a abrirla desde historial, editarla y revisar la impresión marcada como local.
7. Reconectar con la sesión activa: comprobar que el aviso de pendientes desaparece y que la hoja contiene una sola planilla con los valores finales. Comprobar también correo y auditoría. Para probar anulaciones usar una planilla de prueba.
8. Probar un conflicto desde dos equipos. El segundo envío con una versión antigua debe quedar por revisar y no sobrescribir la hoja.

El servidor crea `OFFLINE_OPERACIONES` al recibir la primera sincronización, sin reinicializar las hojas existentes. Esta hoja es el diario de reintentos; no eliminarla ni modificarla manualmente. Los cambios preparados permanecen locales hasta publicar el backend y el frontend; el login online continúa usando el flujo anterior si el servidor aún no ofrece preparación offline.

## Pendientes y conflictos

El botón «Pendientes» permite consultar el motivo de los envíos detenidos y descargar una copia JSON de los cambios. Ese archivo contiene información en texto legible: guardarlo únicamente en un lugar autorizado.

Si una planilla cambió en el servidor, la ventana muestra esa versión y conserva la copia local. Tras revisar los datos, «Enviar mi versión sobre esta versión del servidor» solicita un nuevo envío con comprobación de versión. Si hubo otro cambio, vuelve a detenerse para revisión. Para un código duplicado, abrir la copia local y corregir el código, conservando el mismo registro local.

Un error de red no elimina pendientes. Si la sesión remota no se puede renovar, ingresar de nuevo con internet para validar la cuenta. No borrar los datos del navegador, IndexedDB ni el perfil mientras existan pendientes: se perdería la única copia de los cambios todavía no enviados. El respaldo de Google Sheets contiene solo lo que ya llegó al servidor.

Si cambió la contraseña y hay pendientes cifrados con la anterior, el sistema no sobrescribe ese almacén. Mientras el permiso local siga vigente, se puede desbloquear sin internet con la contraseña anterior para descargar los pendientes; después validar la cuenta con la contraseña nueva. No eliminar el almacén para resolver un error de acceso.

## Actualizaciones

### Guía temporal de bienvenida

El dashboard presenta un tutorial de cinco pasos después de la bienvenida y antes del aviso de novedades. Aparece una sola vez por usuario y navegador durante la campaña `offline-intro-2026-10-v2`, también sin conexión si las pantallas ya están preparadas. Se marca como mostrado al abrirlo, de modo que ni recargar ni omitirlo lo repiten. Se puede cerrar con Escape o con «Omitir guía».

Publicar también `zima-offline-tutorial.js` y `zima-offline-tutorial.css` junto con `dashboard.html` y `service-worker.js`. Para retirar la campaña cuando el equipo haya aprendido, cambiar `ENABLED` a `false` en `zima-offline-tutorial.js` y publicar con una nueva versión de la caché. No es necesario modificar Apps Script para este tutorial.

Para repetir la prueba de una cuenta de forma deliberada, borrar únicamente su clave `ZIMA_TUTORIAL_SEEN:offline-intro-2026-10-v2:usuario` desde las herramientas de desarrollo. No borrar el almacenamiento completo: podría contener planillas pendientes.

El service worker almacena solo pantallas y recursos estáticos; nunca guarda respuestas de Apps Script ni credenciales en CacheStorage. Las autorizaciones de reconexión y las escrituras desconectadas se envían por POST; si falla la lectura de la respuesta por CORS, se usa un formulario con confirmación por mensaje y un identificador aleatorio. Solo una confirmación válida permite retirar un cambio de la cola. No se considera un formulario enviado como un guardado confirmado.

El almacén de datos cifrados es independiente. Para una nueva publicación, incrementar las versiones `CACHE_NAME` y `OPTIONAL_CACHE` del service worker; publicar todos los archivos de la misma versión. Las actualizaciones no deben borrar IndexedDB.

Pruebas: `node tests/offline-server.cjs`, `node tests/offline-browser.cjs`, `node tests/offline-assets.cjs` y las regresiones existentes. La prueba de navegador usa un servidor local y una simulación del backend: no modifica producción ni envía correos reales.
