const ZIMA = {
  VERSION: '2.0.0',

  SPREADSHEET_PROPERTY: 'ZIMA_SPREADSHEET_ID',

  SHEET_PLANILLAS: 'PLANILLAS',
  SHEET_AUDITORIA: 'AUDITORIA',
  SHEET_CONFIG: 'CONFIG',
  SHEET_USUARIOS: 'USUARIOS',

  SESSION_PREFIX: 'ZIMA_SESSION_',
  SESSION_SECONDS: 21600, // 6 horas

  HEADERS: [
    'id',
    'codigo',
    'peaje',
    'razon',
    'moneda',
    'lugarEntrega',
    'recibe',
    'ciudad',
    'lugarRecibo',
    'fecha',
    'concepto',
    'total',
    'obsValor',
    'tula',
    'billetes',
    'letras',
    'observaciones',
    'entregadoNombre',
    'entregadoFirma',
    'revisadoNombre',
    'revisadoFirma',
    'estado',
    'usuario',
    'createdAt',
    'updatedAt'
  ],

  USUARIOS_HEADERS: [
    'ID',
    'USUARIO',
    'CONTRASENA',
    'NOMBRE',
    'ROL',
    'PEAJE',
    'ESTADO',
    'FECHA_CREACION',
    'ULTIMO_INGRESO',
    'EMAIL',
    'TELEFONO',
    'CARGO',
    'FOTO'
  ]
};


/* ============================================================
   INICIALIZACIÓN
   ============================================================ */

function setupSistema() {

  const props = PropertiesService.getScriptProperties();

  let spreadsheetId =
    props.getProperty(ZIMA.SPREADSHEET_PROPERTY);

  let ss = null;

  if (spreadsheetId) {
    try {
      ss = SpreadsheetApp.openById(spreadsheetId);
    } catch (e) {
      ss = null;
      spreadsheetId = null;
    }
  }

  if (!ss) {
    // Si el proyecto está vinculado a una hoja de cálculo,
    // usamos esa hoja. Si es un proyecto independiente,
    // creamos una hoja nueva.
    try {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    } catch (e) {
      ss = null;
    }

    if (ss) {
      spreadsheetId = ss.getId();
    } else {
      ss = SpreadsheetApp.create(
        'ZIMA 360 · Gestión de Planillas'
      );
      spreadsheetId = ss.getId();
    }

    props.setProperty(
      ZIMA.SPREADSHEET_PROPERTY,
      spreadsheetId
    );
  }

  const planillas =
    prepararHojaPlanillas_(ss);

  const auditoria =
    prepararHojaAuditoria_(ss);

  const config =
    prepararHojaConfig_(ss);

  const usuarios =
    prepararHojaUsuarios_(ss);

  const configActual =
    leerConfigMap_(
      config
    );

  const configValues = [
    ['PARAMETRO', 'VALOR'],
    ['SISTEMA', 'ZIMA 360'],
    ['VERSION', ZIMA.VERSION],
    ['SPREADSHEET_ID', spreadsheetId],
    ['SPREADSHEET_URL', ss.getUrl()],
    ['HOJA_PLANILLAS', ZIMA.SHEET_PLANILLAS],
    ['HOJA_AUDITORIA', ZIMA.SHEET_AUDITORIA],
    ['HOJA_CONFIG', ZIMA.SHEET_CONFIG],
    ['HOJA_USUARIOS', ZIMA.SHEET_USUARIOS],
    ['WEB_APP_URL', obtenerWebAppUrl_() || ''],
    [
      'CORREOS_NOTIFICACION',
      configActual.CORREOS_NOTIFICACION ||
      'sistemaplanillaszima@gmail.com'
    ],
    ['FECHA_CONFIGURACION', new Date()]
  ];

  config.clearContents();

  config
    .getRange(1, 1, configValues.length, 2)
    .setValues(configValues);

  config
    .getRange(1, 1, 1, 2)
    .setFontWeight('bold');

  config.autoResizeColumns(1, 2);

  crearUsuariosIniciales_(ss);

  return {
    ok: true,
    message: 'ZIMA 360 configurado correctamente.',
    spreadsheetId: spreadsheetId,
    spreadsheetUrl: ss.getUrl(),
    webAppUrl: obtenerWebAppUrl_() || '',
    sheets: {
      planillas: planillas.getName(),
      auditoria: auditoria.getName(),
      config: config.getName(),
      usuarios: usuarios.getName()
    }
  };
}


/* ============================================================
   CONFIGURACIÓN
   ============================================================ */

function obtenerConfiguracion() {

  const id =
    PropertiesService
      .getScriptProperties()
      .getProperty(
        ZIMA.SPREADSHEET_PROPERTY
      );

  if (!id) {

    return {
      ok: false,
      error:
        'El sistema aún no está configurado. Ejecute setupSistema().'
    };
  }

  const ss =
    SpreadsheetApp.openById(id);

  return {
    ok: true,
    spreadsheetId: id,
    spreadsheetUrl: ss.getUrl(),
    webAppUrl: obtenerWebAppUrl_() || '',
    version: ZIMA.VERSION
  };
}


/* ============================================================
   HOJA PLANILLAS
   ============================================================ */

function prepararHojaPlanillas_(ss) {

  let sh =
    ss.getSheetByName(
      ZIMA.SHEET_PLANILLAS
    );

  if (!sh) {
    sh = ss.insertSheet(
      ZIMA.SHEET_PLANILLAS
    );
  }

  if (sh.getLastRow() === 0) {

    sh
      .getRange(
        1,
        1,
        1,
        ZIMA.HEADERS.length
      )
      .setValues([
        ZIMA.HEADERS
      ]);

  } else {

    const current =
      sh
        .getRange(
          1,
          1,
          1,
          Math.max(
            sh.getLastColumn(),
            1
          )
        )
        .getValues()[0];

    if (
      current.filter(String).length === 0
    ) {

      sh
        .getRange(
          1,
          1,
          1,
          ZIMA.HEADERS.length
        )
        .setValues([
          ZIMA.HEADERS
        ]);
    }
  }

  sh.setFrozenRows(1);

  sh
    .getRange(
      1,
      1,
      1,
      ZIMA.HEADERS.length
    )
    .setFontWeight('bold');

  const totalCol =
    ZIMA.HEADERS.indexOf('total') + 1;

  const tulaCol =
    ZIMA.HEADERS.indexOf('tula') + 1;

  const billetesCol =
    ZIMA.HEADERS.indexOf('billetes') + 1;

  const fechaCol =
    ZIMA.HEADERS.indexOf('fecha') + 1;

  if (totalCol > 0) {

    sh
      .getRange(
        2,
        totalCol,
        Math.max(
          sh.getMaxRows() - 1,
          1
        )
      )
      .setNumberFormat(
        '$ #,##0'
      );
  }

  if (tulaCol > 0) {

    sh
      .getRange(
        2,
        tulaCol,
        Math.max(
          sh.getMaxRows() - 1,
          1
        )
      )
      .setNumberFormat(
        '$ #,##0'
      );
  }

  if (billetesCol > 0) {

    sh
      .getRange(
        2,
        billetesCol,
        Math.max(
          sh.getMaxRows() - 1,
          1
        )
      )
      .setNumberFormat(
        '$ #,##0'
      );
  }

  if (fechaCol > 0) {

    sh
      .getRange(
        2,
        fechaCol,
        Math.max(
          sh.getMaxRows() - 1,
          1
        )
      )
      .setNumberFormat(
        'yyyy-mm-dd'
      );
  }

  return sh;
}


/* ============================================================
   HOJA AUDITORÍA
   ============================================================ */

function prepararHojaAuditoria_(ss) {

  let sh =
    ss.getSheetByName(
      ZIMA.SHEET_AUDITORIA
    );

  if (!sh) {
    sh = ss.insertSheet(
      ZIMA.SHEET_AUDITORIA
    );
  }

  if (sh.getLastRow() === 0) {

    sh
      .getRange(
        1,
        1,
        1,
        7
      )
      .setValues([[
        'timestamp',
        'accion',
        'id',
        'codigo',
        'usuario',
        'detalle',
        'email'
      ]]);

    sh.setFrozenRows(1);

    sh
      .getRange(
        1,
        1,
        1,
        7
      )
      .setFontWeight('bold');
  }

  return sh;
}


/* ============================================================
   HOJA CONFIG
   ============================================================ */

function prepararHojaConfig_(ss) {

  let sh =
    ss.getSheetByName(
      ZIMA.SHEET_CONFIG
    );

  if (!sh) {
    sh = ss.insertSheet(
      ZIMA.SHEET_CONFIG
    );
  }

  return sh;
}


/* ============================================================
   HOJA USUARIOS
   ============================================================ */

function prepararHojaUsuarios_(ss) {

  let sh =
    ss.getSheetByName(
      ZIMA.SHEET_USUARIOS
    );

  if (!sh) {
    sh = ss.insertSheet(
      ZIMA.SHEET_USUARIOS
    );
  }

  if (sh.getLastRow() === 0) {

    sh
      .getRange(
        1,
        1,
        1,
        ZIMA.USUARIOS_HEADERS.length
      )
      .setValues([
        ZIMA.USUARIOS_HEADERS
      ]);

    sh
      .getRange(
        1,
        1,
        1,
        ZIMA.USUARIOS_HEADERS.length
      )
      .setFontWeight('bold');

    sh.setFrozenRows(1);
  }

  const currentHeaders =
    sh
      .getRange(
        1,
        1,
        1,
        Math.max(
          sh.getLastColumn(),
          1
        )
      )
      .getValues()[0]
      .map(function(header) {
        return String(header || '').trim();
      });

  ZIMA.USUARIOS_HEADERS.forEach(function(header) {
    if (currentHeaders.indexOf(header) === -1) {
      sh
        .getRange(
          1,
          sh.getLastColumn() + 1
        )
        .setValue(header)
        .setFontWeight('bold');
      currentHeaders.push(header);
    }
  });

  return sh;
}


function leerConfigMap_(
  sh
) {

  const map = {};

  if (
    !sh ||
    sh.getLastRow() < 2
  ) {
    return map;
  }

  const values =
    sh
      .getRange(
        1,
        1,
        sh.getLastRow(),
        Math.max(
          sh.getLastColumn(),
          2
        )
      )
      .getValues();

  values.slice(1).forEach(
    function(row) {

      const key =
        String(
          row[0] ||
          ''
        )
          .trim()
          .toUpperCase();

      if (key) {
        map[key] =
          row[1];
      }
    }
  );

  return map;
}


function obtenerValorConfig_(
  parametro
) {

  try {

    const ss =
      getSpreadsheet_();

    const sh =
      ss.getSheetByName(
        ZIMA.SHEET_CONFIG
      );

    const config =
      leerConfigMap_(
        sh
      );

    return String(
      config[
        String(
          parametro ||
          ''
        )
          .trim()
          .toUpperCase()
      ] ||
      ''
    ).trim();

  } catch (e) {

    return '';
  }
}


/* ============================================================
   USUARIOS INICIALES
   ============================================================ */

function crearUsuariosIniciales_(ss) {

  const sh =
    prepararHojaUsuarios_(ss);

  const usuarios =
    obtenerUsuariosDesdeHoja_(sh);

  const iniciales = [

    [
      Utilities.getUuid(),
      'admin',
      hashContrasena_('Admin360'),
      'Administrador General',
      'ADMIN',
      'TODOS',
      'ACTIVO',
      new Date(),
      '',
      '',
      '',
      'Gran Administrador',
      ''
    ],

    [
      Utilities.getUuid(),
      'interventoria',
      hashContrasena_('Inter360'),
      'Interventoría',
      'INTERVENTORIA',
      'TODOS',
      'ACTIVO',
      new Date(),
      '',
      '',
      '',
      'Interventoría',
      ''
    ]

  ];

  iniciales.forEach(function(usuario) {

    const existe =
      usuarios.some(function(u) {

        return String(
          u.USUARIO || ''
        )
          .trim()
          .toLowerCase() ===
          String(
            usuario[1] || ''
          )
            .trim()
            .toLowerCase();

      });

    if (!existe) {
      sh.appendRow(usuario);
    }

  });
}


/* ============================================================
   OBTENER USUARIOS
   ============================================================ */

