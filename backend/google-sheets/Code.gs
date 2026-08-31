/**
 * ========================================================================================
 * 1625 AUTOLAB - GOOGLE SHEETS BIDIRECTIONAL LIVE SYNC SCRIPT
 * ========================================================================================
 * Version: 2.1.1 (Row 7 Headers & Row 8 Data Start - Bidirectional Two-Way Sync)
 *
 * This Google Apps Script powers real-time two-way synchronization between your Google
 * Spreadsheet ('Sales' sheet, Header Row 7, Data starting on Row 8) and Apollo:
 *
 *  1. [Apollo -> Google Sheets]
 *     When a customer books or an admin updates an inquiry on the website,
 *     Apollo sends a webhook POST to this script. This script updates or appends
 *     the row starting at Row 8.
 *
 *  2. [Google Sheets -> Apollo]
 *     When staff/admin edits any cell on Row 8 or below (Status, Date, Time, Name, etc.),
 *     the installable onEdit trigger instantly sends the updated row back to Apollo.
 *
 *  3. [One-Click Bulk Sync]
 *     Use the custom menu "🏎️ 1625 AutoLab" in Google Sheets to push all rows, pull all rows,
 *     or install the automatic trigger.
 * ========================================================================================
 */

// ----------------------------------------------------------------------------------------
// CONFIGURATION
// ----------------------------------------------------------------------------------------
var CONFIG = {
  // Your website's inbound webhook URL
  DEFAULT_API_URL: 'https://api.1625autolab.com/api/integrations/google-sheets/inbound',
  // Your Webhook Secret Key
  DEFAULT_SECRET: '3213e76c579444693434',
  // Target Sheet Name
  SHEET_NAME: 'Sales',
  // Header Row (Headers are on Row 7, data begins on Row 8)
  HEADER_ROW: 7,
};

// 18 Standard Column definitions matching your 'Sales' sheet order:
var COLUMNS = [
  'Timestamp',           // Col 1 (A)
  'Reference Number',   // Col 2 (B)
  'Inquiry ID',         // Col 3 (C)
  'Full Name',          // Col 4 (D)
  'Email address',      // Col 5 (E)
  'Address',            // Col 6 (F)
  'Contact Number',     // Col 7 (G)
  'Facebook Name',      // Col 8 (H)
  'Car Make',           // Col 9 (I)
  'Car Model',          // Col 10 (J)
  'Year Model',         // Col 11 (K)
  'Service Name',       // Col 12 (L)
  'Product to Purchase',// Col 13 (M)
  'Plate Number',       // Col 14 (N)
  'Appointment Date',   // Col 15 (O)
  'Appointment Time',   // Col 16 (P)
  'Status',             // Col 17 (Q)
  'Last Updated',       // Col 18 (R)
  'Sync Status'         // Col 19 (S) - Live sync status
];

// ----------------------------------------------------------------------------------------
// SCRIPT PROPERTIES (Storage for Website URL & Secret Key)
// ----------------------------------------------------------------------------------------
function getProperty(key, fallback) {
  var props = PropertiesService.getScriptProperties();
  var val = props.getProperty(key);
  return val ? val : fallback;
}

function setProperty(key, val) {
  PropertiesService.getScriptProperties().setProperty(key, val);
}

function getApiUrl() {
  return getProperty('APOLLO_API_URL', CONFIG.DEFAULT_API_URL);
}

function getWebhookSecret() {
  return getProperty('APOLLO_SECRET', CONFIG.DEFAULT_SECRET);
}

function initialSetup() {
  var activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty('key', activeSpreadsheet.getId());
}

