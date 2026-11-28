
/**
 * DapurSaji — Database Setup
 * Google Apps Script V8
 * GASLY KB 2.1.0
 */

var SCHEMA_VERSION = '1.0.0';
var DEFAULT_TZ = 'Asia/Jakarta';
var ACCESS_PROFILE = 'P3';

var DB_SCHEMAS = {
  ORDERS: [
    'order_id',
    'created_at',
    'updated_at',
    'customer_name',
    'customer_phone',
    'delivery_date',
    'delivery_time',
    'fulfillment_type',
    'delivery_address',
    'customer_note',
    'order_status',
    'subtotal_amount',
    'dp_amount',
    'payment_due_at',
    'tracking_token_hash',
    'idempotency_key',
    'proof_file_id',
    'proof_mime_type',
    'proof_uploaded_at',
    'deleted_at',
    'upload_nonce'
  ],
  ORDER_ITEMS: [
    'item_id',
    'order_id',
    'package_id',
    'package_name_snapshot',
    'unit_price',
    'quantity',
    'line_subtotal',
    'created_at'
  ],
  CATALOG: [
    'package_id',
    'package_name',
    'category',
    'description',
    'menu_details',
    'price_amount',
    'minimum_quantity',
    'image_url',
    'is_active',
    'sort_order',
    'updated_at',
    'deleted_at'
  ]
};

var DB_CLASSIFICATIONS = {
  ORDERS: 'SENSITIVE_PII',
  ORDER_ITEMS: 'CONFIDENTIAL',
  CATALOG: 'PUBLIC'
};

var ENTITY_UPLOAD_CONFIG_ = {
  ORDERS: {
    sheetName: 'ORDERS',
    dataClassification: 'SENSITIVE_PII',
    visibility: 'private',
    allowedMimes: [
      'image/jpeg',
      'image/png',
      'image/webp'
    ]
  }
};

var ORDER_STATUSES_ = [
  'PENDING',
  'DP_PAID',
  'PROCESSING',
  'READY',
  'COMPLETED',
  'CANCELLED'
];

var FULFILLMENT_TYPES_ = [
  'DELIVERY',
  'PICKUP'
];

function normalizeHeader_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
}

function buildRowFromObject_(headers, recordObj) {
  return headers.map(function(header) {
    var value = recordObj[normalizeHeader_(header)];
    return value === undefined || value === null ? '' : value;
  });
}

function generateRandomSecret_(byteLength) {
  var targetLength = Number(byteLength) || 32;
  var pool = [];

  for (var i = 0; i < 5; i++) {
    pool.push(Utilities.getUuid());
  }

  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    Utilities.newBlob(pool.join(':')).getBytes()
  );

  var encoded = Utilities.base64EncodeWebSafe(digest)
    .replace(/=+$/, '');

  while (encoded.length < targetLength) {
    var extra = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      Utilities.newBlob(
        encoded + ':' + Utilities.getUuid()
      ).getBytes()
    );

    encoded += Utilities.base64EncodeWebSafe(extra)
      .replace(/=+$/, '');
  }

  return encoded.slice(0, targetLength);
}

function configureAdminPassphrase_(passphrase) {
  if (
    typeof passphrase !== 'string' ||
    passphrase.trim().length < 12
  ) {
    throw new Error(
      'Passphrase admin minimal 12 karakter.'
    );
  }

  var props = PropertiesService.getScriptProperties();
  var pepper = props.getProperty('AUTH_PEPPER');

  if (!pepper) {
    throw new Error('AUTH_PEPPER belum tersedia.');
  }

  var salt = generateRandomSecret_(16);
  var iterations = 2000;

  var hash = computeIteratedHash_(
    passphrase.trim(),
    salt,
    pepper,
    iterations
  );

  props.setProperties({
    ADMIN_PASSPHRASE_SALT: salt,
    ADMIN_PASSPHRASE_HASH: hash,
    ADMIN_PASSPHRASE_ITER: String(iterations)
  });

  return true;
}