function obtenerUsuariosDesdeHoja_(sh) {

  if (
    !sh ||
    sh.getLastRow() < 2
  ) {
    return [];
  }

  const cantidadColumnas =
    ZIMA.USUARIOS_HEADERS.length;

  const datos =
    sh
      .getRange(
        1,
        1,
        sh.getLastRow(),
        cantidadColumnas
      )
      .getValues();

  const encabezados =
    datos.shift();

  return datos
    .filter(function(fila) {

      return String(
        fila[1] || ''
      ).trim() !== '';

    })
    .map(function(fila) {

      const obj = {};

      encabezados.forEach(
        function(campo, indice) {

          obj[campo] =
            fila[indice];

        }
      );

      return obj;
    });
}


/* ============================================================
   AUTENTICACIÓN
   ============================================================ */

function autenticarUsuario(
  usuario,
  password
) {

  try {

    const ss =
      getSpreadsheet_();

    const sh =
      prepararHojaUsuarios_(ss);

    crearUsuariosIniciales_(ss);

    usuario =
      String(
        usuario || ''
      ).trim();

    password =
      String(
        password || ''
      ).trim();

    if (
      !usuario ||
      !password
    ) {

      return {
        ok: false,
        mensaje:
          'Ingrese usuario y contraseña.'
      };
    }

    const lastRow =
      sh.getLastRow();

    if (lastRow < 2) {

      return {
        ok: false,
        mensaje:
          'No hay usuarios registrados en la hoja USUARIOS.'
      };
    }

    const datos =
      sh
        .getRange(
          2,
          1,
          lastRow - 1,
          ZIMA.USUARIOS_HEADERS.length
        )
        .getValues();

    for (
      let i = 0;
      i < datos.length;
      i++
    ) {

      const fila =
        datos[i];

      const usuarioBD =
        String(
          fila[1] || ''
        ).trim();

      const passwordBD =
        String(
          fila[2] || ''
        ).trim();

      const nombre =
        String(
          fila[3] || ''
        ).trim();

      const rol =
        String(
          fila[4] || ''
        )
          .trim()
          .toUpperCase();

      const peaje =
        String(
          fila[5] || ''
        ).trim();

      const estado =
        String(
          fila[6] || ''
        )
          .trim()
          .toUpperCase();

      const email =
        String(
          fila[9] || ''
        ).trim();

      const telefono =
        String(
          fila[10] || ''
        ).trim();

      const cargo =
        String(
          fila[11] || ''
        ).trim();

      const foto =
        obtenerFotoUsuarioPersistente_(
          usuarioBD,
          String(
            fila[12] || ''
          ).trim()
        );

      const usuarioCoincide =
        usuarioBD.toLowerCase() ===
        usuario.toLowerCase();

      const passwordCoincide =
        verificarContrasena_(
          password,
          passwordBD
        );

      if (
        usuarioCoincide &&
        passwordCoincide
      ) {

        // Si el usuario venía de una versión anterior
        // con contraseña en texto plano, la migramos
        // automáticamente al primer inicio de sesión.
        if (
          passwordCoincide &&
          !esHashContrasena_(passwordBD)
        ) {
          sh
            .getRange(i + 2, 3)
            .setValue(
              hashContrasena_(password)
            );
        }

        if (
          estado !==
          'ACTIVO'
        ) {

          return {
            ok: false,
            mensaje:
              'El usuario "' +
              usuarioBD +
              '" se encuentra INACTIVO.'
          };
        }

        sh
          .getRange(
            i + 2,
            9
          )
          .setValue(
            new Date()
          );

        const usuarioSesion = {
          usuario:
            usuarioBD,

          nombre:
            nombre ||
            usuarioBD,

          rol:
            rol ||
            'PEAJE',

          peaje:
            peaje ||
            'TODOS',

          estado:
            estado,

          email:
            email,

          telefono:
            telefono,

          cargo:
            cargo,

          foto:
            foto,

          loginAt:
            new Date().toISOString()
        };

        const token =
          crearSesion_(
            usuarioSesion
          );

        notificarIngresoPlataforma_(
          usuarioSesion
        );

        return {

          ok: true,

          token:
            token,

          sessionToken:
            token,

          sesion:
            token,

          usuario:
            usuarioBD,

          nombre:
            nombre ||
            usuarioBD,

          rol:
            rol ||
            'PEAJE',

          peaje:
            peaje ||
            'TODOS',

          estado:
            estado,

          email:
            email,

          telefono:
            telefono,

          cargo:
            cargo,

          foto:
            foto,

          usuarioData: {
            usuario:
              usuarioBD,

            nombre:
              nombre ||
              usuarioBD,

            rol:
              rol ||
              'PEAJE',

            peaje:
              peaje ||
              'TODOS',

            estado:
              estado,

            email:
              email,

            telefono:
              telefono,

            cargo:
              cargo,

            foto:
              foto
          },

          mensaje:
            'Inicio de sesión correcto.'
        };
      }
    }

    return {
      ok: false,
      mensaje:
        'Usuario o contraseña incorrectos.'
    };

  } catch (error) {

    console.error(error);

    return {
      ok: false,
      mensaje:
        'No fue posible validar el usuario: ' +
        errorMessage_(error)
    };
  }
}


/* ============================================================
   SESIONES
   ============================================================ */

function crearSesion_(usuarioSesion) {

  const token =
    Utilities.getUuid() +
    '-' +
    Utilities.getUuid();

  const cache =
    CacheService.getScriptCache();

  cache.put(
    ZIMA.SESSION_PREFIX + token,
    JSON.stringify(
      usuarioSesion
    ),
    ZIMA.SESSION_SECONDS
  );

  return token;
}


function obtenerSesion_(token) {

  token =
    String(
      token || ''
    ).trim();

  if (!token) {
    return null;
  }

  const cache =
    CacheService.getScriptCache();

  const raw =
    cache.get(
      ZIMA.SESSION_PREFIX + token
    );

  if (!raw) {
    return null;
  }

  try {

    return JSON.parse(raw);

  } catch (e) {

    return null;
  }
}


function cerrarSesion_(token) {

  token =
    String(
      token || ''
    ).trim();

  if (!token) {
    return {
      ok: true
    };
  }

  CacheService
    .getScriptCache()
    .remove(
      ZIMA.SESSION_PREFIX + token
    );

  return {
    ok: true,
    mensaje:
      'Sesión cerrada correctamente.'
  };
}


/* ============================================================
   CONTEXTO DEL USUARIO
   ============================================================ */

function obtenerContextoUsuario_(data) {

  data = data || {};

  const token =
    String(
      data.token ||
      data.sessionToken ||
      data.sesion ||
      ''
    ).trim();

  if (!token) {
    return {
      ok: false,
      error:
        'Sesión requerida. Inicie sesión nuevamente.'
    };
  }

  const sesion =
    obtenerSesion_(token);

  if (!sesion) {
    return {
      ok: false,
      error:
        'La sesión ha expirado o no es válida. Inicie sesión nuevamente.'
    };
  }

  return {
    ok: true,
    sesion: sesion
  };
}

/* ============================================================
   BUSCAR USUARIO
   ============================================================ */

function buscarUsuario_(usuario) {

  const ss =
    getSpreadsheet_();

  const sh =
    prepararHojaUsuarios_(ss);

  const usuarios =
    obtenerUsuariosDesdeHoja_(sh);

  usuario =
    String(
      usuario || ''
    )
      .trim()
      .toLowerCase();

  for (
    let i = 0;
    i < usuarios.length;
    i++
  ) {

    const u =
      usuarios[i];

    if (
      String(
        u.USUARIO || ''
      )
        .trim()
        .toLowerCase() ===
      usuario
    ) {

      return u;
    }
  }

  return null;
}


/* ============================================================
   CREAR USUARIO
   ============================================================ */

function crearUsuario(datos) {

  const ss =
    getSpreadsheet_();

  const sh =
    prepararHojaUsuarios_(ss);

  const usuario =
    String(
      datos &&
      datos.usuario ||
      ''
    ).trim();

  const password =
    String(
      datos &&
      (
        datos.password ||
        datos.contrasena
      ) ||
      ''
    );

  const nombre =
    String(
      datos &&
      datos.nombre ||
      ''
    ).trim();

  const rol =
    String(
      datos &&
      datos.rol ||
      'PEAJE'
    )
      .trim()
      .toUpperCase();

  const peaje =
    String(
      datos &&
      datos.peaje ||
      ''
    ).trim();

  if (!usuario) {
    throw new Error(
      'El usuario es obligatorio.'
    );
  }

  if (!password) {
    throw new Error(
      'La contraseña es obligatoria.'
    );
  }

  if (!nombre) {
    throw new Error(
      'El nombre es obligatorio.'
    );
  }

  if (
    rol !== 'ADMIN' &&
    rol !== 'ADMINISTRADOR' &&
    rol !== 'INTERVENTORIA' &&
    rol !== 'PEAJE'
  ) {
    throw new Error(
      'Rol no válido.'
    );
  }

  if (
    rol === 'PEAJE' &&
    !peaje
  ) {
    throw new Error(
      'Debe indicar el peaje del usuario.'
    );
  }

  crearUsuariosIniciales_(ss);

  const usuarios =
    obtenerUsuariosDesdeHoja_(sh);

  const existe =
    usuarios.some(function(u) {

      return String(
        u.USUARIO || ''
      )
        .trim()
        .toLowerCase() ===
      usuario.toLowerCase();

    });

  if (existe) {

    throw new Error(
      'Ese usuario ya existe.'
    );
  }

  const fotoUsuario =
    String(datos.foto || '').trim();

  guardarFotoUsuarioPersistente_(
    usuario,
    fotoUsuario
  );

  sh.appendRow([

    Utilities.getUuid(),

    usuario,

    hashContrasena_(password),

    nombre,

    rol,

    peaje ||
      'TODOS',

    'ACTIVO',

    new Date(),

    '',

    String(datos.email || '').trim(),

    String(datos.telefono || '').trim(),

    String(datos.cargo || '').trim(),

    fotoUsuario

  ]);

  return {
    ok: true,
    mensaje:
      'Usuario creado correctamente.',
    usuario:
      usuario,
    nombre:
      nombre,
    rol:
      rol,
    peaje:
      peaje ||
      'TODOS',
    email:
      String(datos.email || '').trim(),
    telefono:
      String(datos.telefono || '').trim(),
    cargo:
      String(datos.cargo || '').trim(),
    foto:
      fotoUsuario
  };
}


function actualizarUsuario(datos) {

  const ss =
    getSpreadsheet_();

  const sh =
    prepararHojaUsuarios_(ss);

  datos =
    datos || {};

  const usuario =
    String(
      datos.usuario ||
      ''
    ).trim();

  if (!usuario) {
    throw new Error(
      'El usuario es obligatorio.'
    );
  }

  const nombre =
    String(
      datos.nombre ||
      ''
    ).trim();

  const rol =
    String(
      datos.rol ||
      ''
    )
      .trim()
      .toUpperCase();

  const peaje =
    String(
      datos.peaje ||
      ''
    ).trim();

  const estado =
    String(
      datos.estado ||
      'ACTIVO'
    )
      .trim()
      .toUpperCase();

  if (!nombre) {
    throw new Error(
      'El nombre es obligatorio.'
    );
  }

  if (
    rol !== 'ADMIN' &&
    rol !== 'ADMINISTRADOR' &&
    rol !== 'INTERVENTORIA' &&
    rol !== 'PEAJE'
  ) {
    throw new Error(
      'Rol no válido.'
    );
  }

  if (
    estado !== 'ACTIVO' &&
    estado !== 'INACTIVO'
  ) {
    throw new Error(
      'Estado no válido.'
    );
  }

  if (
    rol === 'PEAJE' &&
    !peaje
  ) {
    throw new Error(
      'Debe indicar el peaje del usuario.'
    );
  }

  const headers =
    sh
      .getRange(
        1,
        1,
        1,
        sh.getLastColumn()
      )
      .getValues()[0]
      .map(function(header) {
        return String(header || '').trim();
      });

  const col = function(name) {
    const index =
      headers.indexOf(name);

    if (index === -1) {
      throw new Error(
        'Columna de usuario no configurada: ' +
        name
      );
    }

    return index + 1;
  };

  const datosHoja =
    sh.getDataRange()
      .getValues();

  for (let i = 1; i < datosHoja.length; i++) {
    if (
      String(datosHoja[i][col('USUARIO') - 1] || '').trim().toLowerCase() ===
      usuario.toLowerCase()
    ) {
      const row =
        i + 1;

      sh.getRange(row, col('NOMBRE')).setValue(nombre);
      sh.getRange(row, col('ROL')).setValue(rol);
      sh.getRange(row, col('PEAJE')).setValue(peaje || 'TODOS');
      sh.getRange(row, col('ESTADO')).setValue(estado);
      sh.getRange(row, col('EMAIL')).setValue(String(datos.email || '').trim());
      sh.getRange(row, col('TELEFONO')).setValue(String(datos.telefono || '').trim());
      sh.getRange(row, col('CARGO')).setValue(String(datos.cargo || '').trim());
      const fotoUsuario =
        String(datos.foto || '').trim();

      sh.getRange(row, col('FOTO')).setValue(fotoUsuario);

      guardarFotoUsuarioPersistente_(
        usuario,
        fotoUsuario
      );

      const nuevaContrasena =
        String(
          datos.nuevaContrasena ||
          datos.password ||
          ''
        );

      if (nuevaContrasena) {
        if (nuevaContrasena.length < 6) {
          throw new Error(
            'La contraseña debe tener al menos 6 caracteres.'
          );
        }

        sh.getRange(row, col('CONTRASENA'))
          .setValue(
            hashContrasena_(nuevaContrasena)
          );
      }

      const perfilActualizado = {
        ok: true,
        mensaje:
          'Perfil actualizado correctamente.',
        usuario:
          usuario,
        nombre:
          nombre,
        rol:
          rol,
        peaje:
          peaje ||
          'TODOS',
        estado:
          estado,
        email:
          String(datos.email || '').trim(),
        telefono:
          String(datos.telefono || '').trim(),
        cargo:
          String(datos.cargo || '').trim(),
        foto:
          fotoUsuario
      };

      actualizarSesionCacheSiCorresponde_(
        datos,
        perfilActualizado
      );

      return perfilActualizado;
    }
  }

  throw new Error(
    'Usuario no encontrado.'
  );
}