// ----------------------------------------------------------------------------------------
// WEBHOOK INBOUND: Handles HTTP POST from Apollo (Apollo -> Sheets)
// ----------------------------------------------------------------------------------------
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Lock timeout. Another sync is currently in progress.'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    var rawPostData = e && e.postData ? e.postData.contents : '';
    var data = {};

    if (rawPostData) {
      try {
        data = JSON.parse(rawPostData);
      } catch (parseErr) {
        data = (e && e.parameter) ? e.parameter : {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    // Handle bulk sync payload { action: 'sync_all', rows: [...] }
    if (data.action === 'sync_all' && Array.isArray(data.rows)) {
      var syncResult = bulkSyncRowsFromApollo(data.rows);
      return ContentService.createTextOutput(JSON.stringify(syncResult))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Single inquiry sync
    var result = upsertInquiryRow(data, true);
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// ----------------------------------------------------------------------------------------
// WEBHOOK READ: Handles HTTP GET from Apollo (Apollo pulling all Sheet rows)
// ----------------------------------------------------------------------------------------
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'get_all';

  if (action === 'ping') {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      scriptName: '1625 AutoLab Live Sync (Row 8 Start)'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'get_all') {
    try {
      var sheet = getOrCreateTargetSheet();
      var rows = getAllInquiryObjects(sheet);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        count: rows.length,
        data: rows,
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: '1625 AutoLab Google Sheets Sync Webhook is active (Row 7 Headers, Row 8 Data Start).'
  })).setMimeType(ContentService.MimeType.JSON);
}

// ----------------------------------------------------------------------------------------
// REAL-TIME EDIT TRIGGER: Handles user edits in Google Sheets (Sheets -> Apollo)
// ----------------------------------------------------------------------------------------
function installedOnEdit(e) {
  if (!e || !e.range) return;

  var sheet = e.range.getSheet();
  var sheetName = sheet.getName();
  var targetSheet = getOrCreateTargetSheet();

  if (sheetName !== targetSheet.getName()) {
    return; // Edit was on another sheet tab
  }

  var headerRow = CONFIG.HEADER_ROW || 7;
  var startDataRow = headerRow + 1; // Row 8

  var row = e.range.getRow();
  if (row < startDataRow) {
    return; // Headers or top title rows (Row 1 to 7) were edited - ignore
  }

  // Prevent sync loops if the update was triggered programmatically by doPost
  var cache = CacheService.getScriptCache();
  if (cache.get('SUPPRESS_ON_EDIT_' + row) === 'true') {
    return;
  }

  // Sync this single edited row to Apollo
  syncSingleRowToApollo(sheet, row);
}

/**
 * Normalizes and sends a single row from Google Sheets to Apollo API
 */
function syncSingleRowToApollo(sheet, rowNumber) {
  var apiUrl = getApiUrl();
  var secret = getWebhookSecret();

  if (!apiUrl) {
    showToast('⚠️ Website Webhook URL is not set. Go to "🏎️ 1625 AutoLab" menu > "⚙️ Configure".', 'Setup Needed', 8);
    return { success: false, error: 'API URL not configured' };
  }

  var rowData = getRowDataObject(sheet, rowNumber);

  // If row has no full name and no reference number, skip syncing
  if (!rowData.fullName && !rowData.referenceNumber) {
    return { success: false, error: 'Row is empty' };
  }

  try {
    var payload = JSON.stringify({
      source: 'google_sheets',
      rowNumber: rowNumber,
      timestamp: new Date().toISOString(),
      ...rowData
    });

    var options = {
      method: 'post',
      contentType: 'application/json',
      payload: payload,
      muteHttpExceptions: true,
      headers: {
        'X-Sheets-Secret': secret,
        'Accept': 'application/json'
      }
    };

    var response = UrlFetchApp.fetch(apiUrl, options);
    var responseCode = response.getResponseCode();
    var responseBody = response.getContentText();
    var result = {};

    try {
      result = JSON.parse(responseBody);
    } catch (parseErr) {
      result = { raw: responseBody };
    }

    var colMap = getColumnMap(sheet);
    var nowFormatted = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

    if (responseCode >= 200 && responseCode < 300 && result.success !== false) {
      // Update Sync Status and Last Updated in the sheet
      if (colMap['Sync Status']) {
        sheet.getRange(rowNumber, colMap['Sync Status']).setValue('✅ Synced (' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm:ss') + ')');
      }
      if (colMap['Last Updated']) {
        sheet.getRange(rowNumber, colMap['Last Updated']).setValue(nowFormatted);
      }
      // If Apollo generated a Reference Number or ID, write it to sheet
      if (result.inquiry && result.inquiry.referenceNumber && colMap['Reference Number']) {
        sheet.getRange(rowNumber, colMap['Reference Number']).setValue(result.inquiry.referenceNumber);
      }
      if (result.inquiry && result.inquiry.id && colMap['Inquiry ID']) {
        sheet.getRange(rowNumber, colMap['Inquiry ID']).setValue(result.inquiry.id);
      }

      return { success: true, response: result };
    } else {
      var errMsg = result.error || ('HTTP ' + responseCode);
      if (colMap['Sync Status']) {
        sheet.getRange(rowNumber, colMap['Sync Status']).setValue('❌ Error: ' + errMsg);
      }
      return { success: false, error: errMsg };
    }
  } catch (err) {
    var colMapErr = getColumnMap(sheet);
    if (colMapErr['Sync Status']) {
      sheet.getRange(rowNumber, colMapErr['Sync Status']).setValue('❌ ' + err.message);
    }
    return { success: false, error: err.message };
  }
}

// ----------------------------------------------------------------------------------------
// ROW UPSERT LOGIC (Apollo -> Sheets) - Starts on Row 8
// ----------------------------------------------------------------------------------------
function upsertInquiryRow(inquiry, isFromApi) {
  var sheet = getOrCreateTargetSheet();
  var colMap = getColumnMap(sheet);

  var headerRow = CONFIG.HEADER_ROW || 7;
  var startDataRow = headerRow + 1; // Row 8

  var refNum = String(inquiry.referenceNumber || inquiry.reference_number || inquiry['Reference Number'] || inquiry.inquiryId || inquiry['Inquiry ID'] || inquiry.id || '').trim();
  var inqId = String(inquiry.id || inquiry.inquiryId || inquiry.inquiry_id || inquiry['Inquiry ID'] || '').trim();
  var targetEmail = String(inquiry.emailAddress || inquiry.email_address || inquiry['Email address'] || '').toLowerCase().trim();
  var targetPhone = String(inquiry.contactNumber || inquiry.contact_number || inquiry['Contact Number'] || '').toLowerCase().trim();

  var lastRow = sheet.getLastRow();
  var targetRow = -1;

  // Search existing data rows (starting at Row 8)
  if (lastRow >= startDataRow) {
    var numRows = lastRow - headerRow;
    var dataRange = sheet.getRange(startDataRow, 1, numRows, sheet.getLastColumn());
    var values = dataRange.getValues();

    var refColIdx = colMap['Reference Number'] ? colMap['Reference Number'] - 1 : 1; // Col 2 (B)
    var idColIdx = colMap['Inquiry ID'] ? colMap['Inquiry ID'] - 1 : 2;             // Col 3 (C)
    var emailColIdx = colMap['Email address'] ? colMap['Email address'] - 1 : 4;   // Col 5 (E)
    var phoneColIdx = colMap['Contact Number'] ? colMap['Contact Number'] - 1 : 6; // Col 7 (G)

    for (var i = 0; i < values.length; i++) {
      var rowRef = String(values[i][refColIdx] || '').toLowerCase().trim();
      var rowId = String(values[i][idColIdx] || '').toLowerCase().trim();
      var rowEmail = String(values[i][emailColIdx] || '').toLowerCase().trim();
      var rowPhone = String(values[i][phoneColIdx] || '').toLowerCase().trim();
      var rowText = values[i].join(' ').toLowerCase();

      // 1. Primary match: Reference Number or Inquiry ID
      if (refNum && (rowRef === refNum.toLowerCase() || rowId === refNum.toLowerCase() || rowText.includes(refNum.toLowerCase()))) {
        targetRow = startDataRow + i;
        break;
      }

      // 2. Secondary match: Email + Contact Number
      if (targetEmail && rowEmail === targetEmail && targetPhone && rowPhone === targetPhone) {
        targetRow = startDataRow + i;
        break;
      }
    }
  }

  var isNewRow = (targetRow === -1);
  if (isNewRow) {
    // Insert at the top (right below headers at Row 8), pushing existing data down
    sheet.insertRowBefore(startDataRow);
    targetRow = startDataRow;
  }

  // Set suppression flag in cache to prevent onEdit trigger echo loop
  if (isFromApi) {
    CacheService.getScriptCache().put('SUPPRESS_ON_EDIT_' + targetRow, 'true', 30);
  }

  // Extract standardized values
  var now = new Date();
  var valCreated = inquiry.timestamp || inquiry['Timestamp'] || inquiry.createdAt || inquiry.created_at || Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  var valRef = refNum;
  var valId = inqId;
  var valName = String(inquiry.fullName || inquiry.full_name || inquiry['Full Name'] || inquiry.customerName || '').trim();
  var valEmail = String(inquiry.emailAddress || inquiry.email_address || inquiry['Email address'] || inquiry['Email Address'] || '').trim();
  var valAddr = String(inquiry.address || inquiry.Address || '').trim();
  var valPhone = String(inquiry.contactNumber || inquiry.contact_number || inquiry['Contact Number'] || inquiry.phone || '').trim();
  var valFb = String(inquiry.facebookName || inquiry.facebook_name || inquiry['Facebook Name'] || '').trim();
  var valMake = String(inquiry.make || inquiry.carMake || inquiry['Car Make'] || '').trim();
  var valModel = String(inquiry.model || inquiry.carModel || inquiry['Car Model'] || '').trim();
  var valYear = String(inquiry.yearModel || inquiry.year_model || inquiry['Year Model'] || inquiry.year || '').trim();
  var valService = String(inquiry.serviceName || inquiry.service_name || inquiry['Service Name'] || inquiry.service || '').trim();
  var valProduct = String(inquiry.productToPurchase || inquiry.product_to_purchase || inquiry['Product to Purchase'] || '').trim();
  var valPlate = String(inquiry.plateNumber || inquiry.plate_number || inquiry['Plate Number'] || '').trim();
  var valDate = String(inquiry.appointmentDate || inquiry.appointment_date || inquiry['Appointment Date'] || '').trim();
  var valTime = String(inquiry.appointmentTime || inquiry.appointment_time || inquiry['Appointment Time'] || '').trim();
  var valStatus = String(inquiry.status || inquiry.Status || 'pending').toLowerCase().trim();
  var valUpdated = inquiry.lastUpdated || inquiry['Last Updated'] || Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  var valSync = '✅ Synced (Apollo)';

  var rowArray = [];
  for (var c = 0; c < COLUMNS.length; c++) {
    var header = COLUMNS[c];
    switch (header) {
      case 'Timestamp': rowArray.push(valCreated); break;
      case 'Reference Number': rowArray.push(valRef); break;
      case 'Inquiry ID': rowArray.push(valId); break;
      case 'Full Name': rowArray.push(valName); break;
      case 'Email address': rowArray.push(valEmail); break;
      case 'Address': rowArray.push(valAddr); break;
      case 'Contact Number': rowArray.push(valPhone); break;
      case 'Facebook Name': rowArray.push(valFb); break;
      case 'Car Make': rowArray.push(valMake); break;
      case 'Car Model': rowArray.push(valModel); break;
      case 'Year Model': rowArray.push(valYear); break;
      case 'Service Name': rowArray.push(valService); break;
      case 'Product to Purchase': rowArray.push(valProduct); break;
      case 'Plate Number': rowArray.push(valPlate); break;
      case 'Appointment Date': rowArray.push(valDate); break;
      case 'Appointment Time': rowArray.push(valTime); break;
      case 'Status': rowArray.push(valStatus); break;
      case 'Last Updated': rowArray.push(valUpdated); break;
      case 'Sync Status': rowArray.push(valSync); break;
      default: rowArray.push(''); break;
    }
  }

  sheet.getRange(targetRow, 1, 1, rowArray.length).setValues([rowArray]);

  // Apply row formatting
  applyRowStyles(sheet, targetRow, valStatus);

  return {
    success: true,
    action: isNewRow ? 'created' : 'updated',
    row: targetRow,
    rowNumber: targetRow,
    ref: valRef,
    referenceNumber: valRef,
    inquiryId: valId
  };
}

/**
 * Bulk sync an array of inquiries from Apollo into Google Sheets starting on Row 8
 */
function bulkSyncRowsFromApollo(rows) {
  var sheet = getOrCreateTargetSheet();
  var count = 0;
  for (var i = 0; i < rows.length; i++) {
    upsertInquiryRow(rows[i], true);
    count++;
  }
  return {
    success: true,
    processedCount: count
  };
}

// ----------------------------------------------------------------------------------------
// DATA EXTRACTION (Reading Sheet Rows -> Apollo Inquiries)
// ----------------------------------------------------------------------------------------
function getRowDataObject(sheet, rowNumber) {
  var colMap = getColumnMap(sheet);
  var numCols = sheet.getLastColumn();
  if (numCols < 1) return {};

  var rowValues = sheet.getRange(rowNumber, 1, 1, numCols).getValues()[0];

  function getVal(colName, fallbackColIdx) {
    var colIdx = colMap[colName] || fallbackColIdx;
    if (colIdx && colIdx <= rowValues.length) {
      var v = rowValues[colIdx - 1];
      if (v instanceof Date) {
        return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }
      return (v === null || v === undefined) ? '' : String(v).trim();
    }
    return '';
  }

  return {
    timestamp: getVal('Timestamp', 1),
    referenceNumber: getVal('Reference Number', 2),
    id: getVal('Inquiry ID', 3),
    inquiryId: getVal('Inquiry ID', 3),
    fullName: getVal('Full Name', 4),
    emailAddress: getVal('Email address', 5) || getVal('Email Address', 5),
    address: getVal('Address', 6),
    contactNumber: getVal('Contact Number', 7),
    facebookName: getVal('Facebook Name', 8),
    make: getVal('Car Make', 9) || getVal('Make', 9),
    model: getVal('Car Model', 10) || getVal('Model', 10),
    yearModel: getVal('Year Model', 11) || getVal('Year', 11),
    serviceName: getVal('Service Name', 12) || getVal('Service', 12),
    productToPurchase: getVal('Product to Purchase', 13) || getVal('Product', 13),
    plateNumber: getVal('Plate Number', 14) || getVal('Plate', 14),
    appointmentDate: getVal('Appointment Date', 15),
    appointmentTime: getVal('Appointment Time', 16),
    status: getVal('Status', 17),
    lastUpdated: getVal('Last Updated', 18)
  };
}

function getAllInquiryObjects(sheet) {
  var headerRow = CONFIG.HEADER_ROW || 7;
  var startDataRow = headerRow + 1; // Row 8
  var lastRow = sheet.getLastRow();
  if (lastRow < startDataRow) return [];

  var result = [];
  for (var r = startDataRow; r <= lastRow; r++) {
    var obj = getRowDataObject(sheet, r);
    if (obj.fullName || obj.referenceNumber) {
      result.push(obj);
    }
  }
  return result;
}

// ----------------------------------------------------------------------------------------
// SHEET STRUCTURE & FORMATTING HELPERS
// ----------------------------------------------------------------------------------------
function getOrCreateTargetSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.getActiveSheet();
  }
  return sheet;
}

