// Mengambil konfigurasi dari window (yang di-set oleh firebase-config.js)
const { firebaseConfig, isFirebaseConfigured } = window;

// --- State Management ---
let isAdmin = false;
let db = null;
let useLocalStorageFallback = !isFirebaseConfigured;

let events = [];
let facilities = ["Aula", "Lapang Upacara", "Lapang Tenis", "Mesjid", "Lab Komputer 1"];
let facilityChoices = null; // Instance for Choices.js
let cmsContent = {
    headerTitle: "SMAN 2 CIAMIS",
    headerSubtitle: "Sistem Informasi Penggunaan Sarana & Prasarana",
    mainHeading: "Jadwal Penggunaan Mendatang",
    footerText: "© 2026 SMAN 2 Ciamis. All rights reserved."
};

// --- Koordinat Peta (Persentase relatif terhadap gambar) ---
let mapCoordinates = {
    "aula": { top: "20.7%", left: "50.1%", width: "6.8%", height: "2.4%" },
    "lapangupacara": { top: "28%", left: "51.2%", width: "20.5%", height: "20%" },
    "lapangtenis": { top: "34.5%", left: "37%", width: "12%", height: "21%" },
    "mesjid": { top: "23.5%", left: "29%", width: "11%", height: "9%" },
    
    // GOR & Sekitarnya
    "gor": { top: "61%", left: "24%", width: "5.5%", height: "5.5%" },
    
    // Parkiran
    "tempatparkirmotor": { top: "18.5%", left: "49%", width: "27%", height: "2.2%" },
    "parkiranbelakang": { top: "18.5%", left: "49%", width: "27%", height: "2.2%" },
    "parkirbelakang": { top: "18.5%", left: "49%", width: "27%", height: "2.2%" },
    "parkirmobil": { top: "26%", left: "72.5%", width: "3.5%", height: "23%" },
    "parkirmotor": { top: "59.5%", left: "51.5%", width: "20.5%", height: "4%" },
    
    // Blok Kelas X E
    "xe1": { top: "71.5%", left: "39%", width: "4%", height: "4%" },
    "xe2": { top: "71.5%", left: "34%", width: "4%", height: "4%" },
    "xe3": { top: "71.5%", left: "29%", width: "5%", height: "4%" },
    "xe4": { top: "71.5%", left: "23.5%", width: "5.5%", height: "4%" },
    "xe5": { top: "66.5%", left: "23.5%", width: "5.5%", height: "4.5%" },
    "xe6": { top: "66.5%", left: "19%", width: "4.5%", height: "4.5%" },
    "xe7": { top: "71%", left: "19%", width: "4.5%", height: "9.5%" },
    "xe8": { top: "76%", left: "23.5%", width: "5.5%", height: "4.5%" },
    "xe9": { top: "76%", left: "29%", width: "5%", height: "4.5%" },
    "xe10": { top: "76%", left: "34%", width: "4.5%", height: "4.5%" },
    "xe11": { top: "69.5%", left: "56.5%", width: "5%", height: "4.5%" },
    "xe12": { top: "69.5%", left: "61.5%", width: "5%", height: "4.5%" },
    
    // Blok Kelas Atas & Kanan (Sampel F)
    "xif8": { top: "18%", left: "69.5%", width: "4%", height: "4%" },
    "xif9": { top: "18%", left: "64%", width: "4.5%", height: "4%" },
    "xif10": { top: "18%", left: "59%", width: "4.5%", height: "4%" },
    "kelas": { top: "66%", left: "19%", width: "20%", height: "15%" } // Alias umum kelas kiri bawah
};

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
    mapEditorWrapper: document.getElementById('mapEditorWrapper'),
    editableHighlight: document.getElementById('editableHighlight'),
    
    cmsEditables: document.querySelectorAll('.cms-editable')
};

// --- Initialization ---
async function init() {
    if (!isFirebaseConfigured) {
        alert("PERHATIAN: Konfigurasi Firebase belum disetel. Aplikasi berjalan menggunakan LocalStorage sementara.");
        loadFromLocalStorage();
    } else {
        try {
            // Inisialisasi Firebase menggunakan Compat API (mendukung file://)
            firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();
            await loadFromFirebase();
        } catch (error) {
            console.error("Gagal inisialisasi Firebase:", error);
            alert("Gagal terhubung ke Firebase. Menggunakan mode offline sementara.");
            useLocalStorageFallback = true;
            loadFromLocalStorage();
        }
    }
    
    setupEventListeners();
    renderApp();
}

