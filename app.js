// Mengambil konfigurasi dari window (yang di-set oleh firebase-config.js)
const { firebaseConfig, isFirebaseConfigured } = window;

// --- State Management ---
let isAdmin = false;
let db = null;
let useLocalStorageFallback = !isFirebaseConfigured;

let events = [];
let facilities = ["Aula", "Lapang Upacara", "Lapang Tenis", "Mesjid", "Lab Komputer 1"];
let vehicles = [];
let complaints = [];
let currentComplaintStatusFilter = "all";
let facilityChoices = null; // Instance for Choices.js
let cmsContent = {
    headerTitle: "SISARNA",
    headerSubtitle: "Sistem Informasi Sarana & Prasarana - SMAN 2 Ciamis",
    mainHeading: "Jadwal Penggunaan Mendatang",
    footerText: "© 2026 SMAN 2 Ciamis. All rights reserved."
};

// --- Koordinat Peta Denah ---
const LOCAL_STORAGE_KEYS = {
    facilities: 'sardas_facilities',
    mapCoordinates: 'sardas_mapCoordinates'
};

let mapCoordinates = {};
let isFirestoreAvailable = false;

function loadFacilitiesFromLocalStorage() {
    const ls = localStorage.getItem(LOCAL_STORAGE_KEYS.facilities);
    if (ls) {
        try {
            const parsed = JSON.parse(ls);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        } catch (err) {
            console.warn('Gagal mengurai localStorage fasilitas:', err);
        }
    }
    return null;
}

function loadMapCoordinatesFromLocalStorage() {
    const ls = localStorage.getItem(LOCAL_STORAGE_KEYS.mapCoordinates);
    if (ls) {
        try {
            const parsed = JSON.parse(ls);
            if (parsed && typeof parsed === 'object' && parsed.coords && typeof parsed.coords === 'object') {
                return parsed.coords;
            }
        } catch (err) {
            console.warn('Gagal mengurai localStorage koordinat denah:', err);
        }
    }
    return null;
}

// --- DOM Elements ---
const DOM = {
    adminLoginBtn: document.getElementById('adminLoginBtn'),
    adminLogoutBtn: document.getElementById('adminLogoutBtn'),
    adminActions: document.getElementById('adminActions'),
    loginModal: document.getElementById('loginModal'),
    closeLoginModal: document.getElementById('closeLoginModal'),
    loginSubmitBtn: document.getElementById('loginSubmitBtn'),
    adminPassword: document.getElementById('adminPassword'),
    
    eventsGrid: document.getElementById('eventsGrid'),
    loadingIndicator: document.getElementById('loadingIndicator'),
    searchInput: document.getElementById('searchInput'),
    
    detailPanel: document.getElementById('detailPanel'),
    panelOverlay: document.getElementById('panelOverlay'),
    closeDetailBtn: document.getElementById('closeDetailBtn'),
    mapWrapper: document.getElementById('mapWrapper'),
    
    addEventBtn: document.getElementById('addEventBtn'),
    eventModal: document.getElementById('eventModal'),
    closeEventModal: document.getElementById('closeEventModal'),
    cancelEventBtn: document.getElementById('cancelEventBtn'),
    eventForm: document.getElementById('eventForm'),
    
    manageFacilitiesBtn: document.getElementById('manageFacilitiesBtn'),
    facilitiesModal: document.getElementById('facilitiesModal'),
    closeFacilitiesModal: document.getElementById('closeFacilitiesModal'),
    facilitiesList: document.getElementById('facilitiesList'),
    addFacilityBtn: document.getElementById('addFacilityBtn'),
    newFacilityName: document.getElementById('newFacilityName'),
    eventFacility: document.getElementById('eventFacility'),
    importFacilityBtn: document.getElementById('importFacilityBtn'),
    csvFacilityInput: document.getElementById('csvFacilityInput'),
    
    mapEditorBtn: document.getElementById('mapEditorBtn'),
    mapEditorModal: document.getElementById('mapEditorModal'),
    closeMapEditorModal: document.getElementById('closeMapEditorModal'),
    editorFacilitySelect: document.getElementById('editorFacilitySelect'),
    saveMapCoordsBtn: document.getElementById('saveMapCoordsBtn'),
    deleteMapCoordsBtn: document.getElementById('deleteMapCoordsBtn'),
    cleanOrphanCoordsBtn: document.getElementById('cleanOrphanCoordsBtn'),
    mapEditorWrapper: document.getElementById('mapEditorWrapper'),
    editableHighlight: document.getElementById('editableHighlight'),
    quickAddFacilityInput: document.getElementById('quickAddFacilityInput'),
    quickAddFacilityBtn: document.getElementById('quickAddFacilityBtn'),
    
    // Modul Kendaraan DOM
    tabSarprasBtn: document.getElementById('tabSarprasBtn'),
    tabVehiclesBtn: document.getElementById('tabVehiclesBtn'),
    tabComplaintsBtn: document.getElementById('tabComplaintsBtn'),
    sarprasSection: document.getElementById('sarprasSection'),
    vehiclesSection: document.getElementById('vehiclesSection'),
    complaintsSection: document.getElementById('complaintsSection'),
    vehicleSearchInput: document.getElementById('vehicleSearchInput'),
    adminVehicleActions: document.getElementById('adminVehicleActions'),
    addVehicleBtn: document.getElementById('addVehicleBtn'),
    vehicleAlertBanner: document.getElementById('vehicleAlertBanner'),
    vehiclesGrid: document.getElementById('vehiclesGrid'),
    vehicleModal: document.getElementById('vehicleModal'),
    closeVehicleModal: document.getElementById('closeVehicleModal'),
    cancelVehicleBtn: document.getElementById('cancelVehicleBtn'),
    vehicleForm: document.getElementById('vehicleForm'),

    // Modul Pengaduan DOM
    complaintSearchInput: document.getElementById('complaintSearchInput'),
    addComplaintBtn: document.getElementById('addComplaintBtn'),
    complaintsGrid: document.getElementById('complaintsGrid'),
    complaintModal: document.getElementById('complaintModal'),
    closeComplaintModal: document.getElementById('closeComplaintModal'),
    cancelComplaintBtn: document.getElementById('cancelComplaintBtn'),
    complaintForm: document.getElementById('complaintForm'),
    complaintAdminModal: document.getElementById('complaintAdminModal'),
    closeComplaintAdminModal: document.getElementById('closeComplaintAdminModal'),
    cancelComplaintAdminBtn: document.getElementById('cancelComplaintAdminBtn'),
    complaintAdminForm: document.getElementById('complaintAdminForm'),

    cmsEditables: document.querySelectorAll('.cms-editable')
};

// --- Initialization ---
async function init() {
    if (!isFirebaseConfigured) {
        alert("PERHATIAN: Konfigurasi Firebase belum disetel. Aplikasi berjalan menggunakan LocalStorage sementara.");
        loadFromLocalStorage();
    } else {
        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            db = firebase.firestore();
            
            db.enablePersistence({ synchronizeTabs: true }).catch(err => {
                console.warn("Keterangan Firestore Persistence:", err.code);
            });

            await loadFromFirebase();
            useLocalStorageFallback = false;
            isFirestoreAvailable = true;
        } catch (error) {
            console.error("Gagal inisialisasi Firebase:", error);
            alert("Gagal terhubung ke Firebase. Menggunakan mode offline sementara.");
            useLocalStorageFallback = true;
            loadFromLocalStorage();
        }
    }
    
    setupEventListeners();
    if (sessionStorage.getItem('sisarna_admin') === 'true') {
        toggleAdminMode(true);
    }
    renderApp();
}