function configureAdminPin_(pin) {
  var cleanPin = String(pin || '').trim();

  if (!/^\d{6}$/.test(cleanPin)) {
    throw new Error('PIN harus tepat 6 digit.');
  }

  var props = PropertiesService.getScriptProperties();
  var pepper = props.getProperty('AUTH_PEPPER');

  if (!pepper) {
    throw new Error('AUTH_PEPPER belum tersedia.');
  }

  var salt = generateRandomSecret_(16);
  var iterations = Number(
    props.getProperty('ADMIN_PASSPHRASE_ITER') || 2000
  );

  var hash = computeIteratedHash_(
    cleanPin,
    salt,
    pepper,
    iterations
  );

  props.setProperties({
    ADMIN_PIN_SALT: salt,
    ADMIN_PIN_HASH: hash
  });

  return true;
}

/**
 * Wajib membaca kedua properti sementara dan menghapus
 * keduanya tanpa pengecualian, termasuk ketika validasi gagal.
 */
function setupAdminCredentials() {
  var props = PropertiesService.getScriptProperties();

  var rawPassphrase = props.getProperty(
    'ADMIN_PASSPHRASE_INIT'
  );

  var rawPin = props.getProperty('ADMIN_PIN_INIT');

  try {
    if (
      !rawPassphrase &&
      !rawPin
    ) {
      throw new Error(
        'ADMIN_PASSPHRASE_INIT atau ADMIN_PIN_INIT wajib diisi.'
      );
    }

    var passphraseConfigured = false;
    var pinConfigured = false;

    if (rawPassphrase) {
      configureAdminPassphrase_(rawPassphrase);
      passphraseConfigured = true;
    }

    if (rawPin) {
      configureAdminPin_(rawPin);
      pinConfigured = true;
    }

    return {
      status: 'success',
      code: 'OK',
      data: {
        passphraseConfigured: passphraseConfigured,
        pinConfigured: pinConfigured
      },
      message: 'Kredensial admin berhasil dikonfigurasi.'
    };
  } finally {
    props.deleteProperty('ADMIN_PASSPHRASE_INIT');
    props.deleteProperty('ADMIN_PIN_INIT');
  }
}