function actualizarPerfilPropio_(datos) {

  datos =
    datos || {};

  const contexto =
    obtenerContextoUsuario_(
      datos
    );

  if (!contexto.ok) {
    return contexto;
  }

  const sesion =
    contexto.sesion;

  const ss =
    getSpreadsheet_();

  const sh =
    prepararHojaUsuarios_(ss);

  const headers =
    sh
      .getRange(
        1,
        1,
        1,
        sh.getLastColumn()
      )
      .getValues()[0]
      .map(function(header) {
        return String(header || '').trim();
      });

  const col = function(name) {
    const index =
      headers.indexOf(name);

    if (index === -1) {
      throw new Error(
        'Columna de usuario no configurada: ' +
        name
      );
    }

    return index + 1;
  };

  const datosHoja =
    sh.getDataRange()
      .getValues();

  const usuarioSesion =
    String(
      sesion.usuario ||
      ''
    )
      .trim()
      .toLowerCase();

  for (let i = 1; i < datosHoja.length; i++) {

    if (
      String(
        datosHoja[i][col('USUARIO') - 1] ||
        ''
      )
        .trim()
        .toLowerCase() !==
      usuarioSesion
    ) {
      continue;
    }

    const row =
      i + 1;

    const nombre =
      String(
        datos.nombre ||
        datosHoja[i][col('NOMBRE') - 1] ||
        sesion.nombre ||
        sesion.usuario ||
        ''
      ).trim();

    if (!nombre) {
      throw new Error(
        'El nombre es obligatorio.'
      );
    }

    const email =
      String(
        datos.email ||
        ''
      ).trim();

    const telefono =
      String(
        datos.telefono ||
        ''
      ).trim();

    const cargo =
      String(
        datos.cargo ||
        ''
      ).trim();

    const fotoUsuario =
      String(
        datos.foto ||
        ''
      ).trim();

    sh.getRange(row, col('NOMBRE')).setValue(nombre);
    sh.getRange(row, col('EMAIL')).setValue(email);
    sh.getRange(row, col('TELEFONO')).setValue(telefono);
    sh.getRange(row, col('CARGO')).setValue(cargo);
    sh.getRange(row, col('FOTO')).setValue(fotoUsuario);

    guardarFotoUsuarioPersistente_(
      sesion.usuario,
      fotoUsuario
    );

    const perfilActualizado = {
      ok: true,
      mensaje:
        'Datos guardados correctamente.',
      usuario:
        sesion.usuario,
      nombre:
        nombre,
      rol:
        datosHoja[i][col('ROL') - 1] ||
        sesion.rol ||
        '',
      peaje:
        datosHoja[i][col('PEAJE') - 1] ||
        sesion.peaje ||
        '',
      estado:
        datosHoja[i][col('ESTADO') - 1] ||
        sesion.estado ||
        '',
      email:
        email,
      telefono:
        telefono,
      cargo:
        cargo,
      foto:
        fotoUsuario
    };

    actualizarSesionCacheSiCorresponde_(
      datos,
      perfilActualizado
    );

    return perfilActualizado;
  }

  throw new Error(
    'Usuario no encontrado.'
  );
}


function fotoKeyUsuario_(
  usuario
) {

  return 'ZIMA_FOTO_' +
    String(usuario || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, '_');
}


function guardarFotoUsuarioPersistente_(
  usuario,
  foto
) {

  const key =
    fotoKeyUsuario_(
      usuario
    );

  foto =
    String(
      foto || ''
    ).trim();

  try {

    const props =
      PropertiesService
        .getScriptProperties();

    if (foto) {
      props.setProperty(
        key,
        foto
      );
    } else {
      props.deleteProperty(
        key
      );
    }

  } catch (e) {}
}


function obtenerFotoUsuarioPersistente_(
  usuario,
  fotoHoja
) {

  fotoHoja =
    String(
      fotoHoja || ''
    ).trim();

  if (fotoHoja) {
    return fotoHoja;
  }

  try {

    return String(
      PropertiesService
        .getScriptProperties()
        .getProperty(
          fotoKeyUsuario_(
            usuario
          )
        ) ||
        ''
    ).trim();

  } catch (e) {

    return '';
  }
}


function actualizarSesionCacheSiCorresponde_(
  datos,
  perfil
) {

  const token =
    String(
      datos.token ||
      datos.sessionToken ||
      datos.sesion ||
      ''
    ).trim();

  if (!token) {
    return;
  }

  const sesionActual =
    obtenerSesion_(
      token
    );

  if (
    !sesionActual ||
    String(sesionActual.usuario || '').trim().toLowerCase() !==
      String(perfil.usuario || '').trim().toLowerCase()
  ) {
    return;
  }

  const sesionNueva =
    Object.assign(
      {},
      sesionActual,
      {
        usuario:
          perfil.usuario,
        nombre:
          perfil.nombre,
        rol:
          perfil.rol,
        peaje:
          perfil.peaje,
        estado:
          perfil.estado,
        email:
          perfil.email || '',
        telefono:
          perfil.telefono || '',
        cargo:
          perfil.cargo || '',
        foto:
          perfil.foto || ''
      }
    );

  CacheService
    .getScriptCache()
    .put(
      ZIMA.SESSION_PREFIX + token,
      JSON.stringify(sesionNueva),
      ZIMA.SESSION_SECONDS
    );
}


function obtenerPerfilUsuario_(params) {

  const contexto =
    obtenerContextoUsuario_(
      params
    );

  if (!contexto.ok) {
    return contexto;
  }

  const sesion =
    contexto.sesion;

  const usuarioHoja =
    buscarUsuario_(
      sesion.usuario
    );

  if (!usuarioHoja) {
    return {
      ok: false,
      error:
        'Usuario no encontrado.'
    };
  }

  return {
    ok: true,
    usuario:
      usuarioHoja.USUARIO ||
      sesion.usuario,
    nombre:
      usuarioHoja.NOMBRE ||
      sesion.nombre ||
      usuarioHoja.USUARIO ||
      '',
    rol:
      usuarioHoja.ROL ||
      sesion.rol ||
      '',
    peaje:
      usuarioHoja.PEAJE ||
      sesion.peaje ||
      '',
    estado:
      usuarioHoja.ESTADO ||
      sesion.estado ||
      '',
    email:
      usuarioHoja.EMAIL ||
      '',
    telefono:
      usuarioHoja.TELEFONO ||
      '',
    cargo:
      usuarioHoja.CARGO ||
      '',
    foto:
      obtenerFotoUsuarioPersistente_(
        usuarioHoja.USUARIO ||
        sesion.usuario,
        usuarioHoja.FOTO ||
        ''
      )
  };
}


function cambiarContrasenaUsuario(
  usuario,
  nuevaContrasena
) {

  usuario =
    String(usuario || '').trim();

  nuevaContrasena =
    String(nuevaContrasena || '');

  if (!usuario || !nuevaContrasena) {
    throw new Error(
      'Usuario y nueva contraseña son obligatorios.'
    );
  }

  if (nuevaContrasena.length < 6) {
    throw new Error(
      'La contraseña debe tener al menos 6 caracteres.'
    );
  }

  const ss = getSpreadsheet_();
  const sh = prepararHojaUsuarios_(ss);
  const datos = sh.getDataRange().getValues();

  for (let i = 1; i < datos.length; i++) {
    if (
      String(datos[i][1] || '').trim().toLowerCase() ===
      usuario.toLowerCase()
    ) {
      sh.getRange(i + 1, 3)
        .setValue(hashContrasena_(nuevaContrasena));

      return {
        ok: true,
        mensaje: 'Contraseña actualizada correctamente.'
      };
    }
  }

  throw new Error('Usuario no encontrado.');
}


/* ============================================================
   LISTAR USUARIOS
   ============================================================ */

function listarUsuarios() {

  const ss =
    getSpreadsheet_();

  const sh =
    prepararHojaUsuarios_(ss);

  crearUsuariosIniciales_(ss);

  return obtenerUsuariosDesdeHoja_(sh)
    .map(function(u) {
      const copia = Object.assign({}, u);
      delete copia.CONTRASENA;
      return copia;
    });
}


/* ============================================================
   LISTAR PEAJES
   ============================================================ */

function listarPeajes_(params) {

  params =
    params || {};

  const contexto =
    obtenerContextoUsuario_(
      params
    );

  if (!contexto.ok) {
    return contexto;
  }

  const sesion =
    contexto.sesion;

  const mapa = {};

  const agregar = function(value) {

    const nombre =
      String(
        value || ''
      ).trim();

    const key =
      normalizarPeaje_(
        nombre
      );

    if (
      !key ||
      key === 'TODOS' ||
      key === 'ADMINISTRACION CENTRAL' ||
      key === 'ADMINISTRACIÓN CENTRAL'
    ) {
      return;
    }

    if (!mapa[key]) {
      mapa[key] =
        nombre;
    }
  };

  let planillas = [];

  try {
    planillas =
      readAllRows_(
        getPlanillasSheet_()
      );
  } catch (e) {
    planillas = [];
  }

  if (
    !esUsuarioGlobal_(
      sesion
    )
  ) {

    const peajeSesion =
      normalizarPeaje_(
        sesion.peaje
      );

    planillas =
      planillas.filter(
        function(row) {
          return normalizarPeaje_(
            row.peaje
          ) === peajeSesion;
        }
      );
  }

  planillas.forEach(
    function(row) {
      agregar(
        row.peaje
      );
    }
  );

  try {

    listarUsuarios()
      .forEach(
        function(usuario) {

          if (
            esUsuarioGlobal_(
              sesion
            ) ||
            normalizarPeaje_(
              usuario.PEAJE
            ) === normalizarPeaje_(
              sesion.peaje
            )
          ) {
            agregar(
              usuario.PEAJE
            );
          }
        }
      );

  } catch (e) {}

  return {
    ok: true,
    peajes:
      Object
        .keys(mapa)
        .sort()
        .map(function(key) {
          return mapa[key];
        })
  };
}


/* ============================================================
   CAMBIAR ESTADO USUARIO
   ============================================================ */

function cambiarEstadoUsuario(
  usuario,
  nuevoEstado
) {

  const ss =
    getSpreadsheet_();

  const sh =
    prepararHojaUsuarios_(ss);

  usuario =
    String(
      usuario || ''
    ).trim();

  nuevoEstado =
    String(
      nuevoEstado || ''
    )
      .trim()
      .toUpperCase();

  if (
    nuevoEstado !== 'ACTIVO' &&
    nuevoEstado !== 'INACTIVO'
  ) {

    throw new Error(
      'Estado no válido.'
    );
  }

  const datos =
    sh.getDataRange()
      .getValues();

  for (
    let i = 1;
    i < datos.length;
    i++
  ) {

    if (
      String(
        datos[i][1] || ''
      )
        .trim()
        .toLowerCase() ===
      usuario.toLowerCase()
    ) {

      sh
        .getRange(
          i + 1,
          7
        )
        .setValue(
          nuevoEstado
        );

      return {
        ok: true,
        mensaje:
          'Estado actualizado.'
      };
    }
  }

  throw new Error(
    'Usuario no encontrado.'
  );
}


