# Activar sesiones y respaldos

1. Actualizar el proyecto de Apps Script existente con `code.gs` de la raíz. No usar `backend/Code.gs`.
2. Ejecutar `configurarRespaldosAutomaticos` desde el editor con la cuenta responsable. Autorizar acceso a Drive, hojas y activadores. Se crea una carpeta privada «ZIMA 360 - Respaldos», una copia inicial y un activador diario para la franja de las 2 a. m. de Colombia. No ejecutar `setupSistema` para activar los respaldos.
3. Comprobar la copia inicial en Drive y el activador en Apps Script. Las propiedades `ZIMA_BACKUP_LAST_AT` y `ZIMA_BACKUP_LAST_FILE_ID` registran el último respaldo exitoso. Revisar los avisos de fallos de activadores de Google.
4. Actualizar la implementación web existente seleccionando una nueva versión para conservar la URL `/exec`.
5. Publicar `zima-ui.js` y el `login.html` actualizado. Ingresar nuevamente. Las sesiones antiguas sin fecha válida requerirán otro ingreso.
6. Probar con una cuenta de prueba: usar la plataforma durante más de 15 minutos debe mantener la sesión; dejarla inactiva 15 minutos debe impedir nuevas operaciones y regresar al login. Las consultas automáticas no renuevan la sesión. Se conserva el límite general del token de 6 horas.

Los respaldos incluyen todas las hojas del archivo, con usuarios y auditoría. No se comparten automáticamente y no se borran copias antiguas. Supervisar el espacio disponible en Drive. Cada cuenta debe evitar instalar activadores adicionales; la detección de duplicados cubre los activadores de la cuenta que ejecuta la configuración.

Para comprobar una restauración, abrir una copia sin modificar producción y verificar planillas, usuarios y auditoría. Una restauración real requiere elegir explícitamente el respaldo y actualizar `ZIMA_SPREADSHEET_ID`; no reemplazar la base operativa sin revisión.

Pruebas locales: `node tests/idle-logout.cjs`, `node tests/session-backups.cjs` y `node tests/password-renewal.cjs`.
