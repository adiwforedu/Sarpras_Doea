/**
 * ==============================================================================
 * SISARNA - SMAN 2 CIAMIS (Google Apps Script Backend Database Dinamis & Rapi)
 * ==============================================================================
 * Skrip ini menyediakan REST API (doGet & doPost) untuk mengelola data ke Google Sheets.
 * Seluruh tab di-format dengan header Bahasa Indonesia yang rapi dan mudah dibaca
 * langsung di Google Sheets maupun saat diunduh sebagai Excel (.xlsx) atau PDF.
 */

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'getAll';
  var collection = (e && e.parameter && e.parameter.collection) ? e.parameter.collection : null;
  
  try {
    if (action === 'getAll') {
      var allData = getAllDataFromSheets();
      return createJsonResponse({ status: 'success', data: allData });
    } else if (action === 'getCollection' && collection) {
      var collectionData = getCollectionData(collection);
      return createJsonResponse({ status: 'success', collection: collection, data: collectionData });
    } else {
      return createJsonResponse({ status: 'error', message: 'Aksi tidak dikenal: ' + action });
    }
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ status: 'error', message: 'Payload request kosong' });
    }
    
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    var collection = payload.collection;
    var docId = payload.docId;
    var data = payload.data;
    var isUpdate = payload.isUpdate || false;
    
    if (action === 'saveDoc') {
      var savedId = saveDocumentToSheet(collection, docId, data, isUpdate);
      return createJsonResponse({ status: 'success', action: action, collection: collection, id: savedId });
    } else if (action === 'deleteDoc') {
      deleteDocumentFromSheet(collection, docId);
      return createJsonResponse({ status: 'success', action: action, collection: collection, id: docId });
    } else if (action === 'saveSetting') {
      saveSettingToSheet(docId, data);
      return createJsonResponse({ status: 'success', action: action, key: docId });
    } else {
      return createJsonResponse({ status: 'error', message: 'Aksi POST tidak dikenal: ' + action });
    }
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

// --- Helper Database Sheets ---

function getOrCreateSheet(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    var headers = [];
    
    if (sheetName === 'events') {
      headers = ['ID', 'Nama Acara', 'Tanggal Mulai', 'Tanggal Selesai', 'Jam / Waktu', 'Fasilitas', 'Penyelenggara', 'Kontak (CP)', 'Kebutuhan Teknis', 'Jumlah Peserta', 'Nomor Surat', 'JSON_Data', 'Terakhir Diperbarui'];
    } else if (sheetName === 'vehicles') {
      headers = ['ID', 'Nama Kendaraan', 'Nomor Plat', 'Jenis', 'Status', 'Kilometer', 'Tgl Ganti Oli', 'Tgl Pajak', 'Tgl Plat/STNK', 'Catatan Perbaikan', 'JSON_Data', 'Terakhir Diperbarui'];
    } else if (sheetName === 'complaints') {
      headers = ['ID', 'Nama Pelapor', 'Jabatan / Role', 'Kontak', 'Lokasi Ruangan', 'Kategori', 'Deskripsi Masalah', 'Status Laporan', 'Tanggapan Admin', 'Tgl Dibuat', 'JSON_Data'];
    } else if (sheetName === 'consumables') {
      headers = ['ID', 'Nama Barang', 'Kategori', 'Stok Saat Ini', 'Stok Minimum', 'Satuan', 'Lokasi Gudang', 'JSON_Data', 'Terakhir Diperbarui'];
    } else if (sheetName === 'consumable_logs') {
      headers = ['ID', 'Tanggal Transaksi', 'Jenis Mutasi', 'Nama Barang', 'Jumlah Qty', 'Pengambil / Pemasok', 'Catatan / Keperluan', 'JSON_Data'];
    } else if (sheetName === 'facilities') {
      headers = ['No', 'Nama Fasilitas / Ruangan SMAN 2 Ciamis', 'Terakhir Diperbarui'];
    } else if (sheetName === 'settings') {
      headers = ['Key / Nama Setelan', 'JSON_Value', 'Terakhir Diperbarui'];
    } else {
      headers = ['ID', 'JSON_Data', 'Terakhir Diperbarui'];
    }

    sheet.appendRow(headers);
    
    // Format Header Rapi & Profesional
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold')
               .setFontColor('#ffffff')
               .setBackground('#1e3a8a')
               .setVerticalAlignment('middle');
    sheet.setRowHeight(1, 35);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getAllDataFromSheets() {
  return {
    events: getCollectionData('events'),
    vehicles: getCollectionData('vehicles'),
    complaints: getCollectionData('complaints'),
    consumables: getCollectionData('consumables'),
    consumable_logs: getCollectionData('consumable_logs'),
    facilities: getFacilitiesData(),
    settings: getSettingsData()
  };
}

function getCollectionData(collectionName) {
  var sheet = getOrCreateSheet(collectionName);
  var data = sheet.getDataRange().getValues();
  var result = [];
  
  if (data.length <= 1) return result;
  
  // Mencari indeks kolom JSON_Data
  var headers = data[0];
  var jsonColIndex = -1;
  for (var h = 0; h < headers.length; h++) {
    if (String(headers[h]).toUpperCase() === 'JSON_DATA') {
      jsonColIndex = h;
      break;
    }
  }
  if (jsonColIndex === -1) jsonColIndex = 1;

  for (var i = 1; i < data.length; i++) {
    var id = data[i][0];
    var jsonStr = data[i][jsonColIndex];
    if (jsonStr) {
      try {
        var itemObj = JSON.parse(jsonStr);
        if (!itemObj.id && id) itemObj.id = String(id);
        result.push(itemObj);
      } catch (err) {
        console.warn('Gagal parse JSON baris ' + (i+1) + ' di sheet ' + collectionName);
      }
    }
  }
  return result;
}

function saveDocumentToSheet(collectionName, docId, dataObj, isUpdate) {
  if (collectionName === 'settings') {
    saveSettingToSheet(docId, dataObj);
    return docId;
  }
  if (collectionName === 'facilities') {
    saveFacilitiesData(dataObj);
    return 'facilities';
  }

  var sheet = getOrCreateSheet(collectionName);
  var rows = sheet.getDataRange().getValues();
  var now = new Date().toISOString();
  
  var targetId = docId || (dataObj && dataObj.id) || String(Date.now());
  dataObj.id = targetId;
  var jsonStr = JSON.stringify(dataObj);
  
  var foundRowIndex = -1;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(targetId)) {
      foundRowIndex = i + 1; // 1-indexed
      break;
    }
  }
  
  var rowData = [];
  if (collectionName === 'events') {
    var facStr = Array.isArray(dataObj.facility) ? dataObj.facility.join(', ') : (dataObj.facility || '');
    rowData = [targetId, dataObj.title || '', dataObj.date || '', dataObj.endDate || '', dataObj.time || '', facStr, dataObj.organizer || '', dataObj.cp || '', dataObj.technical || '', dataObj.participants || '', dataObj.nomorSurat || '', jsonStr, now];
  } else if (collectionName === 'vehicles') {
    rowData = [targetId, dataObj.name || '', dataObj.plate || '', dataObj.type || '', dataObj.status || '', dataObj.km || 0, dataObj.lastOilDate || '', dataObj.taxDate || '', dataObj.plateDate || '', dataObj.notes || '', jsonStr, now];
  } else if (collectionName === 'complaints') {
    rowData = [targetId, dataObj.reporter || '', dataObj.role || '', dataObj.contact || '', dataObj.location || '', dataObj.category || '', dataObj.desc || '', dataObj.status || '', dataObj.response || '', dataObj.createdAt || now, jsonStr];
  } else if (collectionName === 'consumables') {
    rowData = [targetId, dataObj.name || '', dataObj.category || '', dataObj.stock || 0, dataObj.minStock || 0, dataObj.unit || '', dataObj.location || '', jsonStr, now];
  } else if (collectionName === 'consumable_logs') {
    rowData = [targetId, dataObj.date || '', dataObj.type || '', dataObj.itemName || '', dataObj.quantity || 0, dataObj.actor || '', dataObj.notes || '', jsonStr];
  } else {
    rowData = [targetId, jsonStr, now];
  }

  if (foundRowIndex > 0) {
    sheet.getRange(foundRowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
  return targetId;
}

function deleteDocumentFromSheet(collectionName, docId) {
  var sheet = getOrCreateSheet(collectionName);
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(docId)) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}