function initialSetupDatabase() {
  var lock = LockService.getScriptLock();

  if (!lock.tryLock(10000)) {
    throw new Error('LOCK_TIMEOUT: Database sedang digunakan.');
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var props = PropertiesService.getScriptProperties();
    var tz = Session.getScriptTimeZone() || DEFAULT_TZ;

    ss.setSpreadsheetTimeZone(tz);

    if (!props.getProperty('AUTH_HMAC_SECRET')) {
      props.setProperty(
        'AUTH_HMAC_SECRET',
        generateRandomSecret_(43)
      );
    }

    if (!props.getProperty('AUTH_PEPPER')) {
      props.setProperty(
        'AUTH_PEPPER',
        generateRandomSecret_(43)
      );
    }

    var defaults = {
      ACCESS_PROFILE: ACCESS_PROFILE,
      SCHEMA_VERSION: SCHEMA_VERSION,
      SESSION_TTL_SECONDS: '7200',
      LOCKOUT_THRESHOLD: '5',
      LOCKOUT_DURATION_SEC: '900',
      MAX_UPLOAD_BYTES: '5242880',
      TRACK_FAIL_THRESHOLD: '5',
      TRACK_FAIL_TTL: '900',
      TRACK_GLOBAL_LIMIT: '30'
    };

    Object.keys(defaults).forEach(function(key) {
      if (!props.getProperty(key)) {
        props.setProperty(key, defaults[key]);
      }
    });

    Object.keys(DB_SCHEMAS).forEach(function(name) {
      var sheet = ss.getSheetByName(name);

      if (!sheet) {
        sheet = ss.insertSheet(name);
      }

      var expected = DB_SCHEMAS[name];

      if (sheet.getLastRow() === 0) {
        sheet.getRange(
          1,
          1,
          1,
          expected.length
        ).setValues([expected]);

        sheet.getRange(
          1,
          1,
          1,
          expected.length
        )
          .setFontWeight('bold')
          .setBackground('#E2E8F0');

        sheet.setFrozenRows(1);
      } else {
        var lastCol = sheet.getLastColumn();

        var current = sheet.getRange(
          1,
          1,
          1,
          lastCol
        ).getValues()[0].map(normalizeHeader_);

        expected.forEach(function(header) {
          if (current.indexOf(header) === -1) {
            lastCol++;

            sheet.getRange(1, lastCol)
              .setValue(header)
              .setFontWeight('bold')
              .setBackground('#E2E8F0');

            current.push(header);
          }
        });
      }
    });

    var catalog = ss.getSheetByName('CATALOG');

    if (
      catalog.getLastRow() <= 1 &&
      props.getProperty('SEED_INITIALIZED') !== 'TRUE'
    ) {
      var now = new Date();
      var nowIso = Utilities.formatDate(
        now,
        tz,
        "yyyy-MM-dd'T'HH:mm:ssXXX"
      );

      var seedData = [
        {
          package_name: 'Nasi Box Hemat',
          category: 'Nasi Box',
          description: 'Paket nasi box ekonomis.',
          menu_details: 'Nasi, ayam goreng, sayur, sambal, kerupuk.',
          price_amount: 25000,
          minimum_quantity: 10,
          sort_order: 1
        },
        {
          package_name: 'Nasi Box Komplit',
          category: 'Nasi Box',
          description: 'Paket nasi box lengkap.',
          menu_details: 'Nasi, ayam bakar, telur, sayur, sambal.',
          price_amount: 35000,
          minimum_quantity: 10,
          sort_order: 2
        },
        {
          package_name: 'Nasi Box Premium',
          category: 'Nasi Box',
          description: 'Paket nasi box premium.',
          menu_details: 'Nasi, ayam, daging, telur, sayur, buah.',
          price_amount: 50000,
          minimum_quantity: 10,
          sort_order: 3
        },
        {
          package_name: 'Snack Box Basic',
          category: 'Snack Box',
          description: 'Paket snack sederhana.',
          menu_details: '2 kue tradisional dan air mineral.',
          price_amount: 15000,
          minimum_quantity: 20,
          sort_order: 4
        },
        {
          package_name: 'Snack Box Premium',
          category: 'Snack Box',
          description: 'Paket snack pilihan.',
          menu_details: '3 kue pilihan dan minuman.',
          price_amount: 25000,
          minimum_quantity: 20,
          sort_order: 5
        },
        {
          package_name: 'Tumpeng Mini',
          category: 'Tumpeng',
          description: 'Tumpeng individual.',
          menu_details: 'Nasi kuning, ayam, telur, urap, perkedel.',
          price_amount: 45000,
          minimum_quantity: 10,
          sort_order: 6
        },
        {
          package_name: 'Tumpeng Sedang',
          category: 'Tumpeng',
          description: 'Tumpeng untuk acara keluarga.',
          menu_details: 'Nasi kuning dan lauk tradisional.',
          price_amount: 350000,
          minimum_quantity: 1,
          sort_order: 7
        },
        {
          package_name: 'Tumpeng Besar',
          category: 'Tumpeng',
          description: 'Tumpeng untuk acara besar.',
          menu_details: 'Nasi kuning, ayam, telur, perkedel, urap.',
          price_amount: 650000,
          minimum_quantity: 1,
          sort_order: 8
        },
        {
          package_name: 'Paket Prasmanan A',
          category: 'Prasmanan',
          description: 'Paket prasmanan standar.',
          menu_details: 'Nasi, ayam, sayur, sambal, kerupuk.',
          price_amount: 45000,
          minimum_quantity: 30,
          sort_order: 9
        },
        {
          package_name: 'Paket Prasmanan B',
          category: 'Prasmanan',
          description: 'Paket prasmanan lengkap.',
          menu_details: 'Nasi, ayam, daging, sayur, dessert.',
          price_amount: 65000,
          minimum_quantity: 30,
          sort_order: 10
        },
        {
          package_name: 'Paket Prasmanan C',
          category: 'Prasmanan',
          description: 'Paket prasmanan premium.',
          menu_details: 'Nasi, 2 lauk, sayur, dessert, minuman.',
          price_amount: 85000,
          minimum_quantity: 30,
          sort_order: 11
        },
        {
          package_name: 'Paket Rapat',
          category: 'Acara',
          description: 'Paket konsumsi rapat.',
          menu_details: 'Nasi box dan snack box.',
          price_amount: 40000,
          minimum_quantity: 15,
          sort_order: 12
        },
        {
          package_name: 'Paket Ulang Tahun',
          category: 'Acara',
          description: 'Paket konsumsi ulang tahun.',
          menu_details: 'Nasi box, snack dan minuman.',
          price_amount: 55000,
          minimum_quantity: 20,
          sort_order: 13
        },
        {
          package_name: 'Paket Arisan',
          category: 'Acara',
          description: 'Paket konsumsi arisan.',
          menu_details: 'Nasi, lauk, sayur dan dessert.',
          price_amount: 40000,
          minimum_quantity: 15,
          sort_order: 14
        },
        {
          package_name: 'Paket Keluarga',
          category: 'Keluarga',
          description: 'Paket makan bersama.',
          menu_details: 'Nasi, ayam, sayur dan lauk pendamping.',
          price_amount: 180000,
          minimum_quantity: 1,
          sort_order: 15
        },
        {
          package_name: 'Paket Spesial',
          category: 'Spesial',
          description: 'Paket menu pilihan DapurSaji.',
          menu_details: 'Menu pilihan sesuai ketersediaan.',
          price_amount: 100000,
          minimum_quantity: 5,
          sort_order: 16
        }
      ];

      var seedRows = [];

      seedData.forEach(function(item, index) {
        var obj = {
          package_id: 'SEED-PKG-' +
            ('0000' + (index + 1)).slice(-4),
          package_name: item.package_name,
          category: item.category,
          description: item.description,
          menu_details: item.menu_details,
          price_amount: item.price_amount,
          minimum_quantity: item.minimum_quantity,
          image_url: '',
          is_active: true,
          sort_order: item.sort_order,
          updated_at: nowIso,
          deleted_at: ''
        };

        seedRows.push(
          buildRowFromObject_(
            DB_SCHEMAS.CATALOG,
            obj
          )
        );
      });

      var activeHeaders = catalog.getRange(
        1,
        1,
        1,
        catalog.getLastColumn()
      ).getValues()[0];

      var mappedRows = seedData.map(function(item, index) {
        var obj = {
          package_id: 'SEED-PKG-' +
            ('0000' + (index + 1)).slice(-4),
          package_name: item.package_name,
          category: item.category,
          description: item.description,
          menu_details: item.menu_details,
          price_amount: item.price_amount,
          minimum_quantity: item.minimum_quantity,
          image_url: '',
          is_active: true,
          sort_order: item.sort_order,
          updated_at: nowIso,
          deleted_at: ''
        };

        return buildRowFromObject_(activeHeaders, obj);
      });

      catalog.getRange(
        2,
        1,
        mappedRows.length,
        activeHeaders.length
      ).setValues(mappedRows);

      props.setProperty('SEED_INITIALIZED', 'TRUE');
    }

    if (!props.getProperty('DRIVE_ROOT_FOLDER_ID')) {
      var folder = DriveApp.createFolder(
        'DapurSaji_Private_Uploads'
      );

      props.setProperty(
        'DRIVE_ROOT_FOLDER_ID',
        folder.getId()
      );
    }

    props.setProperty('SCHEMA_VERSION', SCHEMA_VERSION);

    SpreadsheetApp.flush();

    return {
      status: 'success',
      schemaVersion: SCHEMA_VERSION,
      seedCount: 16
    };
  } finally {
    lock.releaseLock();
  }
}

