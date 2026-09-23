/**
 * Calendario Directivo PRISA Media - API V1.2 Optimizada
 * Google Apps Script Web App
 *
 * Compatible con EVENTOS de 16 columnas.
 * Incluye bootstrap único, catálogos dinámicos y versión ligera para sincronización.
 */

const SPREADSHEET_ID = '1JMhOlIAcrMntxnqzQ9LNoK-EoRVQNEC33BNT79zcRig';
const TZ = 'America/Bogota';
const VERSION_KEY = 'CALENDAR_DATA_VERSION';
const CACHE = {
  CONFIG_KEY: 'calendar_config_v1',
  CONFIG_SECONDS: 600
};

const SHEETS = {
  EVENTS: 'EVENTOS',
  SPECIAL_DAYS: 'DIAS_ESPECIALES',
  CONFIG: 'CONFIGURACION'
};

const EVENT_HEADERS = [
  'ID', 'Tipo', 'Nombre', 'Sistema', 'Fecha_Inicio', 'Fecha_Fin',
  'Hora_Inicio', 'Hora_Fin', 'Talentos', 'Ejecutivos',
  'Comercializable', 'Disponibilidad', 'Descripcion', 'Enlace',
  'Fecha_Creacion', 'Fecha_Modificacion'
];

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || 'bootstrap').toLowerCase();

    switch (action) {
      case 'bootstrap': {
        const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
        return ok_({
          events: getEvents_(ss.getSheetByName(SHEETS.EVENTS)),
          specialDays: getSpecialDays_(ss.getSheetByName(SHEETS.SPECIAL_DAYS)),
          config: getConfig_(ss.getSheetByName(SHEETS.CONFIG)),
          version: getVersion_()
        });
      }
      case 'version':
        return ok_({ version: getVersion_() });
      case 'events':
        return ok_({ events: getEvents_(), version: getVersion_() });
      case 'specialdays':
        return ok_({ specialDays: getSpecialDays_(), version: getVersion_() });
      case 'config':
        return ok_({ config: getConfig_(), version: getVersion_() });
      default:
        throw new Error('Acción GET no válida.');
    }
  } catch (err) {
    return fail_(err);
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);
    const body = parseBody_(e);
    const action = String(body.action || '').toLowerCase();
    let result;

    switch (action) {
      case 'create':
        result = { event: createEvent_(body.event || body.data || {}) };
        break;
      case 'update':
        result = { event: updateEvent_(body.id || (body.event || {}).ID, body.event || body.data || {}) };
        break;
      case 'delete':
        result = { deletedId: deleteEvent_(body.id) };
        break;
      default:
        throw new Error('Acción POST no válida. Use create, update o delete.');
    }

    result.version = touchVersion_();
    return ok_(result);
  } catch (err) {
    return fail_(err);
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function getEvents_(sheet) {
  sheet = sheet || sheet_(SHEETS.EVENTS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const rows = sheet.getRange(1, 1, lastRow, EVENT_HEADERS.length).getValues();

  const headers = rows[0].map(String);

  return rows.slice(1)
    .filter(row => String(row[0] || '').trim() !== '')
    .map(row => rowToObject_(headers, row))
    .map(normalizeOutputEvent_);
}

function getSpecialDays_(sheet) {
  sheet = sheet || sheet_(SHEETS.SPECIAL_DAYS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const rows = sheet.getRange(1, 1, lastRow, 5).getValues();

  const headers = rows[0].map(String);
  return rows.slice(1)
    .filter(row => row.some(v => String(v || '').trim() !== ''))
    .map(row => rowToObject_(headers, row))
    .map(obj => {
      obj.Fecha_Inicio = dateOut_(obj.Fecha_Inicio);
      obj.Fecha_Fin = dateOut_(obj.Fecha_Fin);
      return obj;
    });
}

function getConfig_(sheet, bypassCache) {
  const cache = CacheService.getScriptCache();

  if (!bypassCache) {
    const cached = cache.get(CACHE.CONFIG_KEY);
    if (cached) {
      try { return JSON.parse(cached); } catch (_) {}
    }
  }

  sheet = sheet || sheet_(SHEETS.CONFIG);
  const lastRow = sheet.getLastRow();
  const lastCol = Math.min(sheet.getLastColumn(), 7);

  let result = {
    tiposEvento: [], sistemas: [], talentos: [], ejecutivos: [],
    comercializable: [], disponibilidad: [], tiposDiaEspecial: []
  };

  if (lastRow >= 2 && lastCol > 0) {
    const rows = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    const headers = rows[0].map(v => clean_(v));
    const cols = {};

    headers.forEach((h, i) => {
      if (!h) return;
      cols[h] = unique_(rows.slice(1).map(r => clean_(r[i])).filter(Boolean));
    });

    result = {
      tiposEvento: cols.Tipos_Evento || [],
      sistemas: cols.Sistema || [],
      talentos: cols.Talentos || [],
      ejecutivos: cols.Ejecutivos || [],
      comercializable: cols.Comercializable || [],
      disponibilidad: cols.Disponibilidad || [],
      tiposDiaEspecial: cols.Tipo_Dia_Especial || []
    };
  }

  try {
    cache.put(CACHE.CONFIG_KEY, JSON.stringify(result), CACHE.CONFIG_SECONDS);
  } catch (_) {}

  return result;
}

function invalidateConfigCache_() {
  try { CacheService.getScriptCache().remove(CACHE.CONFIG_KEY); } catch (_) {}
}

function createEvent_(input) {
  const data = validateEvent_(input, null);
  const now = new Date();

  const record = {
    ID: Utilities.getUuid(),
    Tipo: data.Tipo,
    Nombre: data.Nombre,
    Sistema: data.Sistema,
    Fecha_Inicio: data.Fecha_Inicio,
    Fecha_Fin: data.Fecha_Fin || '',
    Hora_Inicio: data.Hora_Inicio || '',
    Hora_Fin: data.Hora_Fin || '',
    Talentos: joinMulti_(data.Talentos),
    Ejecutivos: joinMulti_(data.Ejecutivos),
    Comercializable: data.Comercializable,
    Disponibilidad: data.Comercializable === 'Sí' ? data.Disponibilidad : '',
    Descripcion: data.Descripcion || '',
    Enlace: data.Enlace || '',
    Fecha_Creacion: now,
    Fecha_Modificacion: now
  };

  const sheet = sheet_(SHEETS.EVENTS);
  sheet.appendRow(EVENT_HEADERS.map(h => record[h]));

  return normalizeOutputEvent_(record);
}

function updateEvent_(id, input) {
  id = clean_(id);
  if (!id) throw new Error('Falta el ID del evento.');

  const sheet = sheet_(SHEETS.EVENTS);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('Evento no encontrado.');
  const values = sheet.getRange(1, 1, lastRow, EVENT_HEADERS.length).getValues();
  const headers = values[0].map(String);
  const rowIndex = values.findIndex((row, i) => i > 0 && String(row[0]) === id);

  if (rowIndex < 1) throw new Error('Evento no encontrado.');

  const existing = rowToObject_(headers, values[rowIndex]);
  const merged = Object.assign({}, existing, input, { ID: id });
  const data = validateEvent_(merged, existing);

  const record = {
    ID: id,
    Tipo: data.Tipo,
    Nombre: data.Nombre,
    Sistema: data.Sistema,
    Fecha_Inicio: data.Fecha_Inicio,
    Fecha_Fin: data.Fecha_Fin || '',
    Hora_Inicio: data.Hora_Inicio || '',
    Hora_Fin: data.Hora_Fin || '',
    Talentos: joinMulti_(data.Talentos),
    Ejecutivos: joinMulti_(data.Ejecutivos),
    Comercializable: data.Comercializable,
    Disponibilidad: data.Comercializable === 'Sí' ? data.Disponibilidad : '',
    Descripcion: data.Descripcion || '',
    Enlace: data.Enlace || '',
    Fecha_Creacion: existing.Fecha_Creacion || new Date(),
    Fecha_Modificacion: new Date()
  };

  sheet.getRange(rowIndex + 1, 1, 1, EVENT_HEADERS.length)
    .setValues([EVENT_HEADERS.map(h => record[h])]);

  return normalizeOutputEvent_(record);
}

function deleteEvent_(id) {
  id = clean_(id);
  if (!id) throw new Error('Falta el ID del evento.');

  const sheet = sheet_(SHEETS.EVENTS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('Evento no encontrado.');

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
  const offset = ids.findIndex(row => row[0] === id);
  if (offset < 0) throw new Error('Evento no encontrado.');

  sheet.deleteRow(offset + 2);
  return id;
}

function validateEvent_(input, existing) {
  const config = getConfig_();

  const data = {
    Tipo: clean_(input.Tipo || input.tipo),
    Nombre: clean_(input.Nombre || input.nombre),
    Sistema: clean_(input.Sistema || input.sistema),
    Fecha_Inicio: parseDate_(input.Fecha_Inicio || input.fechaInicio || input.fecha_inicio),
    Fecha_Fin: parseOptionalDate_(input.Fecha_Fin || input.fechaFin || input.fecha_fin),
    Hora_Inicio: parseOptionalTime_(input.Hora_Inicio || input.horaInicio || input.hora_inicio),
    Hora_Fin: parseOptionalTime_(input.Hora_Fin || input.horaFin || input.hora_fin),
    Talentos: parseMulti_(input.Talentos !== undefined ? input.Talentos : input.talentos),
    Ejecutivos: parseMulti_(input.Ejecutivos !== undefined ? input.Ejecutivos : input.ejecutivos),
    Comercializable: normalizeYesNo_(input.Comercializable || input.comercializable),
    Disponibilidad: clean_(input.Disponibilidad || input.disponibilidad),
    Descripcion: clean_(input.Descripcion || input.descripcion),
    Enlace: clean_(input.Enlace || input.enlace)
  };

  if (!data.Tipo) throw new Error('Tipo es obligatorio.');
  if (!allowedOrLegacy_(data.Tipo, config.tiposEvento, existing && existing.Tipo)) {
    throw new Error('Tipo de evento no válido.');
  }

  if (!data.Nombre) throw new Error('Nombre es obligatorio.');

  if (!data.Sistema) throw new Error('Sistema es obligatorio.');
  if (!allowedOrLegacy_(data.Sistema, config.sistemas, existing && existing.Sistema)) {
    throw new Error('Sistema no válido.');
  }

  if (!data.Fecha_Inicio) throw new Error('Fecha de inicio es obligatoria.');
  if (data.Fecha_Fin && stripTime_(data.Fecha_Fin) < stripTime_(data.Fecha_Inicio)) {
    throw new Error('La fecha de fin no puede ser anterior a la fecha de inicio.');
  }

  if (data.Hora_Fin && !data.Hora_Inicio) {
    throw new Error('Hora de inicio es obligatoria cuando se especifica una hora de fin.');
  }

  validateMultiCatalog_(data.Talentos, config.talentos, existing && existing.Talentos, 'Talento');
  validateMultiCatalog_(data.Ejecutivos, config.ejecutivos, existing && existing.Ejecutivos, 'Ejecutivo');

  if (!data.Comercializable) throw new Error('Comercializable es obligatorio.');

  if (data.Comercializable === 'Sí') {
    if (!data.Disponibilidad) {
      throw new Error('Disponibilidad es obligatoria para eventos comercializables.');
    }
    const allowedAvailability = config.disponibilidad.length
      ? config.disponibilidad
      : ['Disponible', 'Cupo lleno'];
    if (!allowedOrLegacy_(data.Disponibilidad, allowedAvailability, existing && existing.Disponibilidad)) {
      throw new Error('Disponibilidad no válida.');
    }
  } else {
    data.Disponibilidad = '';
  }

  if (data.Enlace && !/^https?:\/\//i.test(data.Enlace)) {
    throw new Error('El enlace debe comenzar por http:// o https://');
  }

  return data;
}

function ensureEventSchema_(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), EVENT_HEADERS.length);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].slice(0, EVENT_HEADERS.length).map(String);
  if (EVENT_HEADERS.some((h, i) => headers[i] !== h)) {
    throw new Error('La hoja EVENTOS no coincide con el esquema esperado de 16 columnas.');
  }
}

function allowedOrLegacy_(value, catalog, legacyValue) {
  if (!catalog.length || catalog.includes(value)) return true;
  return clean_(legacyValue) === value;
}

function validateMultiCatalog_(values, catalog, legacyRaw, label) {
  if (!catalog.length) return;
  const legacy = parseMulti_(legacyRaw);
  values.forEach(v => {
    if (!catalog.includes(v) && !legacy.includes(v)) {
      throw new Error(label + ' no válido: ' + v);
    }
  });
}

function parseMulti_(value) {
  const raw = Array.isArray(value) ? value : clean_(value).split('|');
  return unique_(raw.map(clean_).filter(Boolean));
}

function joinMulti_(values) {
  return parseMulti_(values).join(' | ');
}

function unique_(values) {
  return [...new Set(values)];
}

function parseOptionalTime_(value) {
  if (value === null || value === undefined || value === '') return '';

  if (value instanceof Date && !isNaN(value)) {
    return Utilities.formatDate(value, TZ, 'HH:mm');
  }

  const s = clean_(value);
  if (!s) return '';

  let m = s.match(/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
  if (m) return m[1] + ':' + m[2];

  const d = new Date(s);
  if (!isNaN(d)) return Utilities.formatDate(d, TZ, 'HH:mm');

  throw new Error('Hora no válida. Use formato HH:mm.');
}

function getVersion_() {
  const props = PropertiesService.getScriptProperties();
  let version = props.getProperty(VERSION_KEY);
  if (!version) {
    version = String(Date.now());
    props.setProperty(VERSION_KEY, version);
  }
  return version;
}

function touchVersion_() {
  const version = String(Date.now());
  PropertiesService.getScriptProperties().setProperty(VERSION_KEY, version);
  return version;
}

/**
 * Instala una sola vez el trigger de edición sobre la hoja. Es necesario
 * porque este proyecto de Apps Script es independiente, no vinculado a la Sheet.
 */
function installSpreadsheetEditTrigger_() {
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'handleSpreadsheetEdit_')
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger('handleSpreadsheetEdit_')
    .forSpreadsheet(SPREADSHEET_ID)
    .onEdit()
    .create();
}

/**
 * Detecta ediciones manuales hechas por una persona directamente en
 * EVENTOS, DIAS_ESPECIALES o CONFIGURACION.
 * Los cambios realizados por la API llaman touchVersion_() explícitamente.
 */
function handleSpreadsheetEdit_(e) {
  try {
    const sheet = e && e.range && e.range.getSheet();
    if (!sheet) return;
    const name = sheet.getName();
    if ([SHEETS.EVENTS, SHEETS.SPECIAL_DAYS, SHEETS.CONFIG].includes(name)) {
      if (name === SHEETS.CONFIG) invalidateConfigCache_();
      touchVersion_();
    }
  } catch (err) {
    console.error(err);
  }
}

function sheet_(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('No existe la hoja: ' + name);
  return sheet;
}

function rowToObject_(headers, row) {
  const obj = {};
  headers.forEach((h, i) => obj[h] = row[i]);
  return obj;
}

function normalizeOutputEvent_(obj) {
  const out = Object.assign({}, obj);
  out.Fecha_Inicio = dateOut_(out.Fecha_Inicio);
  out.Fecha_Fin = dateOut_(out.Fecha_Fin);
  out.Hora_Inicio = timeOut_(out.Hora_Inicio);
  out.Hora_Fin = timeOut_(out.Hora_Fin);
  out.Talentos = parseMulti_(out.Talentos);
  out.Ejecutivos = parseMulti_(out.Ejecutivos);
  out.Fecha_Creacion = dateTimeOut_(out.Fecha_Creacion);
  out.Fecha_Modificacion = dateTimeOut_(out.Fecha_Modificacion);
  return out;
}

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('Solicitud sin cuerpo JSON.');
  }
  try {
    return JSON.parse(e.postData.contents);
  } catch (_) {
    throw new Error('JSON inválido.');
  }
}