function getFacilitiesData() {
  var sheet = getOrCreateSheet('facilities');
  var rows = sheet.getDataRange().getValues();
  var list = [];
  if (rows.length > 1) {
    for (var i = 1; i < rows.length; i++) {
      var val = rows[i][1]; // Kolom ke-2 adalah Nama Fasilitas
      if (!val) val = rows[i][0];
      if (val && String(val).trim() !== '' && String(val).toUpperCase() !== 'NO') {
        list.push(String(val).trim());
      }
    }
  }
  if (list.length === 0) {
    var settings = getSettingsData();
    if (settings && Array.isArray(settings.facilities)) {
      return settings.facilities;
    }
  }
  return list;
}

function saveFacilitiesData(dataObj) {
  var sheet = getOrCreateSheet('facilities');
  var list = Array.isArray(dataObj) ? dataObj : (dataObj.list || []);
  
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 3).clearContent();
  }
  
  var now = new Date().toISOString();
  var newRows = [];
  for (var i = 0; i < list.length; i++) {
    newRows.push([i + 1, list[i], now]);
  }
  if (newRows.length > 0) {
    sheet.getRange(2, 1, newRows.length, 3).setValues(newRows);
  }
  
  saveSettingToSheet('facilities', list);
}

function getSettingsData() {
  var sheet = getOrCreateSheet('settings');
  var rows = sheet.getDataRange().getValues();
  var settings = {};
  if (rows.length > 1) {
    for (var i = 1; i < rows.length; i++) {
      var key = rows[i][0];
      var jsonVal = rows[i][1];
      if (key && jsonVal) {
        try {
          settings[key] = JSON.parse(jsonVal);
        } catch (err) {
          settings[key] = jsonVal;
        }
      }
    }
  }
  return settings;
}

function saveSettingToSheet(key, valObj) {
  var sheet = getOrCreateSheet('settings');
  var rows = sheet.getDataRange().getValues();
  var now = new Date().toISOString();
  var jsonStr = (typeof valObj === 'string') ? valObj : JSON.stringify(valObj);
  
  var foundRowIndex = -1;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(key)) {
      foundRowIndex = i + 1;
      break;
    }
  }
  
  if (foundRowIndex > 0) {
    sheet.getRange(foundRowIndex, 2).setValue(jsonStr);
    sheet.getRange(foundRowIndex, 3).setValue(now);
  } else {
    sheet.appendRow([key, jsonStr, now]);
  }
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