/* ============================================================
   WEB APP GET
   ============================================================ */

function doGet(e) {

  try {

    const params =
      (e && e.parameter) ||
      {};

    const action =
      String(
        params.action ||
        'config'
      )
        .trim()
        .toLowerCase();

    const callback =
      params.callback ||
      '';

    if (
      action === 'login'
    ) {

      return jsonOutput_(
        autenticarUsuario(
          params.usuario ||
          '',
          params.password ||
          ''
        ),
        callback
      );
    }

    if (
      action === 'logout'
    ) {

      return jsonOutput_(
        cerrarSesion_(
          params.token ||
          params.sessionToken ||
          params.sesion ||
          ''
        ),
        callback
      );
    }

    if (
      action === 'soporte' ||
      action === 'reportarsoporte'
    ) {

      return jsonOutput_(
        registrarSoporte_(
          params
        ),
        callback
      );
    }

    if (
      action === 'save' ||
      action === 'create' ||
      action === 'update' ||
      action === 'delete'
    ) {

      return jsonOutput_(
        apiPost(
          params
        ),
        callback
      );
    }

    if (
      action === 'usuarios'
    ) {

      const contexto =
        obtenerContextoUsuario_(
          params
        );

      if (!contexto.ok) {
        return jsonOutput_(
          contexto,
          callback
        );
      }

      if (
        !esUsuarioAdministrador_(
          contexto.sesion
        )
      ) {
        return jsonOutput_({
          ok: false,
          error:
            'Solo un administrador puede consultar los usuarios.'
        }, callback);
      }

      return jsonOutput_({
        ok: true,
        usuarios:
          listarUsuarios()
      }, callback);
    }

    if (
      action === 'crearusuario' ||
      action === 'actualizarusuario' ||
      action === 'cambiarcontrasenausuario' ||
      action === 'cambiarestadousuario'
    ) {

      const contexto =
        obtenerContextoUsuario_(
          params
        );

      if (!contexto.ok) {
        return jsonOutput_(
          contexto,
          callback
        );
      }

      if (
        !esUsuarioAdministrador_(
          contexto.sesion
        )
      ) {
        return jsonOutput_({
          ok: false,
          error:
            'Solo un administrador puede modificar usuarios.'
        }, callback);
      }

      if (action === 'crearusuario') {
        return jsonOutput_(
          crearUsuario(
            params
          ),
          callback
        );
      }

      if (action === 'actualizarusuario') {
        return jsonOutput_(
          actualizarUsuario(
            params
          ),
          callback
        );
      }

      if (action === 'cambiarcontrasenausuario') {
        return jsonOutput_(
          cambiarContrasenaUsuario(
            params.usuario,
            params.nuevaContrasena ||
            params.password
          ),
          callback
        );
      }

      return jsonOutput_(
        cambiarEstadoUsuario(
          params.usuario,
          params.estado
        ),
        callback
      );
    }

    if (
      action === 'sesion'
    ) {

      const contexto =
        obtenerContextoUsuario_(
          params
        );

      if (!contexto.ok) {
        return jsonOutput_(
          contexto,
          callback
        );
      }

      return jsonOutput_({
        ok: true,
        usuario:
          contexto.sesion.usuario,
        nombre:
          contexto.sesion.nombre,
        rol:
          contexto.sesion.rol,
        peaje:
          contexto.sesion.peaje,
        estado:
          contexto.sesion.estado,
        email:
          contexto.sesion.email || '',
        telefono:
          contexto.sesion.telefono || '',
        cargo:
          contexto.sesion.cargo || '',
        foto:
          contexto.sesion.foto || ''
      }, callback);
    }

    if (
      action === 'perfil'
    ) {

      return jsonOutput_(
        obtenerPerfilUsuario_(
          params
        ),
        callback
      );
    }

    if (
      action === 'actualizarperfil'
    ) {

      return jsonOutput_(
        actualizarPerfilPropio_(
          params
        ),
        callback
      );
    }

    return jsonOutput_(
      apiGet({
        action:
          action,

        id:
          params.id ||
          '',

        q:
          params.q ||
          '',

        estado:
          params.estado ||
          '',

        fecha:
          params.fecha ||
          '',

        usuario:
          params.usuario ||
          '',

        token:
          params.token ||
          '',

        sessionToken:
          params.sessionToken ||
          '',

        sesion:
          params.sesion ||
          ''
      }),
      callback
    );

  } catch (error) {

    return jsonOutput_({
      ok: false,
      error:
        errorMessage_(error)
    }, (e && e.parameter && e.parameter.callback) || '');
  }
}


/* ============================================================
   WEB APP POST
   ============================================================ */

function doPost(e) {

  try {

    const payload =
      parsePost_(e);

    const action =
      String(
        payload.action ||
        'save'
      )
        .trim()
        .toLowerCase();

    if (
      action === 'login'
    ) {

      return jsonOutput_(
        autenticarUsuario(
          payload.usuario ||
          '',
          payload.password ||
          ''
        )
      );
    }

    if (
      action === 'logout'
    ) {

      return jsonOutput_(
        cerrarSesion_(
          payload.token ||
          payload.sessionToken ||
          payload.sesion ||
          ''
        )
      );
    }

    if (
      action === 'soporte' ||
      action === 'reportarsoporte'
    ) {

      return jsonOutput_(
        registrarSoporte_(
          payload
        )
      );
    }

    if (
      action ===
      'actualizarperfil'
    ) {

      return jsonOutput_(
        actualizarPerfilPropio_(
          payload
        )
      );
    }

    if (
      action ===
      'crearusuario'
    ) {

      const contexto =
        obtenerContextoUsuario_(
          payload
        );

      if (!contexto.ok) {
        return jsonOutput_(contexto);
      }

      if (
        !esUsuarioAdministrador_(
          contexto.sesion
        )
      ) {
        return jsonOutput_({
          ok: false,
          error:
            'Solo un administrador puede crear usuarios.'
        });
      }

      return jsonOutput_(
        crearUsuario(
          payload
        )
      );
    }

    if (
      action ===
      'actualizarusuario'
    ) {

      const contexto =
        obtenerContextoUsuario_(
          payload
        );

      if (!contexto.ok) {
        return jsonOutput_(contexto);
      }

      if (
        !esUsuarioAdministrador_(
          contexto.sesion
        )
      ) {
        return jsonOutput_({
          ok: false,
          error:
            'Solo un administrador puede actualizar usuarios.'
        });
      }

      return jsonOutput_(
        actualizarUsuario(
          payload
        )
      );
    }

    if (
      action ===
      'cambiarcontrasenausuario'
    ) {

      const contexto =
        obtenerContextoUsuario_(
          payload
        );

      if (!contexto.ok) {
        return jsonOutput_(contexto);
      }

      if (
        !esUsuarioAdministrador_(
          contexto.sesion
        )
      ) {
        return jsonOutput_({
          ok: false,
          error:
            'Solo un administrador puede cambiar contraseñas.'
        });
      }

      return jsonOutput_(
        cambiarContrasenaUsuario(
          payload.usuario,
          payload.nuevaContrasena ||
          payload.password
        )
      );
    }

    if (
      action ===
      'cambiarestadousuario'
    ) {

      const contexto =
        obtenerContextoUsuario_(
          payload
        );

      if (!contexto.ok) {
        return jsonOutput_(contexto);
      }

      if (
        !esUsuarioAdministrador_(
          contexto.sesion
        )
      ) {
        return jsonOutput_({
          ok: false,
          error:
            'Solo un administrador puede cambiar estados de usuarios.'
        });
      }

      return jsonOutput_(
        cambiarEstadoUsuario(
          payload.usuario,
          payload.estado
        )
      );
    }

    return jsonOutput_(
      apiPost(
        payload
      )
    );

  } catch (error) {

    return jsonOutput_({
      ok: false,
      error:
        errorMessage_(error)
    });
  }
}


/* ============================================================
   API GET
   ============================================================ */

function apiGet(params) {

  params =
    params || {};

  const action =
    String(
      params.action ||
      'config'
    )
      .trim()
      .toLowerCase();

  switch (action) {

    case 'list':

      return listarPlanillas_(
        params
      );

    case 'get':

      return obtenerPlanilla_(
        params
      );

    case 'dashboard':

      return obtenerDashboard_(
        params
      );

    case 'peajes':

      return listarPeajes_(
        params
      );

    case 'config':

      return obtenerConfiguracion();

    case 'sesion':

      return obtenerSesionRespuesta_(
        params
      );

    case 'perfil':

      return obtenerPerfilUsuario_(
        params
      );

    default:

      return {
        ok: false,
        error:
          'Acción GET no soportada: ' +
          action
      };
  }
}


/* ============================================================
   RESPUESTA DE SESIÓN
   ============================================================ */

function obtenerSesionRespuesta_(params) {

  const contexto =
    obtenerContextoUsuario_(
      params
    );

  if (!contexto.ok) {
    return contexto;
  }

  return {
    ok: true,

    usuario:
      contexto.sesion.usuario,

    nombre:
      contexto.sesion.nombre,

    rol:
      contexto.sesion.rol,

    peaje:
      contexto.sesion.peaje,

    estado:
      contexto.sesion.estado,

    email:
      contexto.sesion.email || '',

    telefono:
      contexto.sesion.telefono || '',

    cargo:
      contexto.sesion.cargo || '',

    foto:
      contexto.sesion.foto || ''
  };
}


/* ============================================================
   API POST
   ============================================================ */

function apiPost(data) {

  data =
    data || {};

  const action =
    String(
      data.action ||
      'save'
    )
      .trim()
      .toLowerCase();

  switch (action) {

    case 'save':
    case 'create':

      return guardarPlanilla_(
        data
      );

    case 'update':

      return actualizarPlanilla_(
        data
      );

    case 'delete':

      return eliminarPlanilla_(
        data
      );

    case 'soporte':
    case 'reportarsoporte':

      return registrarSoporte_(
        data
      );

    case 'actualizarperfil':

      return actualizarPerfilPropio_(
        data
      );

    default:

      return {
        ok: false,
        error:
          'Acción POST no soportada: ' +
          action
      };
  }
}


/* ============================================================
   PLANILLAS · CREAR
   ============================================================ */

function guardarPlanilla_(data) {

  const lock =
    LockService
      .getScriptLock();

  lock.waitLock(15000);

  try {

    const contexto =
      obtenerContextoUsuario_(
        data
      );

    if (!contexto.ok) {
      return contexto;
    }

    const sesion =
      contexto.sesion;

    const sh =
      getPlanillasSheet_();

    const clean =
      normalizarDatos_(
        data
      );

    /*
     * MUY IMPORTANTE:
     * el peaje NO lo decide el frontend.
     *
     * Lo decide el usuario autenticado.
     */

    const peajeUsuario =
      normalizarPeaje_(
        sesion.peaje
      );

    if (
      !esUsuarioGlobal_(sesion)
    ) {

      if (!peajeUsuario) {

        return {
          ok: false,
          error:
            'El usuario no tiene un peaje configurado en USUARIOS.'
        };
      }

      clean.peaje =
        sesion.peaje;
    }

    if (
      esUsuarioGlobal_(sesion) &&
      !clean.peaje
    ) {

      return {
        ok: false,
        error:
          'Debe indicar el peaje de la planilla.'
      };
    }

    const validacion =
      validarPlanilla_(
        clean
      );

    if (!validacion.ok) {
      return validacion;
    }

    const now =
      new Date();

    const id =
      Utilities.getUuid();

    clean.id =
      id;

    clean.codigo =
      clean.codigo ||
      generarCodigo_(
        clean.fecha,
        sh
      );

    clean.estado =
      clean.estado ||
      'BORRADOR';

    clean.createdAt =
      now;

    clean.updatedAt =
      now;

    /*
     * El usuario de la planilla
     * siempre será el usuario autenticado.
     */

    clean.usuario =
      sesion.usuario;

    const row =
      objectToRow_(
        clean
      );

    sh.appendRow(
      row
    );

    registrarAuditoria_(
      'CREATE',
      clean,
      'Planilla creada por ' +
      sesion.usuario +
      ' · Peaje: ' +
      clean.peaje
    );

    const notificacion =
      notificarCambioPlanilla_(
        'CREACION',
        clean,
        sesion,
        'Planilla creada por ' +
        sesion.usuario
      );

    return {

      ok: true,

      message:
        'Planilla guardada correctamente.',

      row:
        serializarRegistro_(
          clean
        ),

      usuario:
        sesion.usuario,

      nombre:
        sesion.nombre,

      rol:
        sesion.rol,

      peaje:
        sesion.peaje,

      notificacion:
        notificacion
    };

  } finally {

    lock.releaseLock();
  }
}