function getColumnMap(sheet) {
  var headerRow = CONFIG.HEADER_ROW || 7;
  var lastCol = sheet.getLastColumn();
  var map = {};
  if (lastCol < 1) return map;

  var headers = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i]).trim();
    if (h) {
      map[h] = i + 1; // 1-based index
    }
  }
  return map;
}

function setupSheetHeaders(sheet) {
  if (!sheet) {
    sheet = getOrCreateTargetSheet();
  }

  var headerRow = CONFIG.HEADER_ROW || 7;
  sheet.getRange(headerRow, 1, 1, COLUMNS.length).setValues([COLUMNS]);

  // Header Styling (1625 AutoLab Dark / Orange Theme)
  var headerRange = sheet.getRange(headerRow, 1, 1, COLUMNS.length);
  headerRange.setBackground('#18181b');
  headerRange.setFontColor('#f97316');
  headerRange.setFontWeight('bold');
  headerRange.setFontFamily('Consolas');
  headerRange.setFontSize(10);
  headerRange.setHorizontalAlignment('center');
  headerRange.setVerticalAlignment('middle');
  sheet.setRowHeight(headerRow, 36);

  // Status column dropdown validation on Row 8+
  var statusColIdx = COLUMNS.indexOf('Status') + 1;
  if (statusColIdx > 0) {
    var statusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'], true)
      .setAllowInvalid(true)
      .build();
    sheet.getRange(headerRow + 1, statusColIdx, 500, 1).setDataValidation(statusRule);
  }
}

