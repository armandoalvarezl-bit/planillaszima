# ZIMA 360

Sistema modular de gestión de efectivo y planillas de control.

## Estructura

- `dashboard.html` — Dashboard.
- `planilla.html` — Formulario de planilla.
- `guardar.html` — Confirmación de guardado.
- `historial.html` — Historial, búsqueda, edición y eliminación.
- `pdf.html` — Vista imprimible del documento.
- `zima.css` — Estilos compartidos.
- `backend/Code.gs` — API de Google Apps Script + Google Sheets.
- `assets/logos/` — Recursos gráficos.
- `docs/CONFIGURACION.txt` — Puesta en marcha.

## Principio de separación

Cada pantalla es un HTML independiente. El CSS común está separado para que un cambio visual global pueda hacerse en un solo lugar; la lógica específica de cada módulo permanece dentro de su propio HTML.

## Almacenamiento en línea

La fuente de datos es Google Sheets mediante Google Apps Script. No se depende de `localStorage` para almacenar las planillas.