/* ============================================================
   PLANILLAS · ACTUALIZAR
   ============================================================ */

function actualizarPlanilla_(data) {

  const lock =
    LockService
      .getScriptLock();

  lock.waitLock(15000);

  try {

    const contexto =
      obtenerContextoUsuario_(
        data
      );

    if (!contexto.ok) {
      return contexto;
    }

    const sesion =
      contexto.sesion;

    const id =
      String(
        data.id ||
        ''
      ).trim();

    if (!id) {

      return {
        ok: false,
        error:
          'Falta el ID de la planilla.'
      };
    }

    const sh =
      getPlanillasSheet_();

    const found =
      findRowById_(
        sh,
        id
      );

    if (!found) {

      return {
        ok: false,
        error:
          'No se encontró la planilla con ID: ' +
          id
      };
    }

    const current =
      rowToObject_(
        sh,
        found.rowNumber
      );

    /*
     * Verificar que el usuario tenga
     * permiso sobre esa planilla.
     */

    if (
      !puedeAccederPlanilla_(
        sesion,
        current
      )
    ) {

      return {
        ok: false,
        error:
          'No tiene permiso para modificar esta planilla.'
      };
    }

    const incoming =
      normalizarDatos_(
        data
      );

    /*
     * Un usuario de peaje NO puede
     * cambiar la planilla a otro peaje.
     */

    if (
      !esUsuarioGlobal_(sesion)
    ) {

      incoming.peaje =
        current.peaje;
    }

    const merged =
      Object.assign(
        {},
        current,
        incoming,
        {
          id: id,

          codigo:
            incoming.codigo ||
            current.codigo ||
            generarCodigo_(
              incoming.fecha ||
              current.fecha,
              sh
            ),

          estado:
            incoming.estado ||
            current.estado ||
            'BORRADOR',

          createdAt:
            current.createdAt ||
            new Date(),

          updatedAt:
            new Date(),

          usuario:
            sesion.usuario
        }
      );

    const validacion =
      validarPlanilla_(
        merged
      );

    if (!validacion.ok) {
      return validacion;
    }

    sh
      .getRange(
        found.rowNumber,
        1,
        1,
        ZIMA.HEADERS.length
      )
      .setValues([
        objectToRow_(
          merged
        )
      ]);

    registrarAuditoria_(
      'UPDATE',
      merged,
      'Planilla actualizada por ' +
      sesion.usuario
    );

    const notificacion =
      notificarCambioPlanilla_(
      'ACTUALIZACION',
      merged,
      sesion,
      'Planilla actualizada por ' +
      sesion.usuario
      );

    return {

      ok: true,

      message:
        'Planilla actualizada correctamente.',

      row:
        serializarRegistro_(
          merged
        ),

      usuario:
        sesion.usuario,

      peaje:
        sesion.peaje,

      notificacion:
        notificacion
    };

  } finally {

    lock.releaseLock();
  }
}


/* ============================================================
   PLANILLAS · ELIMINAR / ANULAR
   ============================================================ */

function eliminarPlanilla_(data) {

  const lock =
    LockService
      .getScriptLock();

  lock.waitLock(15000);

  try {

    data =
      data || {};

    const contexto =
      obtenerContextoUsuario_(
        data
      );

    if (!contexto.ok) {
      return contexto;
    }

    const sesion =
      contexto.sesion;

    const id =
      String(
        data.id ||
        ''
      ).trim();

    if (!id) {

      return {
        ok: false,
        error:
          'Falta el ID de la planilla.'
      };
    }

    const sh =
      getPlanillasSheet_();

    const found =
      findRowById_(
        sh,
        id
      );

    if (!found) {

      return {
        ok: false,
        error:
          'Planilla no encontrada.'
      };
    }

    const current =
      rowToObject_(
        sh,
        found.rowNumber
      );

    if (
      !puedeAccederPlanilla_(
        sesion,
        current
      )
    ) {

      return {
        ok: false,
        error:
          'No tiene permiso para anular esta planilla.'
      };
    }

    const fechaAnulacion =
      new Date();

    sh
      .getRange(
        found.rowNumber,
        headerIndex_(
          'estado'
        )
      )
      .setValue(
        'ANULADA'
      );

    sh
      .getRange(
        found.rowNumber,
        headerIndex_(
          'updatedAt'
        )
      )
      .setValue(
        fechaAnulacion
      );

    const anulada =
      Object.assign(
        {},
        current,
        {
          estado:
            'ANULADA',

          updatedAt:
            fechaAnulacion,

          usuario:
            sesion.usuario
        }
      );

    registrarAuditoria_(
      'DELETE',
      anulada,
      'Planilla anulada por ' +
      sesion.usuario
    );

    const notificacion =
      notificarCambioPlanilla_(
      'ANULACION',
      anulada,
      sesion,
      'Planilla anulada por ' +
      sesion.usuario
      );

    return {
      ok: true,
      message:
        'Planilla anulada correctamente.',
      notificacion:
        notificacion
    };

  } finally {

    lock.releaseLock();
  }
}


/* ============================================================
   CONSULTAR PLANILLAS
   ============================================================ */

function listarPlanillas_(params) {

  params =
    params || {};

  const contexto =
    obtenerContextoUsuario_(
      params
    );

  if (!contexto.ok) {
    return contexto;
  }

  const sesion =
    contexto.sesion;

  const sh =
    getPlanillasSheet_();

  let rows =
    readAllRows_(
      sh
    );

  /*
   * FILTRO PRINCIPAL:
   *
   * Usuario de peaje:
   * solamente su peaje.
   *
   * Admin / Interventoría:
   * TODOS.
   */

  if (
    !esUsuarioGlobal_(sesion)
  ) {

    const peaje =
      normalizarPeaje_(
        sesion.peaje
      );

    rows =
      rows.filter(
        function(row) {

          return (
            normalizarPeaje_(
              row.peaje
            ) === peaje
          );

        }
      );
  }

  const q =
    String(
      params.q ||
      ''
    )
      .trim()
      .toLowerCase();

  const estado =
    normalizarEstadoPlanilla_(
      params.estado ||
      ''
    );

  const fecha =
    String(
      params.fecha ||
      ''
    ).trim();

  const filtered =
    rows.filter(
      function(row) {

        if (
          estado &&
          normalizarEstadoPlanilla_(
            row.estado ||
            ''
          ) !==
          estado
        ) {
          return false;
        }

        if (
          fecha &&
          normalizeDateString_(
            row.fecha
          ) !== fecha
        ) {
          return false;
        }

        if (q) {

          const text = [

            row.id,
            row.codigo,
            row.peaje,
            row.razon,
            row.recibe,
            row.ciudad,
            row.lugarEntrega,
            row.lugarRecibo,
            row.entregadoNombre,
            row.usuario

          ]
            .join(' ')
            .toLowerCase();

          if (
            text.indexOf(q) === -1
          ) {
            return false;
          }
        }

        return true;
      }
    );

  filtered.sort(
    function(a, b) {

      return (
        dateValue_(
          b.updatedAt ||
          b.createdAt
        ) -
        dateValue_(
          a.updatedAt ||
          a.createdAt
        )
      );
    }
  );

  return {

    ok: true,

    rows:
      filtered.map(
        serializarRegistro_
      ),

    total:
      filtered.length,

    usuario:
      sesion.usuario,

    nombre:
      sesion.nombre,

    rol:
      sesion.rol,

    peaje:
      sesion.peaje
  };
}


/* ============================================================
   OBTENER UNA PLANILLA
   ============================================================ */

function obtenerPlanilla_(params) {

  params =
    params || {};

  const contexto =
    obtenerContextoUsuario_(
      params
    );

  if (!contexto.ok) {
    return contexto;
  }

  const sesion =
    contexto.sesion;

  const id =
    String(
      params.id ||
      ''
    ).trim();

  if (!id) {

    return {
      ok: false,
      error:
        'Falta el ID de la planilla.'
    };
  }

  const sh =
    getPlanillasSheet_();

  const found =
    findRowById_(
      sh,
      id
    );

  if (!found) {

    return {
      ok: false,
      error:
        'No se encontró la planilla.'
    };
  }

  const row =
    rowToObject_(
      sh,
      found.rowNumber
    );

  if (
    !puedeAccederPlanilla_(
      sesion,
      row
    )
  ) {

    return {
      ok: false,
      error:
        'No tiene permiso para consultar esta planilla.'
    };
  }

  return {

    ok: true,

    row:
      serializarRegistro_(
        row
      ),

    usuario:
      sesion.usuario,

    nombre:
      sesion.nombre,

    rol:
      sesion.rol,

    peaje:
      sesion.peaje
  };
}


/* ============================================================
   DASHBOARD
   ============================================================ */

function obtenerDashboard_(params) {

  params =
    params || {};

  const contexto =
    obtenerContextoUsuario_(
      params
    );

  if (!contexto.ok) {
    return contexto;
  }

  const sesion =
    contexto.sesion;

  let rows =
    readAllRows_(
      getPlanillasSheet_()
    );

  /*
   * FILTRO POR PEAJE
   */

  if (
    !esUsuarioGlobal_(sesion)
  ) {

    const peaje =
      normalizarPeaje_(
        sesion.peaje
      );

    rows =
      rows.filter(
        function(r) {

          return (
            normalizarPeaje_(
              r.peaje
            ) === peaje
          );

        }
      );
  }

  const activas =
    rows.filter(
      function(r) {

        return String(
          normalizarEstadoPlanilla_(
            r.estado
          )
        ) !==
        'ANULADA';

      }
    );

  const total =
    activas.reduce(
      function(sum, r) {

        return sum +
          number_(
            r.total
          );

      },
      0
    );

  const entregadas =
    activas.filter(
      function(r) {

        return normalizarEstadoPlanilla_(
          r.estado
        ) ===
        'ENTREGADA';

      }
    ).length;

  const cerradas =
    activas.filter(
      function(r) {

        return normalizarEstadoPlanilla_(
          r.estado
        ) ===
        'CERRADA';

      }
    ).length;

  const now =
    new Date();

  const year =
    now.getFullYear();

  const month =
    now.getMonth();

  const monthRows =
    activas.filter(
      function(r) {

        const d =
          asDate_(
            r.fecha
          );

        return (
          d &&
          d.getFullYear() ===
            year &&
          d.getMonth() ===
            month
        );
      }
    );

  const monthTotal =
    monthRows.reduce(
      function(sum, r) {

        return sum +
          number_(
            r.total
          );

      },
      0
    );

  const monthlyTotals =
    Array.from(
      {
        length: 12
      },
      function() {
        return 0;
      }
    );

  activas.forEach(
    function(r) {

      const d =
        asDate_(
          r.fecha
        );

      if (
        d &&
        d.getFullYear() ===
          year
      ) {

        monthlyTotals[
          d.getMonth()
        ] += number_(
          r.total
        );
      }
    }
  );

  const recent =
    activas
      .sort(
        function(a, b) {

          return (
            dateValue_(
              b.updatedAt ||
              b.createdAt
            ) -
            dateValue_(
              a.updatedAt ||
              a.createdAt
            )
          );
        }
      )
      .slice(
        0,
        10
      )
      .map(
        serializarRegistro_
      );

  return {

    ok: true,

    usuario:
      sesion.usuario,

    nombre:
      sesion.nombre,

    rol:
      sesion.rol,

    peaje:
      sesion.peaje,

    estado:
      sesion.estado,

    metrics: {

      planillas:
        activas.length,

      total:
        total,

      monthTotal:
        monthTotal,

      entregadas:
        entregadas,

      cerradas:
        cerradas
    },

    monthlyTotals:
      monthlyTotals,

    recent:
      recent,

    generatedAt:
      new Date().toISOString()
  };
}


/* ============================================================
   SEGURIDAD · ROLES Y CONTRASEÑAS
   ============================================================ */