function applyRowStyles(sheet, rowNumber, status) {
  var range = sheet.getRange(rowNumber, 1, 1, COLUMNS.length);
  range.setFontFamily('Inter');
  range.setFontSize(10);
  range.setVerticalAlignment('middle');

  var colMap = getColumnMap(sheet);
  var statusCol = colMap['Status'] || 17;
  if (statusCol) {
    var statusCell = sheet.getRange(rowNumber, statusCol);
    var st = String(status).toLowerCase();
    if (st === 'confirmed') {
      statusCell.setBackground('#dcfce7').setFontColor('#166534').setFontWeight('bold');
    } else if (st === 'in_progress') {
      statusCell.setBackground('#fef3c7').setFontColor('#92400e').setFontWeight('bold');
    } else if (st === 'completed') {
      statusCell.setBackground('#e0e7ff').setFontColor('#3730a3').setFontWeight('bold');
    } else if (st === 'cancelled') {
      statusCell.setBackground('#fee2e2').setFontColor('#991b1b').setFontWeight('bold');
    } else {
      statusCell.setBackground('#fef9c3').setFontColor('#854d0e').setFontWeight('bold');
    }
  }
}

// ----------------------------------------------------------------------------------------
// CUSTOM MENU & USER ACTIONS
// ----------------------------------------------------------------------------------------
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('🏎️ 1625 AutoLab')
    .addItem('⚡ Sync Selected Row to Website', 'menuSyncSelectedRow')
    .addItem('🔄 Sync ALL Rows to Website', 'menuSyncAllRows')
    .addSeparator()
    .addItem('📥 Pull All Inquiries from Website', 'menuPullAllFromWebsite')
    .addSeparator()
    .addItem('🛠️ Enable Real-Time Auto-Sync (Install Trigger)', 'installEditTrigger')
    .addItem('📋 Format Headers & Columns (Row 7)', 'menuFormatHeaders')
    .addItem('⚙️ Configure Website URL & Secret', 'menuConfigureSettings')
    .addToUi();
}