// --- Data Fetching (Firebase / LocalStorage) ---
async function loadFromFirebase() {
    DOM.loadingIndicator.classList.remove('hidden');
    
    // Listen to CMS Content
    db.collection("settings").doc("cms").onSnapshot((doc) => {
        if (doc.exists) {
            cmsContent = { ...cmsContent, ...doc.data() };
            applyCmsContent();
        } else {
            db.collection("settings").doc("cms").set(cmsContent);
        }
    });

    // Listen to Facilities
    db.collection("settings").doc("facilities").onSnapshot((doc) => {
        if (doc.exists) {
            facilities = doc.data().list || facilities;
            renderFacilities();
        } else {
            db.collection("settings").doc("facilities").set({ list: facilities });
        }
    });

    // Listen to Map Coordinates
    db.collection("settings").doc("mapCoordinates").onSnapshot((doc) => {
        if (doc.exists) {
            mapCoordinates = { ...mapCoordinates, ...doc.data().coords };
        } else {
            db.collection("settings").doc("mapCoordinates").set({ coords: mapCoordinates });
        }
    });

    // Listen to Events
    db.collection("events").onSnapshot((snapshot) => {
        events = [];
        snapshot.forEach((doc) => {
            events.push({ id: doc.id, ...doc.data() });
        });
        
        events.sort((a, b) => new Date(a.date) - new Date(b.date));
        renderEvents();
        DOM.loadingIndicator.classList.add('hidden');
    });
}

function loadFromLocalStorage() {
    const lsEvents = localStorage.getItem('sardas_events');
    const lsFacilities = localStorage.getItem('sardas_facilities');
    const lsCms = localStorage.getItem('sardas_cms');
    const lsMap = localStorage.getItem('sardas_mapCoordinates');
    
    if (lsEvents) events = JSON.parse(lsEvents);
    if (lsFacilities) facilities = JSON.parse(lsFacilities);
    if (lsCms) cmsContent = JSON.parse(lsCms);
    if (lsMap) mapCoordinates = { ...mapCoordinates, ...JSON.parse(lsMap).coords };
    
    applyCmsContent();
    renderFacilities();
    renderEvents();
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
        } else if (collectionName === 'settings') {
            if (docId === 'facilities') {
                facilities = data.list;
                localStorage.setItem('sardas_facilities', JSON.stringify(facilities));
                renderFacilities();
            } else if (docId === 'cms') {
                cmsContent = data;
                localStorage.setItem('sardas_cms', JSON.stringify(cmsContent));
                applyCmsContent();
            }
        }
    } else {
        if (collectionName === 'events') {
            if (isUpdate) {
                await db.collection("events").doc(docId).update(data);
            } else {
                await db.collection("events").add(data);
            }
        } else {
            await db.collection("settings").doc(docId).set(data);
        }
    }
}