// --- Data Fetching Real-time (Firebase / LocalStorage) ---
async function loadFromFirebase() {
    DOM.loadingIndicator.classList.remove('hidden');
    
    // Listen to CMS Content
    db.collection("settings").doc("cms").onSnapshot((doc) => {
        if (doc.exists) {
            cmsContent = { ...cmsContent, ...doc.data() };
            // Jika data lama di Firestore masih ter-set "SMAN 2 CIAMIS", perbarui ke "SISARNA"
            if (cmsContent.headerTitle === "SMAN 2 CIAMIS" || !cmsContent.headerTitle) {
                cmsContent.headerTitle = "SISARNA";
                cmsContent.headerSubtitle = "Sistem Informasi Sarana & Prasarana - SMAN 2 Ciamis";
                db.collection("settings").doc("cms").set(cmsContent);
            }
            applyCmsContent();
        } else {
            db.collection("settings").doc("cms").set(cmsContent);
        }
    }, err => console.error("Gagal memuat CMS dari Firestore:", err));

    // Listen to Facilities
    db.collection("settings").doc("facilities").onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data() || {};
            if (Array.isArray(data.list)) {
                facilities = data.list;
                localStorage.setItem(LOCAL_STORAGE_KEYS.facilities, JSON.stringify(facilities));
            } else if (data.list === undefined) {
                const storedFacilities = loadFacilitiesFromLocalStorage();
                if (storedFacilities) {
                    facilities = storedFacilities;
                    db.collection("settings").doc("facilities").set({ list: facilities }, { merge: true });
                } else {
                    db.collection("settings").doc("facilities").set({ list: facilities }, { merge: true });
                }
            }
            renderFacilities();
        } else {
            const storedFacilities = loadFacilitiesFromLocalStorage();
            if (storedFacilities) {
                facilities = storedFacilities;
            }
            db.collection("settings").doc("facilities").set({ list: facilities });
            renderFacilities();
        }
    }, err => console.error("Gagal memuat Fasilitas dari Firestore:", err));

    // Listen to Map Coordinates
    db.collection("settings").doc("mapCoordinates").onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data() || {};
            if (data.coords && typeof data.coords === 'object') {
                mapCoordinates = data.coords;
                localStorage.setItem(LOCAL_STORAGE_KEYS.mapCoordinates, JSON.stringify({ coords: mapCoordinates }));
                renderFacilities();
            } else if (data.coords === undefined) {
                const storedCoords = loadMapCoordinatesFromLocalStorage();
                if (storedCoords) {
                    mapCoordinates = storedCoords;
                    db.collection("settings").doc("mapCoordinates").set({ coords: mapCoordinates }, { merge: true });
                    renderFacilities();
                } else {
                    db.collection("settings").doc("mapCoordinates").set({ coords: mapCoordinates }, { merge: true });
                }
            }
        } else {
            const storedCoords = loadMapCoordinatesFromLocalStorage();
            if (storedCoords) {
                mapCoordinates = storedCoords;
                renderFacilities();
            }
            db.collection("settings").doc("mapCoordinates").set({ coords: mapCoordinates });
        }
    }, err => console.error("Gagal memuat Koordinat Denah dari Firestore:", err));

    // Listen to Events
    db.collection("events").onSnapshot((snapshot) => {
        events = [];
        snapshot.forEach((doc) => {
            events.push({ id: doc.id, ...doc.data() });
        });
        
        events.sort((a, b) => new Date(a.date) - new Date(b.date));
        renderEvents();
        DOM.loadingIndicator.classList.add('hidden');
    }, err => {
        console.error("Gagal memuat Acara dari Firestore:", err);
        DOM.loadingIndicator.classList.add('hidden');
    });

    // Listen to Vehicles
    db.collection("vehicles").onSnapshot((snapshot) => {
        vehicles = [];
        snapshot.forEach((doc) => {
            vehicles.push({ id: doc.id, ...doc.data() });
        });
        renderVehicles();
    }, err => console.error("Gagal memuat Kendaraan dari Firestore:", err));

    // Listen to Complaints (Modul Pengaduan Warga Sekolah)
    db.collection("complaints").onSnapshot((snapshot) => {
        complaints = [];
        snapshot.forEach((doc) => {
            complaints.push({ id: doc.id, ...doc.data() });
        });
        complaints.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        renderComplaints();
    }, err => console.error("Gagal memuat Pengaduan dari Firestore:", err));
}

function loadFromLocalStorage() {
    const lsEvents = localStorage.getItem('sardas_events');
    const lsFacilities = localStorage.getItem(LOCAL_STORAGE_KEYS.facilities);
    const lsCms = localStorage.getItem('sardas_cms');
    const lsMap = localStorage.getItem(LOCAL_STORAGE_KEYS.mapCoordinates);
    const lsVehicles = localStorage.getItem('sardas_vehicles');
    const lsComplaints = localStorage.getItem('sardas_complaints');
    
    if (lsEvents) events = JSON.parse(lsEvents);
    if (lsFacilities) {
        try {
            const parsed = JSON.parse(lsFacilities);
            if (Array.isArray(parsed) && parsed.length > 0) {
                facilities = parsed;
            }
        } catch (err) {
            console.warn('Gagal mengurai localStorage fasilitas:', err);
        }
    }
    if (lsCms) cmsContent = JSON.parse(lsCms);
    if (lsMap) {
        try {
            const parsedMap = JSON.parse(lsMap);
            if (parsedMap && parsedMap.coords) {
                mapCoordinates = parsedMap.coords;
            }
        } catch (err) {
            console.warn('Gagal mengurai localStorage koordinat denah:', err);
        }
    }
    if (lsVehicles) vehicles = JSON.parse(lsVehicles);
    if (lsComplaints) complaints = JSON.parse(lsComplaints);
    
    applyCmsContent();
    renderFacilities();
    renderEvents();
    renderVehicles();
    renderComplaints();
}

async function saveToDatabase(collectionName, docId, data, isUpdate = false) {
    if (useLocalStorageFallback) {
        if (collectionName === 'events') {
            if (isUpdate) {
                const index = events.findIndex(e => e.id === docId);
                if (index > -1) events[index] = { ...events[index], ...data };
            } else {
                data.id = Date.now().toString();
                events.push(data);
            }
            events.sort((a, b) => new Date(a.date) - new Date(b.date));
            localStorage.setItem('sardas_events', JSON.stringify(events));
            renderEvents();
        } else if (collectionName === 'vehicles') {
            if (isUpdate) {
                const index = vehicles.findIndex(v => v.id === docId);
                if (index > -1) vehicles[index] = { ...vehicles[index], ...data };
            } else {
                data.id = Date.now().toString();
                vehicles.push(data);
            }
            localStorage.setItem('sardas_vehicles', JSON.stringify(vehicles));
            renderVehicles();
        } else if (collectionName === 'complaints') {
            if (isUpdate) {
                const index = complaints.findIndex(c => c.id === docId);
                if (index > -1) complaints[index] = { ...complaints[index], ...data };
            } else {
                data.id = Date.now().toString();
                complaints.unshift(data);
            }
            localStorage.setItem('sardas_complaints', JSON.stringify(complaints));
            renderComplaints();
        } else if (collectionName === 'settings') {
            if (docId === 'facilities') {
                facilities = data.list;
                localStorage.setItem('sardas_facilities', JSON.stringify(facilities));
                renderFacilities();
            } else if (docId === 'cms') {
                cmsContent = data;
                localStorage.setItem('sardas_cms', JSON.stringify(cmsContent));
                applyCmsContent();
            } else if (docId === 'mapCoordinates') {
                mapCoordinates = data.coords;
                localStorage.setItem('sardas_mapCoordinates', JSON.stringify({ coords: mapCoordinates }));
            }
        }
    } else {
        try {
            if (collectionName === 'events' || collectionName === 'vehicles' || collectionName === 'complaints') {
                if (isUpdate) {
                    await db.collection(collectionName).doc(docId).update(data);
                } else {
                    await db.collection(collectionName).add(data);
                }
            } else {
                await db.collection("settings").doc(docId).set(data);
            }
        } catch (error) {
            console.error(`Gagal menyimpan ${collectionName}/${docId} ke Firestore:`, error);
            alert("Gagal menyimpan ke Firebase. Data akan disimpan sementara di browser dan akan disinkronkan kembali ketika koneksi tersedia.");
            useLocalStorageFallback = true;
            return saveToDatabase(collectionName, docId, data, isUpdate);
        }
    }
}

async function deleteFromDatabase(collectionName, docId) {
    if (useLocalStorageFallback) {
        if (collectionName === 'events') {
            events = events.filter(e => e.id !== docId);
            localStorage.setItem('sardas_events', JSON.stringify(events));
            renderEvents();
        } else if (collectionName === 'vehicles') {
            vehicles = vehicles.filter(v => v.id !== docId);
            localStorage.setItem('sardas_vehicles', JSON.stringify(vehicles));
            renderVehicles();
        } else if (collectionName === 'complaints') {
            complaints = complaints.filter(c => c.id !== docId);
            localStorage.setItem('sardas_complaints', JSON.stringify(complaints));
            renderComplaints();
        }
    } else {
        await db.collection(collectionName).doc(docId).delete();
    }
}

// --- Rendering Logic ---
function renderApp() {
    applyCmsContent();
    renderFacilities();
    renderEvents();
    renderVehicles();
    renderComplaints();
}

function applyCmsContent() {
    DOM.cmsEditables.forEach(el => {
        const key = el.getAttribute('data-cms-key');
        if (cmsContent[key]) {
            el.textContent = cmsContent[key];
        }
    });
}

function normalizeFacilityName(name) {
    return (name || '').toLowerCase().replace(/[\s-]/g, '');
}

function renderFacilities() {
    if (facilityChoices) {
        try {
            facilityChoices.destroy();
        } catch (e) {
            console.warn("Catatan destroy Choices:", e);
        }
        facilityChoices = null;
    }
    DOM.eventFacility.innerHTML = '';
    
    const sortedFacilities = [...facilities].sort((a, b) => a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' }));
    
    sortedFacilities.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f;
        opt.textContent = f;
        DOM.eventFacility.appendChild(opt);
    });
    
    if (typeof Choices !== 'undefined') {
        facilityChoices = new Choices(DOM.eventFacility, {
            removeItemButton: true,
            placeholderValue: 'Cari & pilih fasilitas...',
            searchPlaceholderValue: 'Ketik nama fasilitas (contoh: X E 1)...',
            itemSelectText: 'Pilih',
            noResultsText: 'Tidak ditemukan',
            noChoicesText: 'Semua fasilitas sudah dipilih',
            shouldSort: false,
            searchResultLimit: 500,
            renderChoiceLimit: -1,
            fuseOptions: {
                threshold: 0.3
            }
        });
    }

    renderFacilityAdminList();
}