function parseDate_(value) {
  if (value instanceof Date && !isNaN(value)) return value;
  const s = clean_(value);
  if (!s) return null;

  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);

  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function parseOptionalDate_(value) {
  if (value === null || value === undefined || clean_(value) === '') return null;
  const d = parseDate_(value);
  if (!d) throw new Error('Fecha de fin no válida.');
  return d;
}

function normalizeYesNo_(value) {
  const s = clean_(value).toLowerCase();
  if (['sí', 'si', 'true', '1'].includes(s)) return 'Sí';
  if (['no', 'false', '0'].includes(s)) return 'No';
  return '';
}

function clean_(value) {
  return String(value === null || value === undefined ? '' : value).trim();
}

function stripTime_(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function dateOut_(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d)) return clean_(value);
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}

function timeOut_(value) {
  if (!value) return '';
  if (value instanceof Date && !isNaN(value)) return Utilities.formatDate(value, TZ, 'HH:mm');
  const s = clean_(value);
  const m = s.match(/^([01]\d|2[0-3]):([0-5]\d)/);
  return m ? m[1] + ':' + m[2] : s;
}

function dateTimeOut_(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d)) return clean_(value);
  return Utilities.formatDate(d, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function ok_(data) {
  return json_({ ok: true, data: data });
}

function fail_(err) {
  console.error(err);
  return json_({
    ok: false,
    error: err && err.message ? err.message : String(err)
  });
}

/**
 * Diagnóstico simple de tiempos. No modifica datos.
 * Ejecutar manualmente desde Apps Script si se desea medir cada bloque.
 */
function benchmarkRead_() {
  const t0 = Date.now();
  const version = getVersion_();
  const t1 = Date.now();

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const t2 = Date.now();

  const config = getConfig_(ss.getSheetByName(SHEETS.CONFIG));
  const t3 = Date.now();

  const events = getEvents_(ss.getSheetByName(SHEETS.EVENTS));
  const t4 = Date.now();

  const specialDays = getSpecialDays_(ss.getSheetByName(SHEETS.SPECIAL_DAYS));
  const t5 = Date.now();

  console.log(JSON.stringify({
    versionMs: t1 - t0,
    openSpreadsheetMs: t2 - t1,
    configMs: t3 - t2,
    eventsMs: t4 - t3,
    specialDaysMs: t5 - t4,
    totalMs: t5 - t0,
    counts: {
      events: events.length,
      specialDays: specialDays.length,
      sistemas: config.sistemas.length
    },
    version: version
  }, null, 2));
}

/**
 * Prueba interna de lectura. No modifica datos.
 */
function testRead_() {
  console.log(JSON.stringify({
    events: getEvents_(),
    specialDays: getSpecialDays_(),
    config: getConfig_(),
    version: getVersion_()
  }, null, 2));
}
