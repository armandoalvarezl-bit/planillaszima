# Códigos únicos de planilla

El servidor impide crear o modificar una planilla con un código que ya esté
asignado a otra. La comparación ignora mayúsculas y espacios al principio y al
final. El código es único en toda la plataforma, incluso para planillas anuladas.
La comprobación y la escritura se ejecutan bajo el mismo bloqueo del servidor.

Cuando hay un duplicado, el formulario muestra un aviso y un enlace para abrir
la planilla existente si el usuario tiene acceso a su peaje. El usuario revisa
el registro y guarda sus ajustes desde allí. El intento rechazado no modifica
la planilla original. Los duplicados que ya existan deben revisarse manualmente.

## Activación

1. Copiar el archivo `code.gs` de la raíz del proyecto al proyecto de Apps Script
   que atiende la URL `API_URL`. `backend/Code.gs` es una versión antigua.
2. En Apps Script, ir a **Implementar > Gestionar implementaciones > Editar**,
   elegir **Nueva versión** y actualizar conservando la URL `/exec`.
3. Publicar `planilla.html`, `login.html` y `dashboard.html` en el alojamiento
   habitual. Los dos últimos incluyen la animación suave del logo, que respeta
   la preferencia del dispositivo de reducir movimiento.

## Verificación local

```sh
node tests/planilla-duplicates.cjs
node tests/planilla-save-print.cjs
node tests/password-renewal.cjs
```