function setupAppEnvironment(fromClient) {
  if (fromClient !== undefined) {
    throw new Error(
      'Fungsi hanya boleh dijalankan dari Apps Script Editor.'
    );
  }

  var setup = initialSetupDatabase();
  var props = PropertiesService.getScriptProperties();

  var hasPass = Boolean(
    props.getProperty('ADMIN_PASSPHRASE_INIT')
  );

  var hasPin = Boolean(
    props.getProperty('ADMIN_PIN_INIT')
  );

  var credentialResult = 'SKIPPED';

  if (hasPass || hasPin) {
    setupAdminCredentials();
    credentialResult = 'CONFIGURED_AND_CLEANED';
  }

  var report = {
    status: 'PARTIAL_SETUP',
    schemaVersion: setup.schemaVersion,
    accessProfile: props.getProperty('ACCESS_PROFILE'),
    credentialsStep: credentialResult,
    checks: {
      hmacSecretReady: Boolean(
        props.getProperty('AUTH_HMAC_SECRET')
      ),
      pepperReady: Boolean(
        props.getProperty('AUTH_PEPPER')
      ),
      adminPassphraseReady: Boolean(
        props.getProperty('ADMIN_PASSPHRASE_HASH')
      ),
      adminPinReady: Boolean(
        props.getProperty('ADMIN_PIN_HASH')
      ),
      driveRootReady: Boolean(
        props.getProperty('DRIVE_ROOT_FOLDER_ID')
      )
    }
  };

  report.status =
    report.checks.hmacSecretReady &&
    report.checks.pepperReady &&
    report.checks.adminPassphraseReady &&
    report.checks.adminPinReady &&
    report.checks.driveRootReady
      ? 'READY_TO_DEPLOY'
      : 'PARTIAL_SETUP';

  console.log(JSON.stringify(report, null, 2));

  return report;
}