function esUsuarioAdministrador_(sesion) {

  if (!sesion) {
    return false;
  }

  const rol =
    String(
      sesion.rol || ''
    )
      .trim()
      .toUpperCase();

  return (
    rol === 'ADMIN' ||
    rol === 'ADMINISTRADOR'
  );
}


function hashContrasena_(password) {

  password =
    String(
      password == null
        ? ''
        : password
    );

  const bytes =
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      password,
      Utilities.Charset.UTF_8
    );

  return bytes
    .map(function(byte) {
      const v =
        byte < 0
          ? byte + 256
          : byte;

      return ('0' + v.toString(16))
        .slice(-2);
    })
    .join('');
}


function esHashContrasena_(value) {

  return /^[a-f0-9]{64}$/i.test(
    String(value || '').trim()
  );
}


function verificarContrasena_(
  password,
  almacenada
) {

  password =
    String(
      password == null
        ? ''
        : password
    );

  almacenada =
    String(
      almacenada == null
        ? ''
        : almacenada
    ).trim();

  if (!password || !almacenada) {
    return false;
  }

  // Compatibilidad con instalaciones anteriores.
  if (!esHashContrasena_(almacenada)) {
    return almacenada === password;
  }

  return (
    hashContrasena_(password)
      .toLowerCase() ===
    almacenada.toLowerCase()
  );
}


/* ============================================================
   PERMISOS POR PEAJE
   ============================================================ */

function esUsuarioGlobal_(sesion) {

  if (!sesion) {
    return false;
  }

  const rol =
    String(
      sesion.rol ||
      ''
    )
      .trim()
      .toUpperCase();

  const peaje =
    normalizarPeaje_(
      sesion.peaje
    );

  if (
    rol === 'ADMIN' ||
    rol === 'ADMINISTRADOR' ||
    rol === 'INTERVENTORIA'
  ) {
    return true;
  }

  if (
    peaje === 'TODOS' ||
    peaje === 'ADMINISTRACION CENTRAL' ||
    peaje === 'ADMINISTRACIÓN CENTRAL'
  ) {
    return true;
  }

  return false;
}


function puedeAccederPlanilla_(
  sesion,
  row
) {

  if (!sesion || !row) {
    return false;
  }

  if (
    esUsuarioGlobal_(
      sesion
    )
  ) {
    return true;
  }

  const peajeUsuario =
    normalizarPeaje_(
      sesion.peaje
    );

  const peajePlanilla =
    normalizarPeaje_(
      row.peaje
    );

  return (
    peajeUsuario &&
    peajePlanilla &&
    peajeUsuario ===
      peajePlanilla
  );
}


function normalizarPeaje_(value) {

  return String(
    value ||
    ''
  )
    .trim()
    .replace(
      /\s+/g,
      ' '
    )
    .toUpperCase();
}


function normalizarEstadoPlanilla_(
  value
) {

  const estado =
    String(
      value ||
      ''
    )
      .trim()
      .toUpperCase();

  if (
    estado ===
    'ENTREGADO'
  ) {
    return 'ENTREGADA';
  }

  return estado;
}


/* ============================================================
   NORMALIZACIÓN DE DATOS
   ============================================================ */

function normalizarDatos_(data) {

  data =
    data || {};

  const textFields = [

    'id',
    'codigo',
    'peaje',
    'razon',
    'moneda',
    'lugarEntrega',
    'recibe',
    'ciudad',
    'lugarRecibo',
    'concepto',
    'obsValor',
    'letras',
    'observaciones',
    'entregadoNombre',
    'entregadoFirma',
    'revisadoNombre',
    'revisadoFirma',
    'estado',
    'usuario'

  ];

  const result = {};

  textFields.forEach(
    function(key) {

      result[key] =
        data[key] == null
          ? ''
          : String(
              data[key]
            ).trim();

    }
  );

  result.total =
    number_(
      data.total
    );

  result.tula =
    result.total;

  result.billetes =
    0;

  result.fecha =
    normalizeDateString_(
      data.fecha
    );

  result.estado =
    normalizarEstadoPlanilla_(
      result.estado
    );

  return result;
}


/* ============================================================
   VALIDAR PLANILLA
   ============================================================ */

function validarPlanilla_(d) {

  if (!d.peaje) {

    return {
      ok: false,
      error:
        'El campo Peaje es obligatorio.'
    };
  }

  if (!d.fecha) {

    return {
      ok: false,
      error:
        'La fecha es obligatoria.'
    };
  }

  if (d.total <= 0) {

    return {
      ok: false,
      error:
        'El Total entregado debe ser mayor que cero.'
    };
  }

  if (
    d.tula < 0 ||
    d.billetes < 0
  ) {

    return {
      ok: false,
      error:
        'Los valores de tula y billetes no pueden ser negativos.'
    };
  }

  const estadosPermitidos = [
    'BORRADOR',
    'APROBADO',
    'ENTREGADA',
    'CERRADA',
    'ANULADA'
  ];

  d.estado =
    normalizarEstadoPlanilla_(
      d.estado
    );

  if (
    d.estado &&
    estadosPermitidos.indexOf(
      d.estado
    ) === -1
  ) {

    return {
      ok: false,
      error:
        'Estado no válido.'
    };
  }

  return {
    ok: true
  };
}


/* ============================================================
   OBJETO → FILA
   ============================================================ */

function objectToRow_(obj) {

  return ZIMA.HEADERS.map(
    function(header) {

      let value =
        obj[header];

      if (
        header === 'total' ||
        header === 'tula' ||
        header === 'billetes'
      ) {

        return number_(
          value
        );
      }

      if (
        header === 'fecha'
      ) {

        return normalizeDateString_(
          value
        );
      }

      if (
        header === 'createdAt' ||
        header === 'updatedAt'
      ) {

        return value
          ? new Date(value)
          : new Date();
      }

      return value == null
        ? ''
        : value;
    }
  );
}


/* ============================================================
   FILA → OBJETO
   ============================================================ */

function rowToObject_(
  sh,
  rowNumber
) {

  const values =
    sh
      .getRange(
        rowNumber,
        1,
        1,
        ZIMA.HEADERS.length
      )
      .getValues()[0];

  const obj = {};

  ZIMA.HEADERS.forEach(
    function(header, i) {

      obj[header] =
        values[i];

    }
  );

  return obj;
}


/* ============================================================
   LEER TODAS LAS FILAS
   ============================================================ */

function readAllRows_(sh) {

  const lastRow =
    sh.getLastRow();

  if (
    lastRow < 2
  ) {
    return [];
  }

  const values =
    sh
      .getRange(
        2,
        1,
        lastRow - 1,
        ZIMA.HEADERS.length
      )
      .getValues();

  return values.map(
    function(row) {

      const obj = {};

      ZIMA.HEADERS.forEach(
        function(header, i) {

          obj[header] =
            row[i];

        }
      );

      return obj;
    }
  );
}


/* ============================================================
   BUSCAR FILA POR ID
   ============================================================ */

function findRowById_(
  sh,
  id
) {

  const idCol =
    headerIndex_(
      'id'
    );

  const lastRow =
    sh.getLastRow();

  if (
    lastRow < 2
  ) {
    return null;
  }

  const values =
    sh
      .getRange(
        2,
        idCol,
        lastRow - 1,
        1
      )
      .getValues();

  for (
    let i = 0;
    i < values.length;
    i++
  ) {

    if (
      String(
        values[i][0]
      ) ===
      String(id)
    ) {

      return {
        rowNumber:
          i + 2
      };
    }
  }

  return null;
}


/* ============================================================
   ÍNDICE DE COLUMNA
   ============================================================ */

function headerIndex_(name) {

  const index =
    ZIMA.HEADERS.indexOf(
      name
    );

  if (
    index === -1
  ) {

    throw new Error(
      'Columna no configurada: ' +
      name
    );
  }

  return index + 1;
}


/* ============================================================
   GENERAR CÓDIGO
   ============================================================ */

function generarCodigo_(
  fecha,
  sh
) {

  const d =
    normalizeDateString_(
      fecha
    ) ||
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );

  const base =
    d.replace(
      /-/g,
      ''
    );

  const rows =
    readAllRows_(
      sh
    );

  let max = 0;

  rows.forEach(
    function(r) {

      const codigo =
        String(
          r.codigo ||
          ''
        );

      if (
        codigo.indexOf(
          'P' + base
        ) === 0
      ) {

        const n =
          parseInt(
            codigo.slice(
              (
                'P' +
                base
              ).length
            ),
            10
          );

        if (
          !isNaN(n)
        ) {

          max =
            Math.max(
              max,
              n
            );
        }
      }
    }
  );

  return (
    'P' +
    base +
    String(
      max + 1
    ).padStart(
      4,
      '0'
    )
  );
}


/* ============================================================
   SERIALIZAR
   ============================================================ */

function serializarRegistro_(
  obj
) {

  const copy = {};

  Object.keys(
    obj
  ).forEach(
    function(key) {

      const value =
        obj[key];

      if (
        value instanceof Date
      ) {

        if (
          key === 'fecha'
        ) {

          copy[key] =
            Utilities.formatDate(
              value,
              Session.getScriptTimeZone(),
              'yyyy-MM-dd'
            );

        } else {

          copy[key] =
            value.toISOString();
        }

      } else {

        copy[key] =
          key === 'estado'
            ? normalizarEstadoPlanilla_(
                value
              )
            : value;
      }
    }
  );

  return copy;
}


/* ============================================================
   NÚMEROS
   ============================================================ */

function number_(value) {

  if (
    typeof value ===
    'number'
  ) {

    return isFinite(
      value
    )
      ? value
      : 0;
  }

  if (
    value == null ||
    value === ''
  ) {

    return 0;
  }

  let s =
    String(
      value
    ).trim();

  s =
    s.replace(
      /[^\d,.-]/g,
      ''
    );

  if (
    s.indexOf('.') !== -1 &&
    s.indexOf(',') !== -1
  ) {

    s =
      s
        .replace(
          /\./g,
          ''
        )
        .replace(
          ',',
          '.'
        );

  } else if (
    s.indexOf('.') !== -1
  ) {

    /*
     * Si viene algo como 8.000.000,
     * se interpreta como 8000000.
     */

    if (
      /^\d{1,3}(\.\d{3})+$/.test(
        s
      )
    ) {

      s =
        s.replace(
          /\./g,
          ''
        );

    } else {

      s =
        s.replace(
          ',',
          '.'
        );
    }

  } else {

    s =
      s.replace(
        ',',
        '.'
      );
  }

  const n =
    Number(s);

  return isFinite(n)
    ? n
    : 0;
}


/* ============================================================
   FECHAS
   ============================================================ */

function normalizeDateString_(
  value
) {

  if (!value) {
    return '';
  }

  if (
    Object.prototype.toString.call(
      value
    ) ===
      '[object Date]' &&
    !isNaN(
      value.getTime()
    )
  ) {

    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );
  }

  const s =
    String(
      value
    ).trim();

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      s
    )
  ) {

    return s;
  }

  const d =
    new Date(s);

  if (
    isNaN(
      d.getTime()
    )
  ) {

    return '';
  }

  return Utilities.formatDate(
    d,
    Session.getScriptTimeZone(),
    'yyyy-MM-dd'
  );
}


function asDate_(
  value
) {

  if (!value) {
    return null;
  }

  if (
    Object.prototype.toString.call(
      value
    ) ===
    '[object Date]'
  ) {

    return isNaN(
      value.getTime()
    )
      ? null
      : value;
  }

  const s =
    String(
      value
    );

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      s
    )
  ) {

    const parts =
      s
        .split('-')
        .map(Number);

    return new Date(
      parts[0],
      parts[1] - 1,
      parts[2]
    );
  }

  const d =
    new Date(s);

  return isNaN(
    d.getTime()
  )
    ? null
    : d;
}


function dateValue_(
  value
) {

  if (!value) {
    return 0;
  }

  const d =
    asDate_(
      value
    );

  return d
    ? d.getTime()
    : 0;
}


/* ============================================================
   AUDITORÍA
   ============================================================ */

function registrarAuditoria_(
  accion,
  row,
  detalle
) {

  const ss =
    getSpreadsheet_();

  const sh =
    ss.getSheetByName(
      ZIMA.SHEET_AUDITORIA
    );

  if (!sh) {
    return;
  }

  const email =
    obtenerUsuario_();

  sh.appendRow([

    new Date(),

    accion,

    row.id ||
      '',

    row.codigo ||
      '',

    row.usuario ||
      '',

    detalle ||
      '',

    email

  ]);
}


/* ============================================================
   SOPORTE EN LINEA
   ============================================================ */

