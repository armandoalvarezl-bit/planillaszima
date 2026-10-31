# Fechas de recaudo y recambio

El sistema identifica el tipo automáticamente por las observaciones, sin selector:

- **Recaudo:** la fecha del dinero recaudado.
- **Recambio de TransBank:** contiene la palabra «recambio» (o «re cambio») en
  Observaciones, incluyendo la observación del valor. Lleva la fecha de la visita.
- Si no contiene esa marca, se trata como **recaudo**, con la fecha del recaudo.

Para un mismo peaje puede existir una planilla activa de recaudo y una de recambio
con la misma fecha. No pueden existir dos activas del mismo tipo, fecha y peaje,
aunque tengan códigos diferentes. La validación también se aplica al editar y
restaurar. Las anuladas no ocupan la fecha; sus códigos siguen reservados.
El valor entregado no modifica esta regla. Por ejemplo: un recambio del 31 de
octubre permite registrar el lunes 2 de noviembre un recaudo fechado el 31 de
octubre, con otro código y otro valor, siempre que no haya otro recaudo de ese día.

La fecha, el tipo y el peaje se comprueban automáticamente, sin una confirmación
adicional antes de guardar. El aviso de duplicado aparece solo si hay conflicto. Se rechazan
fechas inexistentes o futuras, usando la fecha de Colombia. Se permite preparar
planillas de días anteriores, sin limitar el día de diligenciamiento ni imponer
un calendario de visitas que pueda impedir registrar una visita excepcional.

En el ciclo habitual, los recaudos del viernes, sábado y domingo conservan cada
uno su fecha; el recambio de la visita del lunes lleva la del lunes. Los recaudos
del lunes y martes se distinguen del recambio de la visita del miércoles, y los
del miércoles y jueves del recambio de la visita del viernes.

## Registros anteriores

Se conserva `tipoPlanilla` como dato interno al final de la hoja PLANILLAS.
La marca en Observaciones prevalece sobre cualquier tipo almacenado anteriormente
o enviado por el cliente. Esto también se aplica a las planillas antiguas.
Para corregir una antigua planilla de recambio, escribir «recambio» en sus
observaciones y guardar. No se borran filas en masa. Los duplicados que ya
existan se deben revisar manualmente.

La comprobación en el servidor comparte el bloqueo de escritura del guardado,
evitando que dos solicitudes simultáneas registren la misma fecha y tipo.

## Activación

Actualizar `code.gs` en Apps Script y publicar una nueva versión de la misma
implementación. Publicar `planilla.html`, `historial.html` y `zima-ui.js`.
No es necesario ejecutar `setupSistema()` ni borrar datos.

## Comprobación

```sh
node tests/planilla-duplicates.cjs
node tests/planilla-save-print.cjs
node tests/historial-duplicates.cjs
```
