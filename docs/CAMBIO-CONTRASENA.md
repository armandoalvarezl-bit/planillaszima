# Renovación obligatoria de contraseña

Las contraseñas vencen a los tres meses calendario. El servidor comprueba la
vigencia al iniciar sesión y al consultar o modificar datos con una sesión.
Si venció, el login muestra el formulario de cambio y solo permite entrar
después de guardar la contraseña y autenticarse nuevamente.

La columna `FECHA_CAMBIO_CONTRASENA` se añade automáticamente a `USUARIOS`.
Para cuentas existentes sin ese dato se usa `FECHA_CREACION`. Si tampoco
hay una fecha válida, se exige el cambio en el siguiente ingreso. La migración
de contraseñas antiguas a hash no reinicia su vigencia.

El formulario verifica la contraseña actual, la confirmación, un mínimo de
6 caracteres y que la nueva sea diferente. El servidor guarda el hash y la fecha
en Google Sheets. Las sesiones anteriores al cambio dejan de permitir operaciones.
La nueva contraseña se envía por POST y no se guarda en el almacenamiento local.

## Activación

1. Actualizar el proyecto de Apps Script que atiende la URL `API_URL` del login
   con el archivo **`code.gs` de la raíz de este proyecto**. El archivo
   `backend/Code.gs` corresponde a una versión antigua sin autenticación.
2. En Apps Script, abrir **Implementar > Gestionar implementaciones > Editar**,
   seleccionar **Nueva versión** y actualizar la implementación existente para
   conservar la URL `/exec`.
3. Publicar los archivos actualizados `login.html` y `dashboard.html` en el
   alojamiento habitual. El cambio requiere tanto el backend como el frontend.
4. Probar una cuenta con `FECHA_CREACION` de hace más de tres meses y sin fecha
   de cambio: debe exigir renovación. Guardar, volver a ingresar con la nueva
   contraseña y comprobar que la anterior ya no funciona.

Pruebas locales con servicios de Apps Script simulados:
`node tests/password-renewal.cjs`.