async function deleteFromDatabase(collectionName, docId) {
    if (useLocalStorageFallback) {
        if (collectionName === 'events') {
            events = events.filter(e => e.id !== docId);
            localStorage.setItem('sardas_events', JSON.stringify(events));
            renderEvents();
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
}

function applyCmsContent() {
    DOM.cmsEditables.forEach(el => {
        const key = el.getAttribute('data-cms-key');
        if (cmsContent[key]) {
            el.textContent = cmsContent[key];
        }
    });
}

function renderFacilities() {
    if (facilityChoices) {
        facilityChoices.destroy();
    }
    DOM.eventFacility.innerHTML = '';
    facilities.forEach(f => {
        DOM.eventFacility.innerHTML += `<option value="${f}">${f}</option>`;
    });
    
    // Inisialisasi plugin select interaktif
    facilityChoices = new Choices(DOM.eventFacility, {
        removeItemButton: true,
        placeholderValue: 'Cari & pilih fasilitas...',
        searchPlaceholderValue: 'Ketik nama fasilitas...',
        itemSelectText: 'Pilih',
        noResultsText: 'Tidak ditemukan',
        noChoicesText: 'Semua fasilitas sudah dipilih'
    });

    renderFacilityAdminList();
}

function normalizeFacilityName(name) {
    return name.toLowerCase().replace(/[\s-]/g, '');
}

function renderFacilityAdminList(filterText = "") {
    DOM.facilitiesList.innerHTML = '';
    const lowerFilter = filterText.toLowerCase();
    const normalizedFilter = normalizeFacilityName(filterText);
    
    let hasExactMatch = false;

    facilities.forEach((f, idx) => {
        const normalizedF = normalizeFacilityName(f);
        if (f.toLowerCase().includes(lowerFilter) || normalizedF.includes(normalizedFilter)) {
            if (normalizedF === normalizedFilter) hasExactMatch = true;
            
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${f}</span>
                <button class="action-icon delete btn-sm" data-idx="${idx}" title="Hapus"><i class="fas fa-trash"></i></button>
            `;
            DOM.facilitiesList.appendChild(li);
        }
    });

    DOM.facilitiesList.querySelectorAll('.delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const idx = e.currentTarget.getAttribute('data-idx');
            facilities.splice(idx, 1);
            await saveToDatabase('settings', 'facilities', { list: facilities });
        });
    });
    
    // UI Feedback for Exact Match
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
    
    // Memastikan urutan dari yang terbaru (paling akan datang) ke yang paling lama (terlewati)
    filteredEvents.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filterText) {
        const lowerFilter = filterText.toLowerCase();
        filteredEvents = filteredEvents.filter(e => 
            e.title.toLowerCase().includes(lowerFilter) || 
            e.facility.toLowerCase().includes(lowerFilter) ||
            e.organizer.toLowerCase().includes(lowerFilter)
        );
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
        
        // Cek apakah acara sudah terlewati (berdasarkan endDate atau date)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const eventEnd = event.endDate ? new Date(event.endDate) : new Date(event.date);
        const isPast = eventEnd < today;
        
        const card = document.createElement('div');
        card.className = `event-card glass ${isPast ? 'past-event' : ''}`;
        card.innerHTML = `
            <div class="event-date">${dateStr} ${isPast ? '<span class="badge" style="background: #ef4444; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 5px;">Selesai</span>' : ''}</div>
            <div class="event-title">${event.title}</div>
            <div class="event-facility">${event.facility}</div>
            <div class="event-footer">
                <span><i class="fas fa-user"></i> ${event.organizer}</span>
            </div>
            <div class="card-actions">
                <button class="action-icon edit edit-event-btn" data-id="${event.id}" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="action-icon delete delete-event-btn" data-id="${event.id}" title="Hapus"><i class="fas fa-trash"></i></button>
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

function showEventDetail(event, dateStr) {
    document.getElementById('detailTitle').textContent = event.title;
    document.getElementById('detailDate').textContent = dateStr;
    document.getElementById('detailTime').textContent = event.time || '-';
    document.getElementById('detailFacility').textContent = event.facility;
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
        document.body.classList.add('admin-mode');
        DOM.adminLoginBtn.classList.add('hidden');
        DOM.adminLogoutBtn.classList.remove('hidden');
        DOM.adminActions.classList.remove('hidden');
        enableCmsEditing();
    } else {
        document.body.classList.remove('admin-mode');
        DOM.adminLoginBtn.classList.remove('hidden');
        DOM.adminLogoutBtn.classList.add('hidden');
        DOM.adminActions.classList.add('hidden');
        disableCmsEditing();
    }
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
    });
    DOM.closeLoginModal.addEventListener('click', () => {
        DOM.loginModal.classList.add('hidden');
        DOM.panelOverlay.classList.remove('active');
    });
    DOM.loginSubmitBtn.addEventListener('click', () => {
        const pwd = DOM.adminPassword.value;
        if (pwd === 'Andalusia_2') { 
            toggleAdminMode(true);
            DOM.loginModal.classList.add('hidden');
            DOM.panelOverlay.classList.remove('active');
            DOM.adminPassword.value = '';
        } else {
            alert('Password salah!');
        }
    });
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
                // Langsung simpan hasil pembacaan asli ke form & tampilkan preview agar terjamin tersimpan saat tombol Simpan diklik
                document.getElementById('eventFormationData').value = rawResult;
                document.getElementById('formationPreviewImg').src = rawResult;
                document.getElementById('formationPreviewContainer').classList.remove('hidden');

                // Lakukan kompresi cerdas jika format dibagikan mendukung Image()
                const img = new Image();
                img.onload = function() {
                    try {
                        const canvas = document.createElement('canvas');
                        let width = img.width;
                        let height = img.height;
                        const maxDim = 800; // Kompresi maksimal 800px
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
                        console.warn('Kompresi kanvas diabaikan, menggunakan file gambar asli:', err);
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
        DOM.newFacilityName.value = ''; // Reset on close
        renderFacilityAdminList(); // Reset list on close
    });
    
    // Live Filtering pada input nama fasilitas
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
                alert(`Berhasil mengimpor ${addedCount} fasilitas baru!`);
            } else {
                alert('Tidak ada fasilitas baru yang ditambahkan (data kosong/duplikat).');
            }
            DOM.csvFacilityInput.value = '';
        };
        reader.readAsText(file);
    });
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
            const facArr = event.facility.split(',').map(f => f.trim());
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

