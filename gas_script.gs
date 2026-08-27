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
  
  var headers = data[0];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var id = row[0];
    if (!id && !row[1]) continue;

    // Pemindai Multi-Kolom: Cari string JSON di semua kolom pada baris tersebut
    var parsedObject = null;
    for (var c = 0; c < row.length; c++) {
      var cellVal = String(row[c] || '').trim();
      if (cellVal.indexOf('{') === 0 && cellVal.lastIndexOf('}') === cellVal.length - 1) {
        try {
          var testJson = JSON.parse(cellVal);
          if (testJson && typeof testJson === 'object' && (testJson.title || testJson.name || testJson.id || testJson.reporter)) {
            parsedObject = testJson;
            if (!parsedObject.id && id) parsedObject.id = String(id);
            break;
          }
        } catch (e) {}
      }
    }

    if (parsedObject) {
      // Perbaikan Fallback: Memastikan properti complaints tidak bernilai undefined / kosong
      if (collectionName === 'complaints') {
        if (!parsedObject.reporter) parsedObject.reporter = String(row[1] || 'Warga Sekolah');
        if (!parsedObject.role) parsedObject.role = String(row[2] || 'Siswa');
        if (!parsedObject.contact && row[3]) parsedObject.contact = String(row[3]);
        if (!parsedObject.location) parsedObject.location = String(row[4] || '-');
        if (!parsedObject.category) parsedObject.category = String(row[5] || 'Lainnya');
        if (!parsedObject.desc) parsedObject.desc = String(row[6] || '-');
        if (!parsedObject.status) parsedObject.status = String(row[7] || 'Pending');
        if (!parsedObject.response && row[8]) parsedObject.response = String(row[8]);
      }
      result.push(parsedObject);
    } else {
      // Fallback jika tidak ada string JSON di baris tersebut
      var fallback = buildObjectFromRowColumns(collectionName, row, headers);
      if (fallback) result.push(fallback);
    }
  }
  return result;
}

function buildObjectFromRowColumns(collectionName, row, headers) {
  if (!row[0] && !row[1]) return null;
  var idStr = row[0] ? String(row[0]) : ('row_' + Date.now() + Math.random().toString(36).substr(2, 5));
  var obj = { id: idStr };

  if (collectionName === 'events') {
    var rawTitle = String(row[1] || '').trim();
    if (rawTitle.indexOf('{') === 0 && rawTitle.lastIndexOf('}') === rawTitle.length - 1) {
      try {
        var parsedJson = JSON.parse(rawTitle);
        if (parsedJson && typeof parsedJson === 'object') {
          if (!parsedJson.id && row[0]) parsedJson.id = String(row[0]);
          return parsedJson;
        }
      } catch(e) {}
    }

    obj.title = rawTitle || 'Acara Tanpa Judul';

    // Map fields by header names if headers present
    var colMap = {};
    if (headers && headers.length > 0) {
      for (var h = 0; h < headers.length; h++) {
        var headerStr = String(headers[h]).toUpperCase().trim();
        if (headerStr.indexOf('NAMA') !== -1 || headerStr === 'TITLE' || headerStr === 'ACARA') colMap.title = h;
        else if (headerStr.indexOf('MULAI') !== -1 || (headerStr.indexOf('TANGGAL') !== -1 && headerStr.indexOf('SELESAI') === -1) || headerStr === 'DATE') colMap.date = h;
        else if (headerStr.indexOf('SELESAI') !== -1 || headerStr === 'ENDDATE') colMap.endDate = h;
        else if (headerStr.indexOf('JAM') !== -1 || headerStr.indexOf('WAKTU') !== -1 || headerStr === 'TIME') colMap.time = h;
        else if (headerStr.indexOf('FASILITAS') !== -1 || headerStr === 'FACILITY') colMap.facility = h;
        else if (headerStr.indexOf('PENYELENGGARA') !== -1 || headerStr === 'ORGANIZER') colMap.organizer = h;
        else if (headerStr.indexOf('CP') !== -1 || headerStr.indexOf('KONTAK') !== -1) colMap.cp = h;
        else if (headerStr.indexOf('TEKNIS') !== -1 || headerStr.indexOf('KEBUTUHAN') !== -1) colMap.technical = h;
        else if (headerStr.indexOf('PESERTA') !== -1) colMap.participants = h;
        else if (headerStr.indexOf('SURAT') !== -1) colMap.nomorSurat = h;
      }
    }

    // Default column fallback if header map missing
    var dateIdx = colMap.date !== undefined ? colMap.date : 2;
    var endDateIdx = colMap.endDate !== undefined ? colMap.endDate : 3;
    var timeIdx = colMap.time !== undefined ? colMap.time : 4;
    var facIdx = colMap.facility !== undefined ? colMap.facility : 5;
    var orgIdx = colMap.organizer !== undefined ? colMap.organizer : 6;
    var cpIdx = colMap.cp !== undefined ? colMap.cp : 7;
    var techIdx = colMap.technical !== undefined ? colMap.technical : 8;
    var partIdx = colMap.participants !== undefined ? colMap.participants : 9;
    var commIdx = colMap.committee !== undefined ? colMap.committee : 10;
    var suratIdx = colMap.nomorSurat !== undefined ? colMap.nomorSurat : 11;

    obj.date = formatDateValue(row[dateIdx]) || formatDateValue(new Date());
    obj.endDate = formatDateValue(row[endDateIdx]) || null;
    obj.time = (row[timeIdx] !== null && row[timeIdx] !== undefined) ? String(row[timeIdx]).trim() : '';
    
    var facRaw = (row[facIdx] !== null && row[facIdx] !== undefined) ? String(row[facIdx]).trim() : '';
    obj.facility = facRaw ? facRaw.split(',').map(function(s){ return s.trim(); }) : [];
    
    obj.organizer = (row[orgIdx] !== null && row[orgIdx] !== undefined) ? String(row[orgIdx]).trim() : '-';
    obj.cp = (row[cpIdx] !== null && row[cpIdx] !== undefined) ? String(row[cpIdx]).trim() : '-';
    obj.technical = (row[techIdx] !== null && row[techIdx] !== undefined) ? String(row[techIdx]).trim() : '-';
    obj.participants = (row[partIdx] !== null && row[partIdx] !== undefined) ? String(row[partIdx]).trim() : '0';
    obj.committee = (row[commIdx] !== null && row[commIdx] !== undefined) ? String(row[commIdx]).trim() : '0';
    obj.nomorSurat = (row[suratIdx] !== null && row[suratIdx] !== undefined) ? String(row[suratIdx]).trim() : '-';
  } else if (collectionName === 'vehicles') {
    obj.name = String(row[1] || '');
    obj.plate = String(row[2] || '');
    obj.type = String(row[3] || 'Mobil');
    obj.status = String(row[4] || 'Siap Operasional');
    obj.km = Number(row[5]) || 0;
    obj.lastOilDate = formatDateValue(row[6]);
    obj.taxDate = formatDateValue(row[7]);
    obj.plateDate = formatDateValue(row[8]);
    obj.notes = String(row[9] || '');
  } else if (collectionName === 'complaints') {
    obj.reporter = String(row[1] || 'Warga Sekolah');
    obj.role = String(row[2] || 'Siswa');
    obj.contact = String(row[3] || '');
    obj.location = String(row[4] || '-');
    obj.category = String(row[5] || 'Lainnya');
    obj.desc = String(row[6] || '-');
    obj.status = String(row[7] || 'Pending');
    obj.response = String(row[8] || '');
    obj.createdAt = formatDateValue(row[9]) || new Date().toISOString();
  } else if (collectionName === 'consumables') {
    obj.name = String(row[1] || '');
    obj.category = String(row[2] || 'ATK');
    obj.stock = Number(row[3]) || 0;
    obj.minStock = Number(row[4]) || 0;
    obj.unit = String(row[5] || 'Pcs');
    obj.location = String(row[6] || 'Gudang Sarpras');
  } else {
    for (var j = 0; j < headers.length; j++) {
      var hName = String(headers[j]).toLowerCase();
      if (hName !== 'json_data' && hName !== 'terakhir diperbarui') {
        obj[headers[j]] = row[j];
      }
    }
  }
  return obj;
}

