# Manejo de Dineros Transbank

Aplicacion local basada en el archivo `Formato_Manejo_Dineros_Transbank_Peaje_Zaragoza.ods`.

## Como usar

1. Abrir `index.html` en el navegador.
2. Completar los datos del formato.
3. Escribir los valores de efectivo, tula y billetes.
4. Usar `Guardar` para enviar el registro al Excel online.
5. Entrar a `Registros` para consultar el Excel, abrir, eliminar, exportar CSV o exportar JSON.
6. Usar `Imprimir` para generar el formato fisico o guardarlo como PDF desde el navegador.

Los registros no se guardan en el navegador. El guardado valido es el de la hoja online.

## Acceso por peaje

La app pide login antes de mostrar la planilla. Cada peaje solo consulta, guarda y elimina sus propios registros.

Al desplegar el Apps Script, el Excel crea automaticamente otra hoja llamada `USUARIOS PLANILLAS` con estos accesos iniciales:

- Peaje Zaragoza: `zaragoza123`
- Peaje Fragua: `fragua123`

Puedes cambiar las claves editando la columna `password` en esa hoja.

## Guardar en hoja online

1. Crear una hoja de calculo en Google Sheets.
2. Abrir `Extensiones > Apps Script`.
3. Pegar el contenido de `apps-script-planillas.gs`.
4. Guardar y desplegar como `Aplicacion web`.
5. En acceso, seleccionar quien pueda usarla segun tu necesidad.
6. Copiar la URL que termina en `/exec`.
7. Pegar esa URL en `DEFAULT_SCRIPT_URL` dentro de `app.js`.

El script crea o usa una pestaña llamada `BASE DE DATOS PLANILLAS` y otra llamada `USUARIOS PLANILLAS`.

Si el script se pega dentro del Apps Script de la hoja actual, guarda en esa misma hoja.
Si se usa como proyecto independiente, pega el ID de la hoja en `SPREADSHEET_ID` dentro de `apps-script-planillas.gs`.

La app ya trae configurada esta URL por defecto:

`https://script.google.com/macros/s/AKfycbycgSSYUykUf_CfuuHepNnZcTe_wFxHT8tavUHhnZUjKL1l6RDSkT_IQuY_s2_ehhzMoA/exec`