function renderEditorBackgroundHighlights(activeFac = null) {
    // Hapus highlight background yang lama
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
        highlight.title = key + " (Klik untuk mengedit)";
        
        highlight.addEventListener('click', () => {
            const options = Array.from(DOM.editorFacilitySelect.options);
            const matchingOption = options.find(opt => normalizeFacilityName(opt.value) === key);
            
            if (matchingOption) {
                DOM.editorFacilitySelect.value = matchingOption.value;
                DOM.editorFacilitySelect.dispatchEvent(new Event('change'));
            } else {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = key;
                DOM.editorFacilitySelect.appendChild(option);
                DOM.editorFacilitySelect.value = key;
                DOM.editorFacilitySelect.dispatchEvent(new Event('change'));
            }
        });

        DOM.mapEditorWrapper.appendChild(highlight);
    });
}

DOM.mapEditorBtn.addEventListener('click', () => {
    DOM.mapEditorModal.classList.remove('hidden');
    
    DOM.editorFacilitySelect.innerHTML = '<option value="">-- Pilih Fasilitas --</option>';
    facilities.forEach(fac => {
        const option = document.createElement('option');
        option.value = fac;
        option.textContent = fac;
        DOM.editorFacilitySelect.appendChild(option);
    });
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
    
    if (mapCoordinates[normalizedFac]) {
        const coords = mapCoordinates[normalizedFac];
        DOM.editableHighlight.style.top = coords.top;
        DOM.editableHighlight.style.left = coords.left;
        DOM.editableHighlight.style.width = coords.width;
        DOM.editableHighlight.style.height = coords.height;
        DOM.deleteMapCoordsBtn.classList.remove('hidden');
    } else {
        DOM.editableHighlight.style.top = '40%';
        DOM.editableHighlight.style.left = '40%';
        DOM.editableHighlight.style.width = '20%';
        DOM.editableHighlight.style.height = '20%';
        DOM.deleteMapCoordsBtn.classList.add('hidden');
    }
});

DOM.editableHighlight.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('resize-handle')) {
        isResizing = true;
    } else {
        isDragging = true;
    }
    
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    
    initialLeft = parseFloat(DOM.editableHighlight.style.left) || 40;
    initialTop = parseFloat(DOM.editableHighlight.style.top) || 40;
    initialWidth = parseFloat(DOM.editableHighlight.style.width) || 20;
    initialHeight = parseFloat(DOM.editableHighlight.style.height) || 20;
    
    e.preventDefault();
});

window.addEventListener('mousemove', (e) => {
    if (!isDragging && !isResizing) return;
    
    const wrapperRect = DOM.mapEditorWrapper.getBoundingClientRect();
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    
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
});

window.addEventListener('mouseup', () => {
    isDragging = false;
    isResizing = false;
});

DOM.saveMapCoordsBtn.addEventListener('click', async () => {
    const fac = DOM.editorFacilitySelect.value;
    if (!fac) {
        alert("Pilih fasilitas terlebih dahulu.");
        return;
    }
    
    const normalizedFac = normalizeFacilityName(fac);
    
    mapCoordinates[normalizedFac] = {
        top: DOM.editableHighlight.style.top,
        left: DOM.editableHighlight.style.left,
        width: DOM.editableHighlight.style.width,
        height: DOM.editableHighlight.style.height
    };
    
    await saveToDatabase('settings', 'mapCoordinates', { coords: mapCoordinates });
    
    alert(`Koordinat untuk ${fac} berhasil disimpan!\nAnda dapat memilih fasilitas lain untuk diedit.`);
    renderEditorBackgroundHighlights(normalizedFac);
    DOM.deleteMapCoordsBtn.classList.remove('hidden');
});

DOM.deleteMapCoordsBtn.addEventListener('click', async () => {
    const fac = DOM.editorFacilitySelect.value;
    if (!fac) return;
    
    if (!confirm(`Apakah Anda yakin ingin menghapus kotak visualisasi untuk fasilitas: ${fac}?`)) {
        return;
    }
    
    const normalizedFac = normalizeFacilityName(fac);
    delete mapCoordinates[normalizedFac];
    
    await saveToDatabase('settings', 'mapCoordinates', { coords: mapCoordinates });
    
    alert(`Kotak visualisasi untuk ${fac} berhasil dihapus.`);
    DOM.editorFacilitySelect.value = '';
    DOM.editorFacilitySelect.dispatchEvent(new Event('change'));
});

document.addEventListener('DOMContentLoaded', init);