function recortarSoporte_(
  value,
  max
) {

  value =
    String(
      value == null
        ? ''
        : value
    );

  max =
    max ||
    6000;

  if (value.length <= max) {
    return value;
  }

  return value.substring(0, max) +
    '\n...[recortado]';
}


function registrarSoporte_(
  data
) {

  data =
    data ||
    {};

  let contexto =
    null;

  try {
    contexto =
      obtenerContextoUsuario_(
        data
      );
  } catch (e) {
    contexto =
      null;
  }

  const sesion =
    contexto &&
    contexto.ok
      ? contexto.sesion
      : {
        usuario:
          data.usuario ||
          data.user ||
          '',

        nombre:
          data.nombre ||
          data.name ||
          '',

        rol:
          data.rol ||
          data.role ||
          '',

        peaje:
          data.peaje ||
          ''
      };

  const fecha =
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd HH:mm:ss'
    );

  const tipo =
    String(
      data.tipo ||
      data.type ||
      'manual'
    ).trim();

  const titulo =
    String(
      data.titulo ||
      data.title ||
      'Solicitud de soporte'
    ).trim();

  const mensaje =
    recortarSoporte_(
      data.mensaje ||
      data.message ||
      data.error ||
      ''
    );

  const captura =
    recortarSoporte_(
      data.captura ||
      data.capture ||
      data.detalle ||
      ''
    );

  const pagina =
    String(
      data.pagina ||
      data.page ||
      ''
    ).trim();

  const navegador =
    String(
      data.navegador ||
      data.userAgent ||
      ''
    ).trim();

  const asunto =
    'ZIMA 360 - Soporte ' +
    tipo.toUpperCase() +
    ' - ' +
    titulo;

  const html =
    '<div style="font-family:Arial,sans-serif;color:#172033;line-height:1.45">' +
    '<div style="border-left:5px solid #f4c20d;padding:4px 0 4px 14px;margin-bottom:16px">' +
    '<div style="font-size:12px;color:#6b7280;font-weight:bold;letter-spacing:1px;text-transform:uppercase">ZIMA 360</div>' +
    '<div style="font-size:20px;font-weight:800;color:#111827">Reporte de soporte en linea</div>' +
    '</div>' +
    '<table style="border-collapse:collapse;width:100%;max-width:760px">' +
    filaHtmlPlanillaPdf_('Fecha', fecha) +
    filaHtmlPlanillaPdf_('Tipo', tipo) +
    filaHtmlPlanillaPdf_('Titulo', titulo) +
    filaHtmlPlanillaPdf_('Mensaje', mensaje) +
    filaHtmlPlanillaPdf_('Pagina', pagina) +
    filaHtmlPlanillaPdf_('Usuario', sesion.usuario || '') +
    filaHtmlPlanillaPdf_('Nombre', sesion.nombre || '') +
    filaHtmlPlanillaPdf_('Rol', sesion.rol || '') +
    filaHtmlPlanillaPdf_('Peaje', sesion.peaje || '') +
    filaHtmlPlanillaPdf_('Navegador', navegador) +
    '</table>' +
    '<p style="margin:18px 0 8px;color:#4b5563"><b>Captura tecnica del error</b></p>' +
    '<pre style="white-space:pre-wrap;background:#f6f8fb;border:1px solid #d8dee8;padding:12px;border-radius:6px;max-width:760px">' +
    htmlEscape_(
      captura ||
      'Sin captura tecnica.'
    ) +
    '</pre>' +
    '</div>';

  const texto =
    [
      'ZIMA 360 - Reporte de soporte',
      'Fecha: ' + fecha,
      'Tipo: ' + tipo,
      'Titulo: ' + titulo,
      'Mensaje: ' + mensaje,
      'Pagina: ' + pagina,
      'Usuario: ' + (sesion.usuario || ''),
      'Nombre: ' + (sesion.nombre || ''),
      'Rol: ' + (sesion.rol || ''),
      'Peaje: ' + (sesion.peaje || ''),
      'Navegador: ' + navegador,
      '',
      'Captura tecnica:',
      captura
    ].join('\n');

  const destinatarios =
    obtenerEmailsUsuariosNotificacion_(
      sesion
    );

  if (!destinatarios.length) {
    return {
      ok: false,
      error:
        'No hay correos de soporte configurados.'
    };
  }

  MailApp.sendEmail({
    to:
      destinatarios.join(','),

    subject:
      asunto.substring(0, 240),

    body:
      texto,

    htmlBody:
      html
  });

  return {
    ok: true,
    enviadoA:
      destinatarios.join(','),
    fecha:
      fecha
  };
}


/* ============================================================
   NOTIFICACIONES DE SEGUIMIENTO
   ============================================================ */

function emailValido_(
  value
) {

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(
      value ||
      ''
    ).trim()
  );
}


function extraerEmails_(
  value
) {

  const emails = [];

  String(
    value ||
    ''
  )
    .split(/[,\s;]+/)
    .forEach(function(email) {

      email =
        String(
          email ||
          ''
        ).trim();

      if (
        emailValido_(
          email
        ) &&
        emails.indexOf(email) === -1
      ) {
        emails.push(email);
      }
    });

  return emails;
}


function obtenerEmailsUsuariosNotificacion_(
  sesion
) {

  const emails = [];

  const agregar = function(value) {

    extraerEmails_(
      value
    ).forEach(function(email) {
      if (emails.indexOf(email) === -1) {
        emails.push(email);
      }
    });
  };

  agregar(
    obtenerValorConfig_(
      'CORREOS_NOTIFICACION'
    ) ||
    'sistemaplanillaszima@gmail.com'
  );

  return emails;
}


function obtenerEmailNotificacion_(
  sesion
) {

  return obtenerEmailsUsuariosNotificacion_(
    sesion
  ).join(',');
}


function htmlEscape_(
  value
) {

  return String(
    value == null
      ? ''
      : value
  )
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


function formatoMonedaCorreo_(
  value
) {

  const numero =
    number_(
      value
    );

  return '$ ' +
    numero
      .toFixed(0)
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}


function nombreArchivoPlanillaPdf_(
  row,
  accion
) {

  const codigo =
    String(
      row &&
      (
        row.codigo ||
        row.id
      ) ||
      'planilla'
    )
      .trim()
      .replace(/[^a-z0-9_.-]/gi, '_');

  return 'ZIMA_' +
    String(
      accion ||
      'PLANILLA'
    )
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_.-]/g, '_') +
    '_' +
    codigo +
    '.pdf';
}


function filaHtmlPlanillaPdf_(
  label,
  value
) {

  return '<tr>' +
    '<th>' +
    htmlEscape_(
      label
    ) +
    '</th>' +
    '<td>' +
    htmlEscape_(
      value
    ) +
    '</td>' +
    '</tr>';
}


function construirHtmlPlanillaPdf_(
  row,
  accion,
  sesion,
  detalle
) {

  row =
    row ||
    {};

  sesion =
    sesion ||
    {};

  const fechaPlanilla =
    normalizeDateString_(
      row.fecha
    );

  const fechaGeneracion =
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd HH:mm:ss'
    );

  const filas = [
    filaHtmlPlanillaPdf_('Codigo', row.codigo || ''),
    filaHtmlPlanillaPdf_('ID', row.id || ''),
    filaHtmlPlanillaPdf_('Peaje', row.peaje || ''),
    filaHtmlPlanillaPdf_('Razon', row.razon || ''),
    filaHtmlPlanillaPdf_('Moneda', row.moneda || ''),
    filaHtmlPlanillaPdf_('Lugar de entrega', row.lugarEntrega || ''),
    filaHtmlPlanillaPdf_('Recibe', row.recibe || ''),
    filaHtmlPlanillaPdf_('Ciudad', row.ciudad || ''),
    filaHtmlPlanillaPdf_('Lugar de recibo', row.lugarRecibo || ''),
    filaHtmlPlanillaPdf_('Fecha', fechaPlanilla),
    filaHtmlPlanillaPdf_('Concepto', row.concepto || ''),
    filaHtmlPlanillaPdf_('Total entregado', formatoMonedaCorreo_(row.total)),
    filaHtmlPlanillaPdf_('Observacion valor', row.obsValor || ''),
    filaHtmlPlanillaPdf_('Valor tula', formatoMonedaCorreo_(row.tula)),
    filaHtmlPlanillaPdf_('Valor billetes', formatoMonedaCorreo_(row.billetes)),
    filaHtmlPlanillaPdf_('Valor en letras', row.letras || ''),
    filaHtmlPlanillaPdf_('Observaciones', row.observaciones || ''),
    filaHtmlPlanillaPdf_('Entregado por', row.entregadoNombre || ''),
    filaHtmlPlanillaPdf_('Firma entregado', row.entregadoFirma || ''),
    filaHtmlPlanillaPdf_('Revisado por', row.revisadoNombre || ''),
    filaHtmlPlanillaPdf_('Firma revisado', row.revisadoFirma || ''),
    filaHtmlPlanillaPdf_('Estado', row.estado || ''),
    filaHtmlPlanillaPdf_('Usuario responsable', sesion.usuario || row.usuario || ''),
    filaHtmlPlanillaPdf_('Nombre responsable', sesion.nombre || ''),
    filaHtmlPlanillaPdf_('Rol responsable', sesion.rol || ''),
    filaHtmlPlanillaPdf_('Fecha de generacion', fechaGeneracion)
  ].join('');

  return '<!doctype html>' +
    '<html><head><meta charset="UTF-8">' +
    '<style>' +
    '@page{size:letter;margin:22mm 16mm}' +
    'body{font-family:Arial,sans-serif;color:#172033;font-size:12px}' +
    '.brand{border-bottom:4px solid #f4c20d;padding-bottom:12px;margin-bottom:18px}' +
    '.kicker{font-size:10px;letter-spacing:1.2px;text-transform:uppercase;color:#6b7280;font-weight:bold}' +
    'h1{font-size:22px;margin:5px 0 4px;color:#111827}' +
    '.sub{color:#4b5563;line-height:1.45}' +
    '.badge{display:inline-block;background:#111827;color:#fff;padding:6px 10px;border-radius:4px;font-size:11px;font-weight:bold;margin-top:8px}' +
    'table{width:100%;border-collapse:collapse;margin-top:16px}' +
    'th,td{border:1px solid #d8dee8;padding:8px 9px;vertical-align:top}' +
    'th{width:32%;background:#f5f7fb;text-align:left;color:#374151}' +
    '.footer{margin-top:18px;color:#6b7280;font-size:10px;line-height:1.5}' +
    '</style></head><body>' +
    '<div class="brand">' +
    '<div class="kicker">ZIMA 360 · Seguimiento de planillas</div>' +
    '<h1>Planilla ' +
    htmlEscape_(
      row.codigo ||
      row.id ||
      ''
    ) +
    '</h1>' +
    '<div class="sub">' +
    htmlEscape_(
      detalle ||
      ''
    ) +
    '</div>' +
    '<div class="badge">' +
    htmlEscape_(
      accion ||
      'PLANILLA'
    ) +
    '</div>' +
    '</div>' +
    '<table>' +
    filas +
    '</table>' +
    '<div class="footer">' +
    'Este PDF fue generado automaticamente por ZIMA 360 como soporte del movimiento registrado.' +
    '</div>' +
    '</body></html>';
}


function crearPdfPlanilla_(
  row,
  accion,
  sesion,
  detalle
) {

  const html =
    construirHtmlPlanillaPdf_(
      row,
      accion,
      sesion,
      detalle
    );

  const nombre =
    nombreArchivoPlanillaPdf_(
      row,
      accion
    );

  return Utilities
    .newBlob(
      html,
      'text/html',
      nombre.replace(/\.pdf$/i, '.html')
    )
    .getAs(
      MimeType.PDF
    )
    .setName(
      nombre
    );
}