function menuSyncSelectedRow() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var row = sheet.getActiveCell().getRow();
  var headerRow = CONFIG.HEADER_ROW || 7;
  var startDataRow = headerRow + 1; // Row 8

  if (row < startDataRow) {
    SpreadsheetApp.getUi().alert('Please select a data row (Row 8 or below) to sync.');
    return;
  }

  showToast('Syncing row ' + row + ' to Apollo website...', 'Syncing', 4);
  var res = syncSingleRowToApollo(sheet, row);
  if (res.success) {
    SpreadsheetApp.getUi().alert('✅ Success! Row ' + row + ' has been synchronized to the website.');
  } else {
    SpreadsheetApp.getUi().alert('❌ Sync Failed:\n' + res.error);
  }
}

function menuSyncAllRows() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.alert('Confirm Sync All', 'Do you want to send all rows from this spreadsheet (starting at Row 8) to the website?', ui.ButtonSet.YES_NO);
  if (response !== ui.Button.YES) return;

  var sheet = getOrCreateTargetSheet();
  var headerRow = CONFIG.HEADER_ROW || 7;
  var startDataRow = headerRow + 1; // Row 8
  var lastRow = sheet.getLastRow();

  if (lastRow < startDataRow) {
    ui.alert('No inquiry rows found starting at Row 8.');
    return;
  }

  var successCount = 0;
  var failCount = 0;

  for (var r = startDataRow; r <= lastRow; r++) {
    var res = syncSingleRowToApollo(sheet, r);
    if (res.success) {
      successCount++;
    } else {
      failCount++;
    }
    Utilities.sleep(150); // Avoid rate limits
  }

  ui.alert('Sync Completed!\n\n✅ Successfully Synced: ' + successCount + '\n❌ Failed: ' + failCount);
}