function renderFacilityAdminList(filterText = "") {
    DOM.facilitiesList.innerHTML = '';
    const lowerFilter = filterText.toLowerCase();
    const normalizedFilter = normalizeFacilityName(filterText);
    
    let hasExactMatch = false;

    const facilityObjects = facilities.map((f, idx) => ({ f, idx }));
    facilityObjects.sort((a, b) => a.f.localeCompare(b.f, 'id', { numeric: true, sensitivity: 'base' }));

    facilityObjects.forEach(({ f, idx }) => {
        const normalizedF = normalizeFacilityName(f);
        if (f.toLowerCase().includes(lowerFilter) || normalizedF.includes(normalizedFilter)) {
            if (normalizedF === normalizedFilter) hasExactMatch = true;
            
            const isMapped = !!mapCoordinates[normalizedF];
            
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="fac-info">
                    <span class="fac-name">${f}</span>
                    <span class="fac-badge ${isMapped ? 'mapped' : 'unmapped'}" style="cursor: pointer;" title="${isMapped ? 'Sudah memiliki koordinat denah (Klik untuk buka editor)' : 'Belum memiliki koordinat denah (Klik untuk petakan)'}">
                        <i class="${isMapped ? 'fas fa-map-marker-alt' : 'far fa-map'}"></i> ${isMapped ? 'Dipetakan' : 'Belum ada denah'}
                    </span>
                </div>
                <div class="fac-actions">
                    <button class="action-icon edit edit-fac btn-sm" data-idx="${idx}" title="Edit Nama Fasilitas"><i class="fas fa-edit"></i></button>
                    <button class="action-icon delete delete-fac btn-sm" data-idx="${idx}" title="Hapus Fasilitas"><i class="fas fa-trash"></i></button>
                </div>
            `;
            
            li.querySelector('.fac-badge').addEventListener('click', () => {
                DOM.facilitiesModal.classList.add('hidden');
                openMapEditorForFacility(f);
            });

            DOM.facilitiesList.appendChild(li);
        }
    });

    DOM.facilitiesList.querySelectorAll('.edit-fac').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const idx = parseInt(e.currentTarget.getAttribute('data-idx'));
            const oldName = facilities[idx];
            const newName = prompt(`Edit nama fasilitas "${oldName}":`, oldName);
            
            if (newName && newName.trim() !== '' && newName.trim() !== oldName) {
                const trimmed = newName.trim();
                const oldKey = normalizeFacilityName(oldName);
                const newKey = normalizeFacilityName(trimmed);
                
                const exists = facilities.some((fac, i) => i !== idx && normalizeFacilityName(fac) === newKey);
                if (exists) {
                    alert(`Fasilitas "${trimmed}" sudah ada di daftar!`);
                    return;
                }
                
                facilities[idx] = trimmed;
                
                if (mapCoordinates[oldKey]) {
                    mapCoordinates[newKey] = mapCoordinates[oldKey];
                    delete mapCoordinates[oldKey];
                    await saveToDatabase('settings', 'mapCoordinates', { coords: mapCoordinates });
                }
                
                await saveToDatabase('settings', 'facilities', { list: facilities });
                renderFacilities();
            }
        });
    });

    DOM.facilitiesList.querySelectorAll('.delete-fac').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const idx = parseInt(e.currentTarget.getAttribute('data-idx'));
            const facName = facilities[idx];
            
            if (confirm(`Apakah Anda yakin ingin menghapus fasilitas "${facName}"?\n(Titik koordinat denah fasilitas ini juga akan dihapus)`)) {
                facilities.splice(idx, 1);
                
                const key = normalizeFacilityName(facName);
                if (mapCoordinates[key]) {
                    delete mapCoordinates[key];
                    await saveToDatabase('settings', 'mapCoordinates', { coords: mapCoordinates });
                }
                
                await saveToDatabase('settings', 'facilities', { list: facilities });
                renderFacilities();
            }
        });
    });
    
    if (hasExactMatch && filterText.trim() !== '') {
        DOM.addFacilityBtn.disabled = true;
        DOM.addFacilityBtn.textContent = 'Sudah Ada';
        DOM.addFacilityBtn.style.opacity = '0.6';
    } else {
        DOM.addFacilityBtn.disabled = false;
        DOM.addFacilityBtn.textContent = 'Tambah';
        DOM.addFacilityBtn.style.opacity = '1';
    }
}

function renderEvents(filterText = "") {
    DOM.eventsGrid.innerHTML = '';
    
    let filteredEvents = [...events];
    filteredEvents.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filterText) {
        const lowerFilter = filterText.toLowerCase();
        filteredEvents = filteredEvents.filter(e => {
            const facText = Array.isArray(e.facility) ? e.facility.join(' ') : (e.facility || '');
            return (e.title || '').toLowerCase().includes(lowerFilter) || 
                   facText.toLowerCase().includes(lowerFilter) ||
                   (e.organizer || '').toLowerCase().includes(lowerFilter) ||
                   (e.nomorSurat || '').toLowerCase().includes(lowerFilter) ||
                   (e.cp || '').toLowerCase().includes(lowerFilter) ||
                   (e.technical || '').toLowerCase().includes(lowerFilter);
        });
    }

    if (filteredEvents.length === 0) {
        DOM.eventsGrid.innerHTML = '<div class="loading-spinner"><p>Tidak ada jadwal ditemukan.</p></div>';
        return;
    }

    filteredEvents.forEach(event => {
        const dateObj = new Date(event.date);
        let dateStr = dateObj.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        
        if (event.endDate) {
            const endObj = new Date(event.endDate);
            const endStr = endObj.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            dateStr = `${dateStr} s.d. ${endStr}`;
        }
        
        if (event.time) {
            dateStr += ` • 🕒 ${event.time}`;
        }
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const eventEnd = event.endDate ? new Date(event.endDate) : new Date(event.date);
        const isPast = eventEnd < today;
        
        const facDisplay = Array.isArray(event.facility) ? event.facility.join(', ') : event.facility;

        const card = document.createElement('div');
        card.className = `event-card glass ${isPast ? 'past-event' : ''}`;
        card.innerHTML = `
            <div class="event-date">${dateStr} ${isPast ? '<span class="badge" style="background: #ef4444; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 5px;">Selesai</span>' : ''}</div>
            <div class="event-title">${event.title}</div>
            <div class="event-facility">${facDisplay || '-'}</div>
            <div class="event-footer">
                <span><i class="fas fa-user"></i> ${event.organizer}</span>
            </div>
            <div class="card-actions">
                <button class="action-icon edit edit-event-btn" data-id="${event.id}" title="Edit Acara"><i class="fas fa-edit"></i></button>
                <button class="action-icon delete delete-event-btn" data-id="${event.id}" title="Hapus Acara"><i class="fas fa-trash"></i></button>
            </div>
        `;

        card.addEventListener('click', (e) => {
            if(e.target.closest('.card-actions')) return;
            showEventDetail(event, dateStr);
        });

        DOM.eventsGrid.appendChild(card);
    });

    document.querySelectorAll('.edit-event-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const event = events.find(ev => ev.id === id);
            openEventModal(event);
        });
    });
    
    document.querySelectorAll('.delete-event-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if(confirm("Apakah Anda yakin ingin menghapus jadwal ini?")) {
                const id = e.currentTarget.getAttribute('data-id');
                await deleteFromDatabase('events', id);
            }
        });
    });
}

// --- Modul Kendaraan Operasional Rendering ---
function getDaysDifference(targetDateStr) {
    if (!targetDateStr) return null;
    const today = new Date();
    today.setHours(0,0,0,0);
    const target = new Date(targetDateStr);
    target.setHours(0,0,0,0);
    const diffTime = target - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function renderVehicles(filterText = "") {
    if (!DOM.vehiclesGrid) return;
    DOM.vehiclesGrid.innerHTML = '';
    DOM.vehicleAlertBanner.innerHTML = '';

    let filteredVehicles = [...vehicles];
    
    if (filterText) {
        const lower = filterText.toLowerCase();
        filteredVehicles = filteredVehicles.filter(v => 
            (v.name || '').toLowerCase().includes(lower) ||
            (v.plate || '').toLowerCase().includes(lower) ||
            (v.type || '').toLowerCase().includes(lower)
        );
    }

    let alertsHTML = '';
    vehicles.forEach(v => {
        const taxDiff = getDaysDifference(v.taxDate);
        const oilDiff = getDaysDifference(v.nextOilDate);
        const plateDiff = getDaysDifference(v.plateDate);

        if (taxDiff !== null) {
            if (taxDiff < 0) {
                alertsHTML += `<div class="alert-banner-item alert-banner-danger"><i class="fas fa-exclamation-triangle"></i> <strong>PAJAK JATUH TEMPO LEWAT:</strong> Pajak STNK ${v.name} (${v.plate}) telah lewat ${Math.abs(taxDiff)} hari!</div>`;
            } else if (taxDiff <= 14) {
                alertsHTML += `<div class="alert-banner-item alert-banner-warning"><i class="fas fa-exclamation-circle"></i> <strong>PERINGATAN PAJAK:</strong> Pajak STNK ${v.name} (${v.plate}) jatuh tempo dalam ${taxDiff} hari (${v.taxDate}).</div>`;
            }
        }

        if (oilDiff !== null) {
            if (oilDiff < 0) {
                alertsHTML += `<div class="alert-banner-item alert-banner-danger"><i class="fas fa-oil-can"></i> <strong>GANTI OLI LEWAT TARGET:</strong> ${v.name} (${v.plate}) telah lewat target ganti oli ${Math.abs(oilDiff)} hari!</div>`;
            } else if (oilDiff <= 14) {
                alertsHTML += `<div class="alert-banner-item alert-banner-warning"><i class="fas fa-oil-can"></i> <strong>JADWAL GANTI OLI:</strong> ${v.name} (${v.plate}) perlu ganti oli dalam ${oilDiff} hari (${v.nextOilDate}).</div>`;
            }
        }

        if (plateDiff !== null && plateDiff <= 30) {
            if (plateDiff < 0) {
                alertsHTML += `<div class="alert-banner-item alert-banner-danger"><i class="fas fa-id-card"></i> <strong>GANTI PLAT 5 TAHUNAN LEWAT:</strong> Plat nomor ${v.name} (${v.plate}) lewat ${Math.abs(plateDiff)} hari!</div>`;
            } else {
                alertsHTML += `<div class="alert-banner-item alert-banner-warning"><i class="fas fa-id-card"></i> <strong>GANTI PLAT 5 TAHUNAN:</strong> Plat nomor ${v.name} (${v.plate}) jatuh tempo dalam ${plateDiff} hari.</div>`;
            }
        }
    });

    DOM.vehicleAlertBanner.innerHTML = alertsHTML;

    if (filteredVehicles.length === 0) {
        DOM.vehiclesGrid.innerHTML = '<div class="loading-spinner" style="grid-column: 1/-1;"><p>Belum ada data kendaraan operasional.</p></div>';
        return;
    }

    filteredVehicles.forEach(v => {
        let iconClass = 'fa-car';
        if (v.type === 'Motor') iconClass = 'fa-motorcycle';
        if (v.type === 'Bus') iconClass = 'fa-bus';
        
        let statusBadgeClass = 'vehicle-status-ready';
        if (v.status === 'Perlu Perbaikan') statusBadgeClass = 'vehicle-status-warning';
        if (v.status === 'Dalam Servis') statusBadgeClass = 'vehicle-status-danger';

        const taxDiff = getDaysDifference(v.taxDate);
        let taxDisplay = v.taxDate || '-';
        if (taxDiff !== null) {
            if (taxDiff < 0) taxDisplay += ` <span style="color:#b91c1c; font-weight:700;">(Lewat ${Math.abs(taxDiff)} hr)</span>`;
            else if (taxDiff <= 14) taxDisplay += ` <span style="color:#a16207; font-weight:700;">(${taxDiff} hr lagi)</span>`;
        }

        const nextOilDisplay = v.nextOilDate || '-';

        const card = document.createElement('div');
        card.className = 'vehicle-card glass';
        card.innerHTML = `
            <div class="vehicle-header">
                <div class="vehicle-icon"><i class="fas ${iconClass}"></i></div>
                <div class="vehicle-title-box">
                    <div class="vehicle-name">${v.name}</div>
                    <span class="vehicle-plate">${v.plate || '-'}</span>
                </div>
                <span class="vehicle-status-badge ${statusBadgeClass}">${v.status || 'Siap Operasional'}</span>
            </div>

            <div class="vehicle-meta-grid">
                <div class="vehicle-meta-item">
                    <div class="vehicle-meta-label">📅 Pajak STNK Tahunan</div>
                    <div class="vehicle-meta-value">${taxDisplay}</div>
                </div>
                <div class="vehicle-meta-item">
                    <div class="vehicle-meta-label">🛢️ Target Ganti Oli</div>
                    <div class="vehicle-meta-value">${nextOilDisplay} ${v.kmNextOil ? `(${v.kmNextOil} KM)` : ''}</div>
                </div>
                <div class="vehicle-meta-item">
                    <div class="vehicle-meta-label">💳 Pajak Plat 5 Thn</div>
                    <div class="vehicle-meta-value">${v.plateDate || '-'}</div>
                </div>
                <div class="vehicle-meta-item">
                    <div class="vehicle-meta-label">🛣️ KM Saat Ini</div>
                    <div class="vehicle-meta-value">${v.km ? `${v.km} KM` : '-'}</div>
                </div>
            </div>

            ${v.notes ? `<div style="font-size: 0.85rem; color: var(--color-text-muted); background: rgba(0,0,0,0.03); padding: 8px 12px; border-radius: 8px;"><strong>Catatan:</strong> ${v.notes}</div>` : ''}

            <div class="card-actions">
                <button class="action-icon edit edit-veh-btn" data-id="${v.id}" title="Edit Kendaraan"><i class="fas fa-edit"></i></button>
                <button class="action-icon delete delete-veh-btn" data-id="${v.id}" title="Hapus Kendaraan"><i class="fas fa-trash"></i></button>
            </div>
        `;

        DOM.vehiclesGrid.appendChild(card);
    });

    DOM.vehiclesGrid.querySelectorAll('.edit-veh-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const veh = vehicles.find(v => v.id === id);
            openVehicleModal(veh);
        });
    });

    DOM.vehiclesGrid.querySelectorAll('.delete-veh-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (confirm("Apakah Anda yakin ingin menghapus data kendaraan ini?")) {
                const id = e.currentTarget.getAttribute('data-id');
                await deleteFromDatabase('vehicles', id);
            }
        });
    });
}

function openVehicleModal(veh = null) {
    DOM.vehicleForm.reset();
    document.getElementById('vehicleId').value = '';
    document.getElementById('vehicleModalTitle').textContent = 'Tambah Kendaraan Operasional';

    if (veh) {
        document.getElementById('vehicleModalTitle').textContent = 'Edit Kendaraan Operasional';
        document.getElementById('vehicleId').value = veh.id;
        document.getElementById('vehicleName').value = veh.name || '';
        document.getElementById('vehiclePlate').value = veh.plate || '';
        document.getElementById('vehicleType').value = veh.type || 'Mobil';
        document.getElementById('vehicleStatus').value = veh.status || 'Siap Operasional';
        document.getElementById('vehicleKm').value = veh.km || '';
        document.getElementById('vehicleKmNextOil').value = veh.kmNextOil || '';
        document.getElementById('vehicleLastOilDate').value = veh.lastOilDate || '';
        document.getElementById('vehicleNextOilDate').value = veh.nextOilDate || '';
        document.getElementById('vehicleTaxDate').value = veh.taxDate || '';
        document.getElementById('vehiclePlateDate').value = veh.plateDate || '';
        document.getElementById('vehicleNotes').value = veh.notes || '';
    }

    DOM.vehicleModal.classList.remove('hidden');
}

// --- Modul Pengaduan & Aspirasi Warga Sekolah Rendering ---
function renderComplaints(filterText = "", statusFilter = currentComplaintStatusFilter) {
    if (!DOM.complaintsGrid) return;
    DOM.complaintsGrid.innerHTML = '';
    currentComplaintStatusFilter = statusFilter;

    let filtered = [...complaints];
    
    if (statusFilter !== 'all') {
        filtered = filtered.filter(c => (c.status || 'Pending') === statusFilter);
    }

    if (filterText) {
        const lower = filterText.toLowerCase();
        filtered = filtered.filter(c => 
            (c.location || '').toLowerCase().includes(lower) ||
            (c.category || '').toLowerCase().includes(lower) ||
            (c.reporter || '').toLowerCase().includes(lower) ||
            (c.desc || '').toLowerCase().includes(lower)
        );
    }

    if (filtered.length === 0) {
        DOM.complaintsGrid.innerHTML = '<div class="loading-spinner" style="grid-column: 1/-1;"><p>Belum ada laporan pengaduan untuk kategori ini.</p></div>';
        return;
    }

    filtered.forEach(c => {
        let badgeClass = 'badge-pending';
        let badgeText = '⏳ Pending (Diterima)';
        
        if (c.status === 'Dalam Perbaikan') {
            badgeClass = 'badge-in-progress';
            badgeText = '🛠️ Dalam Perbaikan';
        } else if (c.status === 'Selesai') {
            badgeClass = 'badge-completed';
            badgeText = '✅ Selesai Dikerjakan';
        }

        const dateStr = c.createdAt ? new Date(c.createdAt).toLocaleDateString('id-ID', {
            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }) : '-';

        const card = document.createElement('div');
        card.className = 'complaint-card glass';
        card.innerHTML = `
            <div class="complaint-header">
                <div>
                    <div class="complaint-location">📍 ${c.location}</div>
                    <span class="complaint-category">${c.category || 'Lainnya'}</span>
                </div>
                <span class="complaint-badge ${badgeClass}">${badgeText}</span>
            </div>

            <div class="complaint-reporter">
                <i class="fas fa-user-circle"></i> Pelapor: <strong>${c.reporter || 'Warga Sekolah'}</strong> (${c.role || 'Siswa'}) • 🕒 ${dateStr}
            </div>

            <div class="complaint-desc">${c.desc}</div>

            ${(c.status || 'Pending') === 'Pending' ? `
                <div style="margin-top: 10px; text-align: right;">
                    <button class="btn btn-secondary edit-public-complaint-btn" data-id="${c.id}" style="padding: 4px 10px; font-size: 0.8rem; border-radius: 6px;" title="Edit rincian laporan sebelum diproses admin">
                        <i class="fas fa-pen"></i> Edit Laporan Saya
                    </button>
                </div>
            ` : ''}

            ${c.response ? `
                <div class="complaint-admin-response">
                    <strong>💬 Tanggapan Admin Sarpras:</strong><br>
                    ${c.response}
                </div>
            ` : ''}

            <div class="card-actions">
                <button class="action-icon edit edit-complaint-btn" data-id="${c.id}" title="Tindak Lanjut Admin"><i class="fas fa-edit"></i></button>
                <button class="action-icon delete delete-complaint-btn" data-id="${c.id}" title="Hapus Laporan"><i class="fas fa-trash"></i></button>
            </div>
        `;

        DOM.complaintsGrid.appendChild(card);
    });

    DOM.complaintsGrid.querySelectorAll('.edit-public-complaint-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const comp = complaints.find(c => c.id === id);
            openPublicComplaintEdit(comp);
        });
    });

    DOM.complaintsGrid.querySelectorAll('.edit-complaint-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const comp = complaints.find(c => c.id === id);
            openComplaintAdminModal(comp);
        });
    });

    DOM.complaintsGrid.querySelectorAll('.delete-complaint-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (confirm("Apakah Anda yakin ingin menghapus laporan pengaduan ini?")) {
                const id = e.currentTarget.getAttribute('data-id');
                await deleteFromDatabase('complaints', id);
            }
        });
    });
}

function openPublicComplaintEdit(comp) {
    if (!comp) return;
    DOM.complaintForm.reset();
    document.getElementById('complaintFormId').value = comp.id;
    document.getElementById('complaintModalTitle').textContent = '✏️ Edit Laporan Pengaduan Saya';
    document.getElementById('complaintReporter').value = comp.reporter || '';
    document.getElementById('complaintRole').value = comp.role || 'Siswa';
    document.getElementById('complaintContact').value = comp.contact || '';
    document.getElementById('complaintLocation').value = comp.location || '';
    document.getElementById('complaintCategory').value = comp.category || 'Lainnya';
    document.getElementById('complaintDesc').value = comp.desc || '';
    DOM.complaintModal.classList.remove('hidden');
}

function openComplaintAdminModal(comp) {
    if (!comp) return;
    document.getElementById('complaintAdminId').value = comp.id;
    document.getElementById('complaintAdminStatus').value = comp.status || 'Pending';
    document.getElementById('complaintAdminResponse').value = comp.response || '';
    DOM.complaintAdminModal.classList.remove('hidden');
}

function showEventDetail(event, dateStr) {
    document.getElementById('detailTitle').textContent = event.title;
    const dateObj = new Date(event.date);
    let pureDateStr = dateObj.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (event.endDate) {
        const endObj = new Date(event.endDate);
        const endStr = endObj.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        pureDateStr = `${pureDateStr} s.d. ${endStr}`;
    }
    
    const facDisplay = Array.isArray(event.facility) ? event.facility.join(', ') : event.facility;

    document.getElementById('detailDate').textContent = pureDateStr;
    document.getElementById('detailTime').textContent = event.time || '-';
    document.getElementById('detailFacility').textContent = facDisplay || '-';
    document.getElementById('detailOrganizer').textContent = event.organizer;
    document.getElementById('detailCP').textContent = event.cp || '-';
    document.getElementById('detailNomorSurat').textContent = event.nomorSurat || '-';
    document.getElementById('detailParticipants').textContent = event.participants || '0';
    document.getElementById('detailCommittee').textContent = event.committee || '0';
    
    const techList = document.getElementById('detailTechnical');
    techList.innerHTML = '';
    if (event.technical) {
        const items = event.technical.split(',');
        items.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item.trim();
            techList.appendChild(li);
        });
    }

    const detailFormationContainer = document.getElementById('detailFormationContainer');
    const detailFormationImg = document.getElementById('detailFormationImg');
    if (event.formationImg) {
        detailFormationImg.src = event.formationImg;
        detailFormationContainer.classList.remove('hidden');
    } else {
        detailFormationImg.src = '';
        detailFormationContainer.classList.add('hidden');
    }

    const existingHighlights = document.querySelectorAll('.map-highlight');
    existingHighlights.forEach(el => el.remove());

    if (event.facility) {
        let selectedFacs = [];
        if (Array.isArray(event.facility)) {
            selectedFacs = event.facility;
        } else if (typeof event.facility === 'string') {
            selectedFacs = event.facility.split(',').map(f => f.trim());
        }

        selectedFacs.forEach(fac => {
            const normalizedFac = normalizeFacilityName(fac);
            if (mapCoordinates[normalizedFac]) {
                const coords = mapCoordinates[normalizedFac];
                const highlight = document.createElement('div');
                highlight.className = 'map-highlight';
                highlight.style.top = coords.top;
                highlight.style.left = coords.left;
                highlight.style.width = coords.width;
                highlight.style.height = coords.height;
                DOM.mapWrapper.appendChild(highlight);
            }
        });
    }

    DOM.detailPanel.classList.add('open');
    DOM.panelOverlay.classList.add('active');
}

// --- Admin & CMS Logic ---
function toggleAdminMode(state) {
    isAdmin = state;
    if (isAdmin) {
        sessionStorage.setItem('sisarna_admin', 'true');
        document.body.classList.add('admin-mode');
        DOM.adminLoginBtn.classList.add('hidden');
        DOM.adminLogoutBtn.classList.remove('hidden');
        DOM.adminActions.classList.remove('hidden');
        if (DOM.adminVehicleActions) DOM.adminVehicleActions.classList.remove('hidden');
        enableCmsEditing();
    } else {
        sessionStorage.removeItem('sisarna_admin');
        document.body.classList.remove('admin-mode');
        DOM.adminLoginBtn.classList.remove('hidden');
        DOM.adminLogoutBtn.classList.add('hidden');
        DOM.adminActions.classList.add('hidden');
        if (DOM.adminVehicleActions) DOM.adminVehicleActions.classList.add('hidden');
        disableCmsEditing();
    }
    renderApp();
}

function enableCmsEditing() {
    DOM.cmsEditables.forEach(el => {
        el.setAttribute('contenteditable', 'true');
        el.addEventListener('blur', handleCmsEdit);
    });
}

function disableCmsEditing() {
    DOM.cmsEditables.forEach(el => {
        el.setAttribute('contenteditable', 'false');
        el.removeEventListener('blur', handleCmsEdit);
    });
}

async function handleCmsEdit(e) {
    const el = e.target;
    const key = el.getAttribute('data-cms-key');
    const newText = el.textContent.trim();
    
    if (cmsContent[key] !== newText) {
        cmsContent[key] = newText;
        await saveToDatabase('settings', 'cms', cmsContent);
    }
}

// --- Event Listeners ---
function setupEventListeners() {
    // Reset nilai input pencarian agar tidak terisi otomatis username oleh browser password manager
    ['searchInput', 'vehicleSearchInput', 'complaintSearchInput'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.value = '';
            // Reset bila ada autofill yang masuk terlambat setelah render
            setTimeout(() => { if (input.value && !input.getAttribute('data-user-typed')) input.value = ''; }, 300);
            input.addEventListener('input', () => input.setAttribute('data-user-typed', 'true'));
        }
    });

    // Switch Navigation 3 Tabs
    if (DOM.tabSarprasBtn && DOM.tabVehiclesBtn && DOM.tabComplaintsBtn) {
        DOM.tabSarprasBtn.addEventListener('click', () => {
            DOM.tabSarprasBtn.classList.add('active');
            DOM.tabVehiclesBtn.classList.remove('active');
            DOM.tabComplaintsBtn.classList.remove('active');
            DOM.sarprasSection.classList.remove('hidden');
            DOM.vehiclesSection.classList.add('hidden');
            DOM.complaintsSection.classList.add('hidden');
        });
        
        DOM.tabVehiclesBtn.addEventListener('click', () => {
            DOM.tabVehiclesBtn.classList.add('active');
            DOM.tabSarprasBtn.classList.remove('active');
            DOM.tabComplaintsBtn.classList.remove('active');
            DOM.vehiclesSection.classList.remove('hidden');
            DOM.sarprasSection.classList.add('hidden');
            DOM.complaintsSection.classList.add('hidden');
            renderVehicles();
        });

        DOM.tabComplaintsBtn.addEventListener('click', () => {
            DOM.tabComplaintsBtn.classList.add('active');
            DOM.tabSarprasBtn.classList.remove('active');
            DOM.tabVehiclesBtn.classList.remove('active');
            DOM.complaintsSection.classList.remove('hidden');
            DOM.sarprasSection.classList.add('hidden');
            DOM.vehiclesSection.classList.add('hidden');
            renderComplaints();
        });
    }

    // Filter Pills Pengaduan
    document.querySelectorAll('.filter-pills .pill-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-pills .pill-btn').forEach(p => p.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const filterVal = e.currentTarget.getAttribute('data-filter');
            renderComplaints(DOM.complaintSearchInput ? DOM.complaintSearchInput.value : "", filterVal);
        });
    });

    if (DOM.complaintSearchInput) {
        DOM.complaintSearchInput.addEventListener('input', (e) => {
            renderComplaints(e.target.value, currentComplaintStatusFilter);
        });
    }

    if (DOM.addComplaintBtn) {
        DOM.addComplaintBtn.addEventListener('click', () => {
            DOM.complaintForm.reset();
            const formIdInput = document.getElementById('complaintFormId');
            if (formIdInput) formIdInput.value = '';
            const titleEl = document.getElementById('complaintModalTitle');
            if (titleEl) titleEl.textContent = '📢 Buat Laporan Pengaduan / Aspirasi Sarpras';
            DOM.complaintModal.classList.remove('hidden');
        });
    }
    if (DOM.closeComplaintModal) {
        DOM.closeComplaintModal.addEventListener('click', () => {
            DOM.complaintModal.classList.add('hidden');
        });
    }
    if (DOM.cancelComplaintBtn) {
        DOM.cancelComplaintBtn.addEventListener('click', () => {
            DOM.complaintModal.classList.add('hidden');
        });
    }

    if (DOM.complaintForm) {
        DOM.complaintForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const pwdInput = document.getElementById('complaintPassword');
            const pwd = pwdInput ? pwdInput.value.trim() : '';
            if (pwd !== 'smandacis' && pwd !== 'Andalusia_2') {
                alert("Password verifikasi salah! Silakan masukkan password verifikasi warga sekolah yang berlaku.");
                return;
            }

            const compData = {
                reporter: document.getElementById('complaintReporter').value,
                role: document.getElementById('complaintRole').value,
                contact: document.getElementById('complaintContact').value || '',
                location: document.getElementById('complaintLocation').value,
                category: document.getElementById('complaintCategory').value,
                desc: document.getElementById('complaintDesc').value,
                status: 'Pending',
                createdAt: new Date().toISOString(),
                response: ''
            };

            const editId = document.getElementById('complaintFormId') ? document.getElementById('complaintFormId').value : '';

            const btn = document.getElementById('saveComplaintBtn');
            btn.disabled = true;
            btn.textContent = 'Menyimpan...';

            try {
                if (editId) {
                    const updatedData = {
                        reporter: compData.reporter,
                        role: compData.role,
                        contact: compData.contact,
                        location: compData.location,
                        category: compData.category,
                        desc: compData.desc
                    };
                    await saveToDatabase('complaints', editId, updatedData, true);
                    alert("Laporan pengaduan Anda berhasil diperbarui!");
                } else {
                    await saveToDatabase('complaints', null, compData, false);
                    alert("Laporan pengaduan Anda berhasil dikirim! Tim Sarpras akan segera memverifikasi dan menindaklanjuti laporan Anda.");
                }
                DOM.complaintForm.reset();
                if (document.getElementById('complaintFormId')) document.getElementById('complaintFormId').value = '';
                DOM.complaintModal.classList.add('hidden');
            } catch (err) {
                console.error(err);
                alert("Gagal menyimpan laporan pengaduan.");
            } finally {
                btn.disabled = false;
                btn.textContent = 'Kirim Laporan';
            }
        });
    }

    if (DOM.closeComplaintAdminModal) {
        DOM.closeComplaintAdminModal.addEventListener('click', () => {
            DOM.complaintAdminModal.classList.add('hidden');
        });
    }
    if (DOM.cancelComplaintAdminBtn) {
        DOM.cancelComplaintAdminBtn.addEventListener('click', () => {
            DOM.complaintAdminModal.classList.add('hidden');
        });
    }

    if (DOM.complaintAdminForm) {
        DOM.complaintAdminForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('complaintAdminId').value;
            const updatedData = {
                status: document.getElementById('complaintAdminStatus').value,
                response: document.getElementById('complaintAdminResponse').value
            };

            const btn = document.getElementById('saveComplaintAdminBtn');
            btn.disabled = true;
            btn.textContent = 'Menyimpan...';

            try {
                await saveToDatabase('complaints', id, updatedData, true);
                DOM.complaintAdminModal.classList.add('hidden');
            } catch (err) {
                console.error(err);
                alert("Gagal memperbarui status pengaduan.");
            } finally {
                btn.disabled = false;
                btn.textContent = 'Simpan Status';
            }
        });
    }

    if (DOM.vehicleSearchInput) {
        DOM.vehicleSearchInput.addEventListener('input', (e) => {
            renderVehicles(e.target.value);
        });
    }

    if (DOM.addVehicleBtn) {
        DOM.addVehicleBtn.addEventListener('click', () => {
            openVehicleModal();
        });
    }
    if (DOM.closeVehicleModal) {
        DOM.closeVehicleModal.addEventListener('click', () => {
            DOM.vehicleModal.classList.add('hidden');
        });
    }
    if (DOM.cancelVehicleBtn) {
        DOM.cancelVehicleBtn.addEventListener('click', () => {
            DOM.vehicleModal.classList.add('hidden');
        });
    }

    if (DOM.vehicleForm) {
        DOM.vehicleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const vehData = {
                name: document.getElementById('vehicleName').value,
                plate: document.getElementById('vehiclePlate').value,
                type: document.getElementById('vehicleType').value,
                status: document.getElementById('vehicleStatus').value,
                km: document.getElementById('vehicleKm').value ? parseInt(document.getElementById('vehicleKm').value) : null,
                kmNextOil: document.getElementById('vehicleKmNextOil').value ? parseInt(document.getElementById('vehicleKmNextOil').value) : null,
                lastOilDate: document.getElementById('vehicleLastOilDate').value || null,
                nextOilDate: document.getElementById('vehicleNextOilDate').value || null,
                taxDate: document.getElementById('vehicleTaxDate').value || null,
                plateDate: document.getElementById('vehiclePlateDate').value || null,
                notes: document.getElementById('vehicleNotes').value || ''
            };

            const id = document.getElementById('vehicleId').value;
            const btn = document.getElementById('saveVehicleBtn');
            btn.disabled = true;
            btn.textContent = 'Menyimpan...';

            try {
                if (id) {
                    await saveToDatabase('vehicles', id, vehData, true);
                } else {
                    await saveToDatabase('vehicles', null, vehData, false);
                }
                DOM.vehicleModal.classList.add('hidden');
            } catch (err) {
                console.error(err);
                alert("Gagal menyimpan data kendaraan.");
            } finally {
                btn.disabled = false;
                btn.textContent = 'Simpan Kendaraan';
            }
        });
    }

    document.getElementById('multiDayCheck').addEventListener('change', (e) => {
        const endDateGroup = document.getElementById('endDateGroup');
        const dateLabelMain = document.getElementById('dateLabelMain');
        if(e.target.checked) {
            endDateGroup.classList.remove('hidden');
            dateLabelMain.textContent = 'Mulai Tanggal';
            document.getElementById('eventEndDate').required = true;
        } else {
            endDateGroup.classList.add('hidden');
            dateLabelMain.textContent = 'Tanggal';
            document.getElementById('eventEndDate').required = false;
            document.getElementById('eventEndDate').value = '';
        }
    });

    DOM.searchInput.addEventListener('input', (e) => {
        renderEvents(e.target.value);
    });

    DOM.closeDetailBtn.addEventListener('click', () => {
        DOM.detailPanel.classList.remove('open');
        DOM.panelOverlay.classList.remove('active');
    });
    DOM.panelOverlay.addEventListener('click', () => {
        DOM.detailPanel.classList.remove('open');
        DOM.panelOverlay.classList.remove('active');
        DOM.loginModal.classList.add('hidden');
    });

    DOM.adminLoginBtn.addEventListener('click', () => {
        DOM.loginModal.classList.remove('hidden');
        DOM.panelOverlay.classList.add('active');
        setTimeout(() => {
            if (DOM.adminPassword) DOM.adminPassword.focus();
        }, 100);
    });
    DOM.closeLoginModal.addEventListener('click', () => {
        DOM.loginModal.classList.add('hidden');
        DOM.panelOverlay.classList.remove('active');
    });
    
    const loginForm = document.getElementById('loginForm');
    const handleLoginSubmit = (e) => {
        if (e) e.preventDefault();
        const pwd = DOM.adminPassword ? DOM.adminPassword.value.trim() : '';
        if (pwd === 'Andalusia_2') { 
            toggleAdminMode(true);
            DOM.loginModal.classList.add('hidden');
            DOM.panelOverlay.classList.remove('active');
            DOM.adminPassword.value = '';
            alert("Login Berhasil! Anda sekarang masuk sebagai Super Admin Sarpras.");
        } else if (pwd === 'smandacis') {
            DOM.loginModal.classList.add('hidden');
            DOM.panelOverlay.classList.remove('active');
            DOM.adminPassword.value = '';
            alert("Login Berhasil sebagai Warga Sekolah! Anda dapat membuat laporan pengaduan & aspirasi sarpras.");
            if (DOM.tabComplaintsBtn) DOM.tabComplaintsBtn.click();
            if (DOM.complaintModal) DOM.complaintModal.classList.remove('hidden');
        } else {
            alert("Password otorisasi salah! Silakan periksa kembali password yang Anda masukkan.");
        }
    };

    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
    } else {
        DOM.loginSubmitBtn.addEventListener('click', handleLoginSubmit);
    }

    DOM.adminLogoutBtn.addEventListener('click', () => {
        toggleAdminMode(false);
    });

    DOM.addEventBtn.addEventListener('click', () => {
        openEventModal();
    });
    DOM.closeEventModal.addEventListener('click', () => {
        DOM.eventModal.classList.add('hidden');
    });
    DOM.cancelEventBtn.addEventListener('click', () => {
        DOM.eventModal.classList.add('hidden');
    });

    const formationInput = document.getElementById('eventFormationInput');
    if (formationInput) {
        formationInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(event) {
                const rawResult = event.target.result;
                document.getElementById('eventFormationData').value = rawResult;
                document.getElementById('formationPreviewImg').src = rawResult;
                document.getElementById('formationPreviewContainer').classList.remove('hidden');

                const img = new Image();
                img.onload = function() {
                    try {
                        const canvas = document.createElement('canvas');
                        let width = img.width;
                        let height = img.height;
                        const maxDim = 800;
                        if (width > maxDim || height > maxDim) {
                            if (width > height) {
                                height = Math.round((height * maxDim) / width);
                                width = maxDim;
                            } else {
                                width = Math.round((width * maxDim) / height);
                                height = maxDim;
                            }
                            canvas.width = width;
                            canvas.height = height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, width, height);
                            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                            if (dataUrl && dataUrl.length < rawResult.length) {
                                document.getElementById('eventFormationData').value = dataUrl;
                                document.getElementById('formationPreviewImg').src = dataUrl;
                            }
                        }
                    } catch (err) {
                        console.warn('Kompresi gambar diabaikan:', err);
                    }
                };
                img.src = rawResult;
            };
            reader.readAsDataURL(file);
        });
    }

    const removeFormationBtn = document.getElementById('removeFormationBtn');
    if (removeFormationBtn) {
        removeFormationBtn.addEventListener('click', function() {
            if (document.getElementById('eventFormationInput')) document.getElementById('eventFormationInput').value = '';
            if (document.getElementById('eventFormationData')) document.getElementById('eventFormationData').value = '';
            if (document.getElementById('formationPreviewImg')) document.getElementById('formationPreviewImg').src = '';
            if (document.getElementById('formationPreviewContainer')) document.getElementById('formationPreviewContainer').classList.add('hidden');
        });
    }

    DOM.eventForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const selectedFacilities = facilityChoices ? (facilityChoices.getValue(true) || []) : [];
        const facString = Array.isArray(selectedFacilities) ? selectedFacilities.join(', ') : selectedFacilities;
        
        const eventData = {
            title: document.getElementById('eventTitle').value,
            nomorSurat: document.getElementById('eventNomorSurat').value,
            date: document.getElementById('eventDate').value,
            endDate: document.getElementById('multiDayCheck').checked ? document.getElementById('eventEndDate').value : null,
            time: document.getElementById('eventTime').value,
            facility: facString,
            organizer: document.getElementById('eventOrganizer').value,
            cp: document.getElementById('eventCP').value,
            participants: document.getElementById('eventParticipants').value,
            committee: document.getElementById('eventCommittee').value,
            technical: document.getElementById('eventTechnical').value,
            formationImg: document.getElementById('eventFormationData').value || null
        };

        const id = document.getElementById('eventId').value;
        const btn = document.getElementById('saveEventBtn');
        btn.disabled = true;
        btn.textContent = 'Menyimpan...';

        try {
            if (id) {
                await saveToDatabase('events', id, eventData, true);
            } else {
                await saveToDatabase('events', null, eventData, false);
            }
            DOM.eventModal.classList.add('hidden');
        } catch (error) {
            console.error(error);
            alert("Gagal menyimpan data.");
        } finally {
            btn.disabled = false;
            btn.textContent = 'Simpan';
        }
    });

    DOM.manageFacilitiesBtn.addEventListener('click', () => {
        DOM.facilitiesModal.classList.remove('hidden');
    });
    DOM.closeFacilitiesModal.addEventListener('click', () => {
        DOM.facilitiesModal.classList.add('hidden');
        DOM.newFacilityName.value = '';
        renderFacilityAdminList();
    });
    
    DOM.newFacilityName.addEventListener('input', (e) => {
        renderFacilityAdminList(e.target.value);
    });
    
    DOM.addFacilityBtn.addEventListener('click', async () => {
        const newFac = DOM.newFacilityName.value.trim();
        if (!newFac) return;
        
        const normalizedNew = normalizeFacilityName(newFac);
        const exists = facilities.some(f => normalizeFacilityName(f) === normalizedNew);
        
        if (!exists) {
            facilities.push(newFac);
            DOM.newFacilityName.value = '';
            await saveToDatabase('settings', 'facilities', { list: facilities });
            renderFacilities();
        }
    });

    DOM.importFacilityBtn.addEventListener('click', () => {
        const file = DOM.csvFacilityInput.files[0];
        if (!file) {
            alert('Silakan pilih file CSV terlebih dahulu.');
            return;
        }

        const reader = new FileReader();
        reader.onload = async function(e) {
            const text = e.target.result;
            const rawItems = text.split(/[\r\n,]+/);
            let addedCount = 0;
            
            rawItems.forEach(item => {
                const trimmed = item.trim().replace(/^["']|["']$/g, '');
                if (trimmed) {
                    const normalizedTrimmed = normalizeFacilityName(trimmed);
                    const exists = facilities.some(f => normalizeFacilityName(f) === normalizedTrimmed);
                    if (!exists) {
                        facilities.push(trimmed);
                        addedCount++;
                    }
                }
            });
            
            if (addedCount > 0) {
                await saveToDatabase('settings', 'facilities', { list: facilities });
                renderFacilities();
                alert(`Berhasil mengimpor ${addedCount} fasilitas baru!`);
            } else {
                alert('Tidak ada fasilitas baru yang ditambahkan (data kosong/duplikat).');
            }
            DOM.csvFacilityInput.value = '';
        };
        reader.readAsText(file);
    });
    
    if (DOM.quickAddFacilityBtn) {
        DOM.quickAddFacilityBtn.addEventListener('click', async () => {
            const newFac = DOM.quickAddFacilityInput.value.trim();
            if (!newFac) return;
            
            const normalizedNew = normalizeFacilityName(newFac);
            const exists = facilities.some(f => normalizeFacilityName(f) === normalizedNew);
            
            if (!exists) {
                facilities.push(newFac);
                DOM.quickAddFacilityInput.value = '';
                await saveToDatabase('settings', 'facilities', { list: facilities });
                renderFacilities();
                openMapEditorForFacility(newFac);
                alert(`Fasilitas "${newFac}" berhasil ditambahkan! Silakan atur letak kotaknya di peta.`);
            } else {
                alert(`Fasilitas "${newFac}" sudah ada di dalam daftar.`);
                openMapEditorForFacility(newFac);
            }
        });
    }

    if (DOM.cleanOrphanCoordsBtn) {
        DOM.cleanOrphanCoordsBtn.addEventListener('click', async () => {
            const validKeys = new Set(facilities.map(f => normalizeFacilityName(f)));
            let removedKeys = [];
            
            Object.keys(mapCoordinates).forEach(key => {
                if (!validKeys.has(key)) {
                    removedKeys.push(key);
                    delete mapCoordinates[key];
                }
            });
            
            if (removedKeys.length > 0) {
                await saveToDatabase('settings', 'mapCoordinates', { coords: mapCoordinates });
                populateMapEditorFacilitySelect("");
                alert(`Berhasil membersihkan ${removedKeys.length} kotak koordinat lama (${removedKeys.join(', ')})!`);
            } else {
                alert("Semua kotak koordinat di denah sudah sesuai dengan fasilitas aktif (tidak ada data lama).");
            }
        });
    }
}

function openEventModal(event = null) {
    DOM.eventForm.reset();
    if(facilityChoices) facilityChoices.removeActiveItems();
    document.getElementById('eventId').value = '';
    document.getElementById('eventModalTitle').textContent = 'Tambah Acara';
    document.getElementById('multiDayCheck').checked = false;
    document.getElementById('endDateGroup').classList.add('hidden');
    document.getElementById('dateLabelMain').textContent = 'Tanggal';
    document.getElementById('eventEndDate').required = false;
    if (document.getElementById('eventFormationInput')) document.getElementById('eventFormationInput').value = '';
    if (document.getElementById('eventFormationData')) document.getElementById('eventFormationData').value = '';
    if (document.getElementById('formationPreviewImg')) document.getElementById('formationPreviewImg').src = '';
    if (document.getElementById('formationPreviewContainer')) document.getElementById('formationPreviewContainer').classList.add('hidden');

    if (event) {
        document.getElementById('eventModalTitle').textContent = 'Edit Acara';
        document.getElementById('eventId').value = event.id;
        document.getElementById('eventTitle').value = event.title;
        document.getElementById('eventNomorSurat').value = event.nomorSurat || '';
        document.getElementById('eventDate').value = event.date;
        
        if(event.endDate) {
            document.getElementById('multiDayCheck').checked = true;
            document.getElementById('endDateGroup').classList.remove('hidden');
            document.getElementById('dateLabelMain').textContent = 'Mulai Tanggal';
            document.getElementById('eventEndDate').required = true;
            document.getElementById('eventEndDate').value = event.endDate;
        }

        document.getElementById('eventTime').value = event.time || '';
        if (event.facility && facilityChoices) {
            let facArr = [];
            if (Array.isArray(event.facility)) {
                facArr = event.facility;
            } else if (typeof event.facility === 'string') {
                facArr = event.facility.split(',').map(f => f.trim()).filter(Boolean);
            }
            facilityChoices.setChoiceByValue(facArr);
        }
        document.getElementById('eventOrganizer').value = event.organizer;
        document.getElementById('eventCP').value = event.cp || '';
        document.getElementById('eventParticipants').value = event.participants || '';
        document.getElementById('eventCommittee').value = event.committee || '';
        document.getElementById('eventTechnical').value = event.technical || '';
        if (event.formationImg) {
            document.getElementById('eventFormationData').value = event.formationImg;
            document.getElementById('formationPreviewImg').src = event.formationImg;
            document.getElementById('formationPreviewContainer').classList.remove('hidden');
        }
    }

    DOM.eventModal.classList.remove('hidden');
}

// --- Map Editor Logic ---
let isDragging = false;
let isResizing = false;
let dragStartX, dragStartY;
let initialLeft, initialTop, initialWidth, initialHeight;

function openMapEditorForFacility(facName = "") {
    DOM.mapEditorModal.classList.remove('hidden');
    populateMapEditorFacilitySelect(facName);
}

function populateMapEditorFacilitySelect(selectedFacName = "") {
    DOM.editorFacilitySelect.innerHTML = '<option value="">-- Pilih Fasilitas untuk Dipetakan --</option>';
    
    const sorted = [...facilities].sort((a, b) => a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' }));
    const validKeys = new Set();
    
    sorted.forEach(fac => {
        const option = document.createElement('option');
        option.value = fac;
        const norm = normalizeFacilityName(fac);
        validKeys.add(norm);
        const hasCoords = !!mapCoordinates[norm];
        option.textContent = `${fac} ${hasCoords ? '📍' : ''}`;
        if (fac === selectedFacName || (selectedFacName && norm === normalizeFacilityName(selectedFacName))) {
            option.selected = true;
        }
        DOM.editorFacilitySelect.appendChild(option);
    });

    Object.keys(mapCoordinates).forEach(key => {
        if (!validKeys.has(key)) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = `⚠️ [Data Lama] ${key} 📍`;
            if (key === selectedFacName || key === normalizeFacilityName(selectedFacName)) {
                option.selected = true;
            }
            DOM.editorFacilitySelect.appendChild(option);
        }
    });

    DOM.editorFacilitySelect.dispatchEvent(new Event('change'));
}

function renderEditorBackgroundHighlights(activeFac = null) {
    const oldBg = DOM.mapEditorWrapper.querySelectorAll('.editor-bg-highlight');
    oldBg.forEach(el => el.remove());

    Object.keys(mapCoordinates).forEach(key => {
        if (key === activeFac) return;
        const coords = mapCoordinates[key];
        const highlight = document.createElement('div');
        highlight.className = 'map-highlight editor-bg-highlight';
        highlight.style.top = coords.top;
        highlight.style.left = coords.left;
        highlight.style.width = coords.width;
        highlight.style.height = coords.height;
        highlight.title = `${key} (Klik untuk pilih & edit/hapus)`;
        
        highlight.addEventListener('click', () => {
            const options = Array.from(DOM.editorFacilitySelect.options);
            const matchingOption = options.find(opt => normalizeFacilityName(opt.value) === key || opt.value === key);
            
            if (matchingOption) {
                DOM.editorFacilitySelect.value = matchingOption.value;
                DOM.editorFacilitySelect.dispatchEvent(new Event('change'));
            } else {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = `⚠️ [Data Lama] ${key} 📍`;
                DOM.editorFacilitySelect.appendChild(option);
                DOM.editorFacilitySelect.value = key;
                DOM.editorFacilitySelect.dispatchEvent(new Event('change'));
            }
        });

        DOM.mapEditorWrapper.appendChild(highlight);
    });
}

DOM.mapEditorBtn.addEventListener('click', () => {
    openMapEditorForFacility();
});

DOM.closeMapEditorModal.addEventListener('click', () => {
    DOM.mapEditorModal.classList.add('hidden');
    DOM.editableHighlight.style.display = 'none';
    DOM.editorFacilitySelect.value = '';
    renderEditorBackgroundHighlights(null);
});

DOM.editorFacilitySelect.addEventListener('change', (e) => {
    const fac = e.target.value;
    if (!fac) {
        DOM.editableHighlight.style.display = 'none';
        DOM.deleteMapCoordsBtn.classList.add('hidden');
        renderEditorBackgroundHighlights(null);
        return;
    }
    
    const normalizedFac = normalizeFacilityName(fac);
    DOM.editableHighlight.style.display = 'block';
    renderEditorBackgroundHighlights(normalizedFac);
    
    const targetCoords = mapCoordinates[normalizedFac] || mapCoordinates[fac];
    
    if (targetCoords) {
        DOM.editableHighlight.style.top = targetCoords.top;
        DOM.editableHighlight.style.left = targetCoords.left;
        DOM.editableHighlight.style.width = targetCoords.width;
        DOM.editableHighlight.style.height = targetCoords.height;
        DOM.deleteMapCoordsBtn.classList.remove('hidden');
    } else {
        DOM.editableHighlight.style.top = '40%';
        DOM.editableHighlight.style.left = '40%';
        DOM.editableHighlight.style.width = '15%';
        DOM.editableHighlight.style.height = '15%';
        DOM.deleteMapCoordsBtn.classList.add('hidden');
    }
});

const handleDragStart = (clientX, clientY, target) => {
    if (target.classList.contains('resize-handle')) {
        isResizing = true;
    } else {
        isDragging = true;
    }
    
    dragStartX = clientX;
    dragStartY = clientY;
    
    initialLeft = parseFloat(DOM.editableHighlight.style.left) || 40;
    initialTop = parseFloat(DOM.editableHighlight.style.top) || 40;
    initialWidth = parseFloat(DOM.editableHighlight.style.width) || 15;
    initialHeight = parseFloat(DOM.editableHighlight.style.height) || 15;
};

const handleDragMove = (clientX, clientY) => {
    if (!isDragging && !isResizing) return;
    
    const wrapperRect = DOM.mapEditorWrapper.getBoundingClientRect();
    const dx = clientX - dragStartX;
    const dy = clientY - dragStartY;
    
    const dxPercent = (dx / wrapperRect.width) * 100;
    const dyPercent = (dy / wrapperRect.height) * 100;
    
    if (isDragging) {
        let newLeft = initialLeft + dxPercent;
        let newTop = initialTop + dyPercent;
        
        newLeft = Math.max(0, Math.min(newLeft, 100 - initialWidth));
        newTop = Math.max(0, Math.min(newTop, 100 - initialHeight));
        
        DOM.editableHighlight.style.left = newLeft + '%';
        DOM.editableHighlight.style.top = newTop + '%';
    } else if (isResizing) {
        let newWidth = initialWidth + dxPercent;
        let newHeight = initialHeight + dyPercent;
        
        newWidth = Math.max(2, Math.min(newWidth, 100 - initialLeft));
        newHeight = Math.max(2, Math.min(newHeight, 100 - initialTop));
        
        DOM.editableHighlight.style.width = newWidth + '%';
        DOM.editableHighlight.style.height = newHeight + '%';
    }
};

DOM.editableHighlight.addEventListener('mousedown', (e) => {
    handleDragStart(e.clientX, e.clientY, e.target);
    e.preventDefault();
});

DOM.editableHighlight.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length === 1) {
        handleDragStart(e.touches[0].clientX, e.touches[0].clientY, e.target);
    }
}, { passive: true });

window.addEventListener('mousemove', (e) => {
    handleDragMove(e.clientX, e.clientY);
});

window.addEventListener('touchmove', (e) => {
    if ((isDragging || isResizing) && e.touches && e.touches.length === 1) {
        handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
    }
}, { passive: true });

window.addEventListener('mouseup', () => {
    isDragging = false;
    isResizing = false;
});

window.addEventListener('touchend', () => {
    isDragging = false;
    isResizing = false;
});

DOM.saveMapCoordsBtn.addEventListener('click', async () => {
    const fac = DOM.editorFacilitySelect.value;
    if (!fac) {
        window.alert("Pilih fasilitas terlebih dahulu.");
        return;
    }

    const normalizedFac = normalizeFacilityName(fac);
    const originalBtnContent = DOM.saveMapCoordsBtn.innerHTML;
    DOM.saveMapCoordsBtn.disabled = true;
    DOM.editorFacilitySelect.disabled = true;
    DOM.saveMapCoordsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';

    mapCoordinates[normalizedFac] = {
        top: DOM.editableHighlight.style.top,
        left: DOM.editableHighlight.style.left,
        width: DOM.editableHighlight.style.width,
        height: DOM.editableHighlight.style.height
    };

    try {
        await saveToDatabase('settings', 'mapCoordinates', { coords: mapCoordinates });
    } finally {
        DOM.saveMapCoordsBtn.disabled = false;
        DOM.editorFacilitySelect.disabled = false;
        DOM.saveMapCoordsBtn.innerHTML = originalBtnContent;
    }

    populateMapEditorFacilitySelect(fac);
    renderFacilities();
    DOM.editorFacilitySelect.focus();
});

DOM.deleteMapCoordsBtn.addEventListener('click', async () => {
    const fac = DOM.editorFacilitySelect.value;
    if (!fac) return;
    
    if (!confirm(`Apakah Anda yakin ingin menghapus koordinat denah untuk: "${fac}"?`)) {
        return;
    }
    
    const normalizedFac = normalizeFacilityName(fac);
    delete mapCoordinates[normalizedFac];
    delete mapCoordinates[fac];
    
    await saveToDatabase('settings', 'mapCoordinates', { coords: mapCoordinates });
    
    alert(`Koordinat denah untuk "${fac}" berhasil dihapus.`);
    populateMapEditorFacilitySelect("");
    renderFacilities();
});

document.addEventListener('DOMContentLoaded', init);