function formatDateValue(val) {
  if (!val) return null;
  if (val instanceof Date) {
    var year = val.getFullYear();
    var month = String(val.getMonth() + 1).padStart(2, '0');
    var day = String(val.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }
  return String(val);
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
  
  var foundRowIndex = -1;
  var existingDataObj = null;

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(targetId)) {
      foundRowIndex = i + 1; // 1-indexed
      
      // Ambil data JSON lama atau parse dari kolom baris jika ada
      for (var c = 0; c < rows[i].length; c++) {
        var cellVal = String(rows[i][c] || '').trim();
        if (cellVal.indexOf('{') === 0 && cellVal.lastIndexOf('}') === cellVal.length - 1) {
          try {
            var parsed = JSON.parse(cellVal);
            if (parsed && typeof parsed === 'object') {
              existingDataObj = parsed;
              break;
            }
          } catch (e) {}
        }
      }
      if (!existingDataObj) {
        existingDataObj = buildObjectFromRowColumns(collectionName, rows[i], rows[0]);
      }
      break;
    }
  }

  // Jika isUpdate atau data lama ditemukan, lakukan MERGE agar data lama tidak terhapus
  if ((isUpdate || foundRowIndex > 0) && existingDataObj) {
    var merged = {};
    for (var k1 in existingDataObj) {
      merged[k1] = existingDataObj[k1];
    }
    for (var k2 in dataObj) {
      if (dataObj[k2] !== undefined && dataObj[k2] !== null && dataObj[k2] !== '') {
        merged[k2] = dataObj[k2];
      } else if (dataObj[k2] === '' && (k2 === 'contact' || k2 === 'response' || k2 === 'notes')) {
        merged[k2] = '';
      }
    }
    dataObj = merged;
  }

  var jsonStr = JSON.stringify(dataObj);
  
  var rowData = [];
  if (collectionName === 'events') {
    var facStr = Array.isArray(dataObj.facility) ? dataObj.facility.join(', ') : (dataObj.facility || '');
    rowData = [targetId, dataObj.title || '', dataObj.date || '', dataObj.endDate || '', dataObj.time || '', facStr, dataObj.organizer || '', dataObj.cp || '', dataObj.technical || '', dataObj.participants || '', dataObj.committee || '', dataObj.nomorSurat || '', jsonStr, now];
  } else if (collectionName === 'vehicles') {
    rowData = [targetId, dataObj.name || '', dataObj.plate || '', dataObj.type || '', dataObj.status || '', dataObj.km || 0, dataObj.lastOilDate || '', dataObj.taxDate || '', dataObj.plateDate || '', dataObj.notes || '', jsonStr, now];
  } else if (collectionName === 'complaints') {
    rowData = [targetId, dataObj.reporter || 'Warga Sekolah', dataObj.role || 'Siswa', dataObj.contact || '', dataObj.location || '-', dataObj.category || 'Lainnya', dataObj.desc || '-', dataObj.status || 'Pending', dataObj.response || '', dataObj.createdAt || now, jsonStr];
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