function construirHtmlCorreoCambio_(
  accion,
  row,
  sesion,
  detalle,
  fechaCambio
) {

  return '<div style="font-family:Arial,sans-serif;color:#172033;line-height:1.45">' +
    '<div style="border-left:5px solid #f4c20d;padding:4px 0 4px 14px;margin-bottom:16px">' +
    '<div style="font-size:12px;color:#6b7280;font-weight:bold;letter-spacing:1px;text-transform:uppercase">ZIMA 360</div>' +
    '<div style="font-size:20px;font-weight:800;color:#111827">Seguimiento de planilla</div>' +
    '</div>' +
    '<p>Se registr&oacute; una <b>' +
    htmlEscape_(
      accion
    ) +
    '</b> en el sistema.</p>' +
    '<table style="border-collapse:collapse;width:100%;max-width:680px">' +
    filaHtmlPlanillaPdf_('Detalle', detalle || '') +
    filaHtmlPlanillaPdf_('Fecha del cambio', fechaCambio) +
    filaHtmlPlanillaPdf_('Codigo', row.codigo || '') +
    filaHtmlPlanillaPdf_('ID', row.id || '') +
    filaHtmlPlanillaPdf_('Peaje', row.peaje || '') +
    filaHtmlPlanillaPdf_('Fecha planilla', normalizeDateString_(row.fecha)) +
    filaHtmlPlanillaPdf_('Estado', row.estado || '') +
    filaHtmlPlanillaPdf_('Total', formatoMonedaCorreo_(row.total)) +
    filaHtmlPlanillaPdf_('Usuario', sesion && sesion.usuario || '') +
    filaHtmlPlanillaPdf_('Nombre', sesion && sesion.nombre || '') +
    filaHtmlPlanillaPdf_('Rol', sesion && sesion.rol || '') +
    '</table>' +
    '<p style="margin-top:16px;color:#4b5563">Se adjunta una copia en PDF de la planilla.</p>' +
    '</div>';
}


function construirHtmlCorreoIngreso_(
  sesion,
  fechaIngreso
) {

  sesion =
    sesion ||
    {};

  return '<div style="font-family:Arial,sans-serif;color:#172033;line-height:1.45">' +
    '<div style="border-left:5px solid #f4c20d;padding:4px 0 4px 14px;margin-bottom:16px">' +
    '<div style="font-size:12px;color:#6b7280;font-weight:bold;letter-spacing:1px;text-transform:uppercase">ZIMA 360</div>' +
    '<div style="font-size:20px;font-weight:800;color:#111827">Ingreso a la plataforma</div>' +
    '</div>' +
    '<p>Se registr&oacute; un inicio de sesi&oacute;n correcto.</p>' +
    '<table style="border-collapse:collapse;width:100%;max-width:680px">' +
    filaHtmlPlanillaPdf_('Fecha de ingreso', fechaIngreso) +
    filaHtmlPlanillaPdf_('Usuario', sesion.usuario || '') +
    filaHtmlPlanillaPdf_('Nombre', sesion.nombre || '') +
    filaHtmlPlanillaPdf_('Rol', sesion.rol || '') +
    filaHtmlPlanillaPdf_('Peaje', sesion.peaje || '') +
    filaHtmlPlanillaPdf_('Email perfil', sesion.email || '') +
    '</table>' +
    '</div>';
}


function notificarIngresoPlataforma_(
  sesion
) {

  try {

    const destino =
      obtenerEmailNotificacion_(
        sesion
      );

    if (!destino) {
      return {
        ok: false,
        enviado: false,
        error:
          'No hay correos de notificación configurados.'
      };
    }

    const zona =
      Session.getScriptTimeZone();

    const fechaIngreso =
      Utilities.formatDate(
        new Date(),
        zona,
        'yyyy-MM-dd HH:mm:ss'
      );

    const asunto =
      'ZIMA 360 - Ingreso a la plataforma - ' +
      (
        sesion &&
        sesion.usuario ||
        ''
      );

    const lineas = [
      'Ingreso a la plataforma ZIMA 360',
      '',
      'Fecha de ingreso: ' + fechaIngreso,
      '',
      'Usuario',
      'Usuario: ' + (sesion && sesion.usuario || ''),
      'Nombre: ' + (sesion && sesion.nombre || ''),
      'Rol: ' + (sesion && sesion.rol || ''),
      'Peaje: ' + (sesion && sesion.peaje || ''),
      'Email perfil: ' + (sesion && sesion.email || '')
    ];

    MailApp.sendEmail({
      to:
        destino,

      subject:
        asunto,

      body:
        lineas.join('\n'),

      htmlBody:
        construirHtmlCorreoIngreso_(
          sesion,
          fechaIngreso
        )
    });

    return {
      ok: true,
      enviado: true,
      destinatarios:
        destino
    };

  } catch (e) {

    console.error(
      'No fue posible enviar notificacion de ingreso: ' +
      errorMessage_(
        e
      )
    );

    return {
      ok: false,
      enviado: false,
      error:
        'No fue posible enviar el correo de ingreso: ' +
        errorMessage_(
          e
        )
    };
  }
}


function notificarCambioPlanilla_(
  accion,
  row,
  sesion,
  detalle
) {

  try {

    const destino =
      obtenerEmailNotificacion_(
        sesion
      );

    if (!destino) {
      return {
        ok: false,
        enviado: false,
        error:
          'No hay correos de notificación configurados. Complete CORREOS_NOTIFICACION en CONFIG o el EMAIL de un ADMIN/INTERVENTORIA activo.'
      };
    }

    const zona =
      Session.getScriptTimeZone();

    const fechaCambio =
      Utilities.formatDate(
        new Date(),
        zona,
        'yyyy-MM-dd HH:mm:ss'
      );

    const fechaPlanilla =
      normalizeDateString_(
        row.fecha
      );

    const asunto =
      'ZIMA 360 - ' +
      accion +
      ' de planilla ' +
      (
        row.codigo ||
        row.id ||
        ''
      );

    const lineas = [
      'Seguimiento ZIMA 360',
      '',
      'Accion: ' + accion,
      'Detalle: ' + (detalle || ''),
      'Fecha del cambio: ' + fechaCambio,
      '',
      'Planilla',
      'Codigo: ' + (row.codigo || ''),
      'ID: ' + (row.id || ''),
      'Peaje: ' + (row.peaje || ''),
      'Fecha: ' + fechaPlanilla,
      'Estado: ' + (row.estado || ''),
      'Total: ' + number_(row.total),
      '',
      'Usuario responsable',
      'Usuario: ' + (sesion && sesion.usuario || ''),
      'Nombre: ' + (sesion && sesion.nombre || ''),
      'Rol: ' + (sesion && sesion.rol || ''),
      '',
      'Se adjunta una copia en PDF de la planilla.'
    ];

    const pdf =
      crearPdfPlanilla_(
        row,
        accion,
        sesion,
        detalle
      );

    MailApp.sendEmail({
      to:
        destino,

      subject:
        asunto,

      body:
        lineas.join('\n'),

      htmlBody:
        construirHtmlCorreoCambio_(
          accion,
          row,
          sesion,
          detalle,
          fechaCambio
        ),

      attachments: [
        pdf
      ]
    });

    return {
      ok: true,
      enviado: true,
      destinatarios:
        destino
    };

  } catch (e) {

    console.error(
      'No fue posible enviar notificacion de planilla: ' +
      errorMessage_(
        e
      )
    );

    return {
      ok: false,
      enviado: false,
      error:
        'No fue posible enviar el correo: ' +
        errorMessage_(
          e
        )
    };
  }
}


/* ============================================================
   USUARIO GOOGLE
   ============================================================ */

function obtenerUsuario_() {

  try {

    const email =
      Session
        .getActiveUser()
        .getEmail();

    if (email) {
      return email;
    }

  } catch (e) {}

  return 'Usuario ZIMA';
}


/* ============================================================
   ACCESO A BASE DE DATOS
   ============================================================ */

function getSpreadsheet_() {

  const id =
    PropertiesService
      .getScriptProperties()
      .getProperty(
        ZIMA.SPREADSHEET_PROPERTY
      );

  if (!id) {

    throw new Error(
      'ZIMA 360 no está configurado. Ejecute setupSistema() una vez.'
    );
  }

  try {

    return SpreadsheetApp.openById(
      id
    );

  } catch (e) {

    throw new Error(
      'No se pudo abrir la hoja de ZIMA 360. Verifique los permisos.'
    );
  }
}


function getPlanillasSheet_() {

  const ss =
    getSpreadsheet_();

  const sh =
    ss.getSheetByName(
      ZIMA.SHEET_PLANILLAS
    );

  if (!sh) {

    throw new Error(
      'No existe la hoja PLANILLAS. Ejecute setupSistema().'
    );
  }

  return sh;
}


/* ============================================================
   PARSEO POST
   ============================================================ */

function parsePost_(e) {

  if (!e) {
    return {};
  }

  if (
    e.postData &&
    e.postData.contents
  ) {

    const raw =
      String(
        e.postData.contents
      ).trim();

    if (raw) {

      try {

        return JSON.parse(
          raw
        );

      } catch (jsonError) {}
    }
  }

  const params =
    e.parameter ||
    {};

  const result = {};

  Object.keys(
    params
  ).forEach(
    function(key) {

      result[key] =
        params[key];

    }
  );

  return result;
}


/* ============================================================
   JSON
   ============================================================ */

function jsonOutput_(
  obj,
  callback
) {

  callback =
    String(
      callback || ''
    ).trim();

  if (
    callback &&
    /^[A-Za-z_$][0-9A-Za-z_$]*(?:\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(callback)
  ) {

    return ContentService
      .createTextOutput(
        callback +
        '(' +
        JSON.stringify(obj) +
        ');'
      )
      .setMimeType(
        ContentService.MimeType.JAVASCRIPT
      );
  }

  return ContentService
    .createTextOutput(
      JSON.stringify(
        obj
      )
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}


/* ============================================================
   URL DEL WEB APP
   ============================================================ */

function obtenerWebAppUrl_() {

  try {
    return ScriptApp.getService().getUrl() || '';
  } catch (e) {
    return '';
  }
}


/* ============================================================
   ERROR
   ============================================================ */

function errorMessage_(
  error
) {

  return error &&
    error.message
    ? error.message
    : String(
        error ||
        'Error desconocido.'
      );
}


/* ============================================================
   CONFIGURAR SISTEMA
   ============================================================ */

function configurarSistemaUsuarios() {

  const resultado =
    setupSistema();

  return {

    ok: true,

    mensaje:
      'Sistema ZIMA 360 configurado correctamente.',

    resultado:
      resultado
  };
}


/* ============================================================
   PRUEBA DE BACKEND
   ============================================================ */

function pruebaBackend() {

  const setup =
    setupSistema();

  if (!setup.ok) {

    throw new Error(
      setup.error ||
      'No se pudo configurar el sistema.'
    );
  }

  const login =
    autenticarUsuario(
      'admin',
      'Admin360'
    );

  if (!login.ok) {
    throw new Error(
      login.mensaje ||
      'No fue posible iniciar sesión con el usuario de prueba.'
    );
  }

  const prueba =
    guardarPlanilla_({

      action:
        'save',

      /*
       * Para la prueba se usa la sesión real del admin.
       */

      token:
        login.token,

      codigo:
        'PRUEBA-' +
        new Date().getTime(),

      peaje:
        'PRUEBA',

      razon:
        'ZIMA SEGURIDAD',

      moneda:
        'COP - Peso colombiano',

      lugarEntrega:
        'CENTRO EFECTIVO',

      recibe:
        'TransBank',

      ciudad:
        'FRAGUA',

      lugarRecibo:
        'PEAJE FRAGUA',

      fecha:
        Utilities.formatDate(
          new Date(),
          Session.getScriptTimeZone(),
          'yyyy-MM-dd'
        ),

      concepto:
        'PRUEBA DE CONEXIÓN',

      total:
        8000000,

      obsValor:
        'Registro automático de prueba',

      tula:
        8000000,

      billetes:
        0,

      letras:
        'OCHO MILLONES DE PESOS M/CTE',

      observaciones:
        'Prueba técnica',

      entregadoNombre:
        'Prueba',

      entregadoFirma:
        '',

      revisadoNombre:
        '',

      revisadoFirma:
        '',

      estado:
        'BORRADOR'

    });

  Logger.log(
    JSON.stringify(
      prueba,
      null,
      2
    )
  );

  return prueba;
}


/* ============================================================
   PRUEBA DE LOGIN
   ============================================================ */

function pruebaLogin() {

  const resultado =
    autenticarUsuario(
      'admin',
      'Admin360'
    );

  Logger.log(
    JSON.stringify(
      resultado,
      null,
      2
    )
  );

  return resultado;
}


/* ============================================================
   PRUEBA DE USUARIO
   ============================================================ */

function pruebaUsuario(
  usuario
) {

  const resultado =
    buscarUsuario_(
      usuario
    );

  if (resultado) {
    delete resultado.CONTRASENA;
  }

  Logger.log(
    JSON.stringify(
      resultado,
      null,
      2
    )
  );

  return resultado;
}