function setupAdminCredentialsFromUi(fromClient) {
  if (fromClient !== undefined) {
    throw new Error('Akses hanya melalui menu Spreadsheet.');
  }

  var ui = SpreadsheetApp.getUi();

  var passPrompt = ui.prompt(
    'DapurSaji - Admin',
    'Masukkan passphrase minimal 12 karakter.',
    ui.ButtonSet.OK_CANCEL
  );

  if (passPrompt.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  var pinPrompt = ui.prompt(
    'DapurSaji - PIN',
    'Masukkan PIN step-up 6 digit.',
    ui.ButtonSet.OK_CANCEL
  );

  if (pinPrompt.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  configureAdminPassphrase_(
    passPrompt.getResponseText()
  );

  configureAdminPin_(
    pinPrompt.getResponseText()
  );

  ui.alert('Kredensial admin berhasil disimpan.');
}

function runDiagnostics(fromClient) {
  if (fromClient !== undefined) {
    throw new Error('Hanya boleh dijalankan dari toolbar.');
  }

  var props = PropertiesService.getScriptProperties();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var checks = {};

  Object.keys(DB_SCHEMAS).forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    checks[name] = Boolean(sheet);

    if (sheet) {
      var headers = sheet.getRange(
        1,
        1,
        1,
        sheet.getLastColumn()
      ).getValues()[0].map(normalizeHeader_);

      DB_SCHEMAS[name].forEach(function(header) {
        if (headers.indexOf(header) === -1) {
          checks[name] = false;
        }
      });
    }
  });

  checks.AUTH_HMAC_SECRET = Boolean(
    props.getProperty('AUTH_HMAC_SECRET')
  );

  checks.AUTH_PEPPER = Boolean(
    props.getProperty('AUTH_PEPPER')
  );

  checks.ADMIN_PASSPHRASE_HASH = Boolean(
    props.getProperty('ADMIN_PASSPHRASE_HASH')
  );

  checks.ADMIN_PIN_HASH = Boolean(
    props.getProperty('ADMIN_PIN_HASH')
  );

  checks.DRIVE_ROOT_FOLDER_ID = Boolean(
    props.getProperty('DRIVE_ROOT_FOLDER_ID')
  );

  var report = {
    ok: Object.keys(checks).every(function(key) {
      return checks[key] === true;
    }),
    schemaVersion: SCHEMA_VERSION,
    accessProfile: props.getProperty('ACCESS_PROFILE'),
    checks: checks
  };

  console.log(JSON.stringify(report, null, 2));

  return report;
}

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('DapurSaji Setup')
      .addItem(
        '1. Setup Database',
        'setupAppEnvironment'
      )
      .addItem(
        '2. Atur Kredensial Admin',
        'setupAdminCredentialsFromUi'
      )
      .addItem(
        '3. Diagnostik',
        'runDiagnostics'
      )
      .addToUi();
  } catch (error) {
    console.error('Menu setup tidak tersedia.');
  }
}
