const SPREADSHEET_ID='PEGA_AQUI_EL_ID_DE_TU_GOOGLE_SHEET';
const SHEET_NAME='Planillas';
const HEADERS=['id','codigo','peaje','razon','moneda','lugarEntrega','recibe','ciudad','lugarRecibo','fecha','concepto','total','obsValor','tula','billetes','letras','observaciones','entregadoNombre','entregadoFirma','revisadoNombre','revisadoFirma','estado','createdAt','updatedAt'];
function db(){if(SPREADSHEET_ID.includes('PEGA_AQUI'))throw Error('Configura SPREADSHEET_ID.');const ss=SpreadsheetApp.openById(SPREADSHEET_ID);let sh=ss.getSheetByName(SHEET_NAME);if(!sh)sh=ss.insertSheet(SHEET_NAME);if(sh.getLastRow()===0)sh.appendRow(HEADERS);return sh}

function inicializar(){db()}

function doGet(e){const page=((e&&e.parameter&&e.parameter.page)||'dashboard').replace(/[^a-z]/gi,'');const allowed=['dashboard','planilla','guardar','historial','pdf'];const file=allowed.includes(page)?page:'dashboard';return HtmlService.createTemplateFromFile(file).evaluate().setTitle('ZIMA · Gestión de efectivo').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)}

function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const data = JSON.parse(body);
    const result = apiPost(data);
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err.message || err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

function apiGet(p){try{if((p.action||'list')==='list')return {ok:true,rows:list()};if(p.action==='get')return {ok:true,row:get(p.id)};return {ok:false,error:'Acción no soportada'}}catch(x){return {ok:false,error:String(x.message||x)}}}

function apiPost(d){try{if(d.action==='save')return {ok:true,row:save(d)};if(d.action==='update')return {ok:true,row:update(d)};if(d.action==='delete'){del(d.id);return {ok:true}}return {ok:false,error:'Acción no soportada'}}catch(x){return {ok:false,error:String(x.message||x)}}}

function list(){let v=db().getDataRange().getValues();return v.length<2?[]:v.slice(1).filter(r=>r[0]).map(row).reverse()}

function get(id){let v=db().getDataRange().getValues();for(let i=1;i<v.length;i++)if(String(v[i][0])===String(id))return row(v[i]);throw Error('No se encontró la planilla.')}

function obj(d,id,created,updated){let o={};HEADERS.forEach(h=>o[h]=d[h]??'');o.id=id;o.createdAt=created;o.updatedAt=updated;o.total=Number(d.total||0);o.tula=Number(d.tula||0);o.billetes=Number(d.billetes||0);o.estado=d.estado||'BORRADOR';if(!o.codigo)o.codigo='P'+String(d.fecha||'').replace(/-/g,'')+id.slice(-4);return o}

function save(d){let sh=db(),id=String(Date.now()),now=new Date().toISOString(),o=obj(d,id,now,now);sh.appendRow(HEADERS.map(h=>o[h]??''));return o}

function update(d){let sh=db();for(let i=2;i<=sh.getLastRow();i++)if(String(sh.getRange(i,1).getValue())===String(d.id)){let old=row(sh.getRange(i,1,1,HEADERS.length).getValues()[0]),o=obj(Object.assign({},old,d),String(d.id),old.createdAt||new Date().toISOString(),new Date().toISOString());sh.getRange(i,1,1,HEADERS.length).setValues([HEADERS.map(h=>o[h]??'')]);return o}throw Error('No se encontró la planilla.')}

function del(id){let sh=db();for(let i=2;i<=sh.getLastRow();i++)if(String(sh.getRange(i,1).getValue())===String(id)){sh.deleteRow(i);return}throw Error('No se encontró la planilla.')}

function row(r){let o={};HEADERS.forEach((h,i)=>o[h]=r[i] instanceof Date?Utilities.formatDate(r[i],Session.getScriptTimeZone(),'yyyy-MM-dd'):r[i]);return o}