function menuPullAllFromWebsite() {
  var ui = SpreadsheetApp.getUi();
  var apiUrl = getApiUrl();
  var secret = getWebhookSecret();

  if (!apiUrl) {
    ui.alert('⚠️ Website URL is not configured. Please use "🏎️ 1625 AutoLab" > "⚙️ Configure".');
    return;
  }

  var pullUrl = apiUrl.replace(/\/inbound$/, '/all-inquiries');

  showToast('Fetching latest inquiries from website...', 'Pulling Data', 5);

  try {
    var options = {
      method: 'get',
      headers: {
        'X-Sheets-Secret': secret,
        'Accept': 'application/json'
      },
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(pullUrl, options);
    var data = JSON.parse(response.getContentText());

    if (data.inquiries && Array.isArray(data.inquiries)) {
      bulkSyncRowsFromApollo(data.inquiries);
      ui.alert('✅ Success! Pulled and updated ' + data.inquiries.length + ' inquiries from website into Row 8+.');
    } else {
      ui.alert('⚠️ Received response:\n' + response.getContentText().substring(0, 300));
    }
  } catch (e) {
    ui.alert('❌ Error pulling from website:\n' + e.message);
  }
}

function menuFormatHeaders() {
  setupSheetHeaders(getOrCreateTargetSheet());
  SpreadsheetApp.getUi().alert('✅ Sheet headers on Row 7 and status validations for Row 8+ have been formatted.');
}

function menuConfigureSettings() {
  var ui = SpreadsheetApp.getUi();
  var currentUrl = getApiUrl();
  var currentSecret = getWebhookSecret();

  var urlPrompt = ui.prompt(
    'Step 1: Website Inbound Webhook URL',
    'Enter your Apollo Inbound Webhook URL (from Admin Settings > Google Sheets):\n\nCurrent: ' + (currentUrl || '(not set)'),
    ui.ButtonSet.OK_CANCEL
  );

  if (urlPrompt.getSelectedButton() !== ui.Button.OK) return;
  var newUrl = urlPrompt.getResponseText().trim();
  if (newUrl) {
    setProperty('APOLLO_API_URL', newUrl);
  }

  var secretPrompt = ui.prompt(
    'Step 2: Webhook Secret Key',
    'Enter your Webhook Secret Key (from Admin Settings > Google Sheets):\n\nCurrent: ' + (currentSecret || '(not set)'),
    ui.ButtonSet.OK_CANCEL
  );

  if (secretPrompt.getSelectedButton() !== ui.Button.OK) return;
  var newSecret = secretPrompt.getResponseText().trim();
  if (newSecret) {
    setProperty('APOLLO_SECRET', newSecret);
  }

  ui.alert('✅ Settings saved successfully!\n\nURL: ' + (newUrl || currentUrl) + '\nSecret: ' + (newSecret ? '********' : '(not set)'));
}

/**
 * Installs the installable onEdit trigger so edits in Google Sheets can make UrlFetchApp HTTP requests
 */
function installEditTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'installedOnEdit') {
      SpreadsheetApp.getUi().alert('ℹ️ Auto-Sync Trigger is ALREADY installed and active!\n\nAny cell you edit on Row 8+ will automatically sync to your website.');
      return;
    }
  }

  ScriptApp.newTrigger('installedOnEdit')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();

  SpreadsheetApp.getUi().alert('🎉 Auto-Sync on Edit is now ENABLED!\n\nWhenever you or your staff change any cell on Row 8+, it will automatically update on the website.');
}

function showToast(msg, title, timeoutSec) {
  SpreadsheetApp.getActiveSpreadsheet().toast(msg, title || '1625 AutoLab', timeoutSec || 4);
}
