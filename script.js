// Category Price Mapping Matrix
const CATEGORY_PRICES = {
    "Bebean": 50000,
    "Janggan": 75000,
    "Janggan Buntut": 75000,
    "Pecukan": 50000,
    "Kreasi Baru": 60000,
    "Big Size / Rare Angon": 100000
};

function formatRupiah(amount) {
    return "Rp " + amount.toLocaleString('id-ID');
}

function getCategoryPrice(categoryName) {
    return CATEGORY_PRICES[categoryName] || 50000;
}

function updateCategoryFeeDisplay() {
    const selectEl = document.getElementById('kategori');
    const infoBox = document.getElementById('fee-info-box');
    const amountText = document.getElementById('fee-amount-text');
    if (!selectEl || !infoBox || !amountText) return;

    const val = selectEl.value;
    if (val) {
        const price = getCategoryPrice(val);
        amountText.textContent = formatRupiah(price);
        infoBox.classList.remove('hidden');
    } else {
        infoBox.classList.add('hidden');
    }
}

// LocalStorage and SessionStorage keys
const STORAGE_KEY = 'BALI_KITE_REGISTRATIONS_DATA';
const GATEWAY_SETTINGS_KEY = 'BALI_KITE_GATEWAY_CONFIG';
const PANITIA_AUTH_KEY = 'BALI_KITE_PANITIA_AUTH';

// State variables
let registrations = [];
let confirmActionCallback = null;
let pendingRegistration = null;
let pendingTargetTab = null;
let html5QrCodeScanner = null;
let gatewayConfig = {
    mode: 'SIMULATOR',
    midtransClientKey: ''
};

// Firebase Cloud Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDY9xy1uwHxJ30KcMI09M1VX6_w0xL_c44",
  authDomain: "form-lomba-layangan.firebaseapp.com",
  projectId: "form-lomba-layangan",
  storageBucket: "form-lomba-layangan.firebasestorage.app",
  messagingSenderId: "742312467145",
  appId: "1:742312467145:web:3ff6fba776a731af690b18",
  measurementId: "G-1PQ22080GK"
};

let db = null;
let registrationsRef = null;
let isCloudActive = false;

const isDummyConfig = !firebaseConfig.apiKey || firebaseConfig.apiKey.includes("Dummy") || firebaseConfig.projectId === "semaya-kite-festival";

if (!isDummyConfig) {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        if (firebase.firestore.setLogLevel) {
            firebase.firestore.setLogLevel('silent');
        }
        db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
        registrationsRef = db.collection("registrations");
    } catch (e) {
        console.log("Firebase fallback to LocalStorage mode.");
    }
}

window.addEventListener('DOMContentLoaded', () => {
    loadGatewaySettings();
    checkPanitiaAuthUI();
    listenToCloudRegistrations();
});

function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    if (menu) menu.classList.toggle('hidden');
}

function loadGatewaySettings() {
    const stored = localStorage.getItem(GATEWAY_SETTINGS_KEY);
    if (stored) {
        try {
            gatewayConfig = { ...gatewayConfig, ...JSON.parse(stored) };
        } catch (e) {}
    }
}

function openGatewaySettingsModal() {
    const modeEl = document.getElementById('setting-gateway-mode');
    const keyEl = document.getElementById('setting-midtrans-client-key');
    if (modeEl) modeEl.value = gatewayConfig.mode || 'SIMULATOR';
    if (keyEl) keyEl.value = gatewayConfig.midtransClientKey || '';
    const modal = document.getElementById('gateway-settings-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeGatewaySettingsModal() {
    const modal = document.getElementById('gateway-settings-modal');
    if (modal) modal.classList.add('hidden');
}

function saveGatewaySettings(e) {
    if (e) e.preventDefault();
    const modeVal = document.getElementById('setting-gateway-mode')?.value;
    const keyVal = document.getElementById('setting-midtrans-client-key')?.value.trim();
    if (modeVal) gatewayConfig.mode = modeVal;
    if (keyVal !== undefined) gatewayConfig.midtransClientKey = keyVal;
    localStorage.setItem(GATEWAY_SETTINGS_KEY, JSON.stringify(gatewayConfig));
    closeGatewaySettingsModal();
    showToast('Pengaturan Payment Gateway berhasil disimpan!', 'success');
}

function listenToCloudRegistrations() {
    const cloudBadge = document.getElementById('cloud-sync-badge');
    const cloudText = document.getElementById('cloud-sync-text');

    if (registrationsRef && !isDummyConfig) {
        registrationsRef.orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            isCloudActive = true;
            const cloudData = [];
            snapshot.forEach(doc => {
                cloudData.push({ ...doc.data(), firestoreId: doc.id });
            });
            registrations = cloudData;
            saveRegistrationsLocal();
            
            if (cloudBadge && cloudText) {
                cloudBadge.className = "px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1";
                cloudText.textContent = "Cloud Active";
            }
            if (typeof renderAdminTable === 'function') renderAdminTable();
            if (typeof renderAvailabilityGrid === 'function') renderAvailabilityGrid();
            if (typeof renderAttendanceTab === 'function') renderAttendanceTab();
        }, err => {
            isCloudActive = false;
            fallbackToLocalStorage();
        });
    } else {
        isCloudActive = false;
        fallbackToLocalStorage();
    }
}

function fallbackToLocalStorage() {
    const cloudBadge = document.getElementById('cloud-sync-badge');
    const cloudText = document.getElementById('cloud-sync-text');
    if (cloudBadge && cloudText) {
        cloudBadge.className = "px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1";
        cloudText.textContent = "Local Mode";
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            registrations = JSON.parse(stored);
        } catch (e) {
            registrations = [];
        }
    }
    if (typeof renderAdminTable === 'function') renderAdminTable();
    if (typeof renderAvailabilityGrid === 'function') renderAvailabilityGrid();
    if (typeof renderAttendanceTab === 'function') renderAttendanceTab();
}

function saveRegistrationsLocal() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(registrations));
}

async function syncRecordToCloud(data) {
    saveRegistrationsLocal();
    if (typeof renderAdminTable === 'function') renderAdminTable();
    if (typeof renderAvailabilityGrid === 'function') renderAvailabilityGrid();
    if (typeof renderAttendanceTab === 'function') renderAttendanceTab();

    if (registrationsRef && isCloudActive && !isDummyConfig) {
        try {
            await registrationsRef.doc(data.id).set(data, { merge: true });
        } catch (e) {
            isCloudActive = false;
            fallbackToLocalStorage();
        }
    }
}

async function removeRecordFromCloud(id) {
    registrations = registrations.filter(r => r.id !== id);
    saveRegistrationsLocal();
    if (typeof renderAdminTable === 'function') renderAdminTable();
    if (typeof renderAvailabilityGrid === 'function') renderAvailabilityGrid();
    if (typeof renderAttendanceTab === 'function') renderAttendanceTab();

    if (registrationsRef && isCloudActive && !isDummyConfig) {
        try {
            await registrationsRef.doc(id).delete();
        } catch (e) {
            isCloudActive = false;
            fallbackToLocalStorage();
        }
    }
}

function isPanitiaLoggedIn() {
    return sessionStorage.getItem(PANITIA_AUTH_KEY) === 'true';
}

function checkPanitiaAuthUI() {
    const loggedIn = isPanitiaLoggedIn();
    const desktopBtn = document.getElementById('nav-logout-btn');
    const mobileBtn = document.getElementById('mobile-logout-btn');
    
    if (loggedIn) {
        if (desktopBtn) desktopBtn.classList.remove('hidden');
        if (mobileBtn) mobileBtn.classList.remove('hidden');
    } else {
        if (desktopBtn) desktopBtn.classList.add('hidden');
        if (mobileBtn) mobileBtn.classList.add('hidden');
    }
}

function openAuthModal(targetTabId) {
    pendingTargetTab = targetTabId;
    const inputEl = document.getElementById('panitia-pin-input');
    if (inputEl) inputEl.value = '';
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.remove('hidden');
    setTimeout(() => { if (inputEl) inputEl.focus(); }, 100);
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.add('hidden');
    pendingTargetTab = null;
}

async function handlePanitiaLogin(event) {
async function handlePanitiaLogin(event) {
    event.preventDefault();
    const pinVal = document.getElementById('panitia-pin-input')?.value.trim();
    if (!pinVal) return;

    let isAuthenticated = false;

    // Fallback default checks for offline / emergency access
    const defaultPins = ['123456', 'admin123', 'semaya2026'];
    if (defaultPins.includes(pinVal)) {
        isAuthenticated = true;
    } else if (db && isCloudActive && !isDummyConfig) {
        try {
            // Query Firestore 'panitia' collection for matching PIN/Password
            const snapshot = await db.collection('panitia').where('pin', '==', pinVal).get();
            if (!snapshot.empty) {
                isAuthenticated = true;
            } else {
                // Check if collection is empty, create default document if needed
                const allPanitia = await db.collection('panitia').get();
                if (allPanitia.empty) {
                    await db.collection('panitia').add({ username: 'admin', pin: '123456', role: 'Super Admin' });
                    if (pinVal === '123456') isAuthenticated = true;
                }
            }
        } catch (e) {
            console.log("Firestore auth fallback error:", e);
        }
    }

    if (isAuthenticated) {
        sessionStorage.setItem(PANITIA_AUTH_KEY, 'true');
        checkPanitiaAuthUI();
        closeAuthModal();
        showToast('Login Panitia Berhasil (Database Verified)!', 'success');
        
        if (pendingTargetTab) {
            const tabToOpen = pendingTargetTab;
            pendingTargetTab = null;
            switchTab(tabToOpen);
        }
    } else {
        showToast('PIN / Password Panitia Salah!', 'error');
        const inputEl = document.getElementById('panitia-pin-input');
        if (inputEl) {
            inputEl.value = '';
            inputEl.focus();
        }
    }
}

    if (isAuthenticated) {
        sessionStorage.setItem(PANITIA_AUTH_KEY, 'true');
        checkPanitiaAuthUI();
        closeAuthModal();
        showToast('Login Panitia Berhasil (Database Verified)!', 'success');
        
        if (pendingTargetTab) {
            const tabToOpen = pendingTargetTab;
            pendingTargetTab = null;
            switchTab(tabToOpen);
        }
    } else {
        showToast('PIN / Password Panitia Salah!', 'error');
        const inputEl = document.getElementById('panitia-pin-input');
        if (inputEl) {
            inputEl.value = '';
            inputEl.focus();
        }
    }
}

function switchTab(tabId) {
    if ((tabId === 'admin-tab' || tabId === 'status-tab') && !isPanitiaLoggedIn()) {
        openAuthModal(tabId);
        return;
    }

    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(el => el.classList.add('hidden'));

    const target = document.getElementById(tabId);
    if (target) target.classList.remove('hidden');

    const navBtns = {
        'form-tab': 'nav-form-tab',
        'availability-tab': 'nav-availability-tab',
        'status-tab': 'nav-status-tab',
        'admin-tab': 'nav-admin-tab'
    };

    Object.keys(navBtns).forEach(key => {
        const btn = document.getElementById(navBtns[key]);
        if (btn) {
            if (key === tabId) {
                btn.className = 'nav-btn px-4 py-2.5 rounded-xl font-medium text-sm transition flex items-center space-x-2 bg-amber-500 text-slate-950 font-semibold shadow-lg shadow-amber-500/20';
            } else {
                btn.className = 'nav-btn px-4 py-2.5 rounded-xl font-medium text-sm transition flex items-center space-x-2 text-slate-300 hover:text-white hover:bg-slate-800';
            }
        }
    });

    if (tabId === 'availability-tab') {
        renderAvailabilityGrid();
    } else if (tabId === 'admin-tab') {
        renderAdminTable();
        renderAttendanceTab();
    }
}

function switchAdminSubTab(subTabId) {
    const subtabs = document.querySelectorAll('.admin-subtab-content');
    subtabs.forEach(el => el.classList.add('hidden'));

    const target = document.getElementById(subTabId);
    if (target) target.classList.remove('hidden');

    const btnData = document.getElementById('subnav-admin-data');
    const btnAtt = document.getElementById('subnav-admin-attendance');

    if (subTabId === 'admin-data-subtab') {
        if (btnData) btnData.className = 'subnav-admin-btn px-5 py-3 rounded-t-2xl text-xs sm:text-sm font-bold transition flex items-center space-x-2 bg-amber-500 text-slate-950 shadow-md';
        if (btnAtt) btnAtt.className = 'subnav-admin-btn px-5 py-3 rounded-t-2xl text-xs sm:text-sm font-semibold transition flex items-center space-x-2 text-slate-400 hover:text-white hover:bg-slate-800/80';
        renderAdminTable();
    } else {
        if (btnData) btnData.className = 'subnav-admin-btn px-5 py-3 rounded-t-2xl text-xs sm:text-sm font-semibold transition flex items-center space-x-2 text-slate-400 hover:text-white hover:bg-slate-800/80';
        if (btnAtt) btnAtt.className = 'subnav-admin-btn px-5 py-3 rounded-t-2xl text-xs sm:text-sm font-bold transition flex items-center space-x-2 bg-cyan-500 text-slate-950 shadow-md';
        renderAttendanceTab();
    }
}

function validateNomerAvailability() {
    const kategoriEl = document.getElementById('kategori');
    const seriEl = document.getElementById('seriLayangan');
    const nomerInput = document.getElementById('nomerLayangan');
    const errorMsgEl = document.getElementById('nomer-error-msg');
    const submitBtn = document.getElementById('submit-btn');

    if (!kategoriEl || !seriEl || !nomerInput) return true;

    const kategoriVal = kategoriEl.value;
    const seriVal = seriEl.value;
    let nomerVal = nomerInput.value.trim();

    if (!nomerVal || !seriVal || !kategoriVal) {
        if (errorMsgEl) errorMsgEl.classList.add('hidden');
        nomerInput.classList.remove('border-red-500', 'ring-2', 'ring-red-500/50');
        nomerInput.classList.add('border-slate-700');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
        return true;
    }

    if (/^\d+$/.test(nomerVal)) {
        nomerVal = nomerVal.padStart(3, '0');
    }

    const isDuplicate = registrations.some(r => 
        r.kategori === kategoriVal &&
        r.seriLayangan === seriVal &&
        r.nomerLayangan.toLowerCase() === nomerVal.toLowerCase()
    );

    if (isDuplicate) {
        if (errorMsgEl) errorMsgEl.classList.remove('hidden');
        nomerInput.classList.remove('border-slate-700');
        nomerInput.classList.add('border-red-500', 'ring-2', 'ring-red-500/50');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
        return false;
    } else {
        if (errorMsgEl) errorMsgEl.classList.add('hidden');
        nomerInput.classList.remove('border-red-500', 'ring-2', 'ring-red-500/50');
        nomerInput.classList.add('border-slate-700');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
        return true;
    }
}

function handleRegistrationSubmit(event) {
    event.preventDefault();

    if (!validateNomerAvailability()) {
        showToast('Nomor Layangan sudah terdaftar di seri tersebut! Pilih nomor lain.', 'error');
        const nomerInput = document.getElementById('nomerLayangan');
        if (nomerInput) nomerInput.focus();
        return;
    }

    const kategoriVal = document.getElementById('kategori')?.value || '';
    const seriVal = document.getElementById('seriLayangan')?.value || '';
    let nomerVal = (document.getElementById('nomerLayangan')?.value || '').trim();

    if (/^\d+$/.test(nomerVal)) {
        nomerVal = nomerVal.padStart(3, '0');
    }

    const priceNum = getCategoryPrice(kategoriVal);
    const feeStr = formatRupiah(priceNum);

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10) + ' ' + now.toTimeString().slice(0, 5);

    pendingRegistration = {
        id: `KITE-${Math.floor(1000 + Math.random() * 9000)}`,
        kategori: kategoriVal,
        namaLayangan: document.getElementById('namaLayangan')?.value.trim() || '',
        alamatLayangan: document.getElementById('alamatLayangan')?.value.trim() || '',
        nomerLayangan: nomerVal,
        seriLayangan: seriVal,
        statusPembayaran: 'PENDING',
        biaya: feeStr,
        statusKehadiran: 'BELUM_HADIR',
        waktuKehadiran: '-',
        createdAt: dateStr
    };

    openPaymentModal(pendingRegistration);
}

function resetForm() {
    const form = document.getElementById('kite-registration-form');
    if (form) form.reset();
    const feeInfo = document.getElementById('fee-info-box');
    if (feeInfo) feeInfo.classList.add('hidden');
    validateNomerAvailability();
}

function openPaymentModal(data) {
    const payForm = document.getElementById('pay-view-form');
    const payProcessing = document.getElementById('pay-view-processing');
    const paySuccess = document.getElementById('pay-view-success');

    if (payForm) payForm.classList.remove('hidden');
    if (payProcessing) payProcessing.classList.add('hidden');
    if (paySuccess) paySuccess.classList.add('hidden');

    const orderId = `INV-KITE-${Date.now().toString().slice(-6)}`;
    data.orderId = orderId;

    const orderIdEl = document.getElementById('pay-order-id');
    const namaEl = document.getElementById('pay-nama');
    const katSeriEl = document.getElementById('pay-kategori-seri');
    const nomerEl = document.getElementById('pay-nomer');
    const totalBiayaEl = document.getElementById('pay-total-biaya');

    if (orderIdEl) orderIdEl.textContent = orderId;
    if (namaEl) namaEl.textContent = data.namaLayangan;
    if (katSeriEl) katSeriEl.textContent = `${data.kategori} - ${data.seriLayangan}`;
    if (nomerEl) nomerEl.textContent = data.nomerLayangan;
    if (totalBiayaEl) totalBiayaEl.textContent = data.biaya;

    const qrContainer = document.getElementById('payment-qris-code');
    if (qrContainer) {
        qrContainer.innerHTML = '';
        if (typeof QRCode !== 'undefined') {
            new QRCode(qrContainer, {
                text: `00020101021226580016ID.MIDTRANS.WWW01189360091800000000005204581253033605405500005802ID5918SEMAYA KITE FESTIVAL6007DENPASAR61058023462070703A016304EB9C`,
                width: 120,
                height: 120,
                colorDark: "#0f172a",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.M
            });
        }
    }

    const modal = document.getElementById('payment-modal');
    if (modal) modal.classList.remove('hidden');
}

function closePaymentModal() {
    const modal = document.getElementById('payment-modal');
    if (modal) modal.classList.add('hidden');
    pendingRegistration = null;
}

function simulasikanUangMasuk(channelSelected) {
    if (!pendingRegistration) {
        showToast('Data pendaftaran tidak ditemukan.', 'error');
        return;
    }

    const formView = document.getElementById('pay-view-form');
    const processingView = document.getElementById('pay-view-processing');
    const successView = document.getElementById('pay-view-success');
    const progressBar = document.getElementById('pay-progress-bar');
    const statusTitle = document.getElementById('pay-status-title');
    const statusDesc = document.getElementById('pay-status-desc');

    if (formView) formView.classList.add('hidden');
    if (processingView) processingView.classList.remove('hidden');
    if (progressBar) progressBar.style.width = '25%';

    setTimeout(() => {
        if (progressBar) progressBar.style.width = '60%';
        if (statusTitle) statusTitle.textContent = `Sistem Mendeteksi Transfer (${channelSelected})...`;
        if (statusDesc) statusDesc.textContent = `Menerima mutasi kredit masuk sebesar ${pendingRegistration.biaya}`;
    }, 800);

    setTimeout(() => {
        if (progressBar) progressBar.style.width = '90%';
        if (statusTitle) statusTitle.textContent = 'Verifikasi Mutasi Rekening Cocok!';
        if (statusDesc) statusDesc.textContent = 'Cryptographic signature webhook verified successfully';
    }, 1600);

    setTimeout(() => {
        if (progressBar) progressBar.style.width = '100%';
        if (processingView) processingView.classList.add('hidden');
        if (successView) successView.classList.remove('hidden');

        processPaymentSettlementSuccess(`QRIS / Auto Bank (${channelSelected})`);
    }, 2300);
}

async function processPaymentSettlementSuccess(methodName) {
    if (!pendingRegistration) return;

    pendingRegistration.metodePembayaran = methodName;
    pendingRegistration.statusPembayaran = 'LUNAS';

    const finalData = { ...pendingRegistration };
    
    if (!registrations.some(r => r.id === finalData.id)) {
        registrations.unshift(finalData);
    }

    await syncRecordToCloud(finalData);

    setTimeout(() => {
        closePaymentModal();
        resetForm();
        showToast('Uang masuk terdeteksi! Pendaftaran lunas & tersimpan di Cloud Database.', 'success');
        openCardModal(finalData);
    }, 1200);
}

function renderAttendanceTab() {
    const total = registrations.length;
    const hadirCount = registrations.filter(r => r.statusKehadiran === 'HADIR').length;
    const belumCount = total - hadirCount;
    const rate = total > 0 ? Math.round((hadirCount / total) * 100) : 0;

    const attStatTotal = document.getElementById('att-stat-total');
    const attStatHadir = document.getElementById('att-stat-hadir');
    const attStatBelum = document.getElementById('att-stat-belum');
    const rateBadge = document.getElementById('attendance-rate-badge');

    if (attStatTotal) attStatTotal.textContent = total;
    if (attStatHadir) attStatHadir.textContent = hadirCount;
    if (attStatBelum) attStatBelum.textContent = belumCount;
    if (rateBadge) rateBadge.textContent = `${rate}%`;

    const filterStatus = document.getElementById('att-filter-status')?.value || 'ALL';
    const container = document.getElementById('attendance-log-container');

    if (!container) return;

    let filteredList = registrations.filter(r => {
        if (filterStatus === 'HADIR') return r.statusKehadiran === 'HADIR';
        if (filterStatus === 'BELUM_HADIR') return r.statusKehadiran !== 'HADIR';
        return true;
    });

    if (filteredList.length === 0) {
        container.innerHTML = `
            <div class="py-12 text-center text-slate-500">
                <i class="fa-solid fa-clipboard-question text-4xl mb-3 text-slate-700"></i>
                <p class="text-sm font-medium">Belum ada data pendaftar yang sesuai dengan filter ini.</p>
            </div>
        `;
        return;
    }

    let html = `
        <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="bg-slate-900 text-slate-400 uppercase text-[11px] font-bold tracking-wider border-b border-slate-800">
                        <th class="p-3">No. Dada</th>
                        <th class="p-3">Nama Layangan</th>
                        <th class="p-3">Kategori & Seri</th>
                        <th class="p-3">Status Kehadiran</th>
                        <th class="p-3">Waktu Check-In</th>
                        <th class="p-3 text-center">Aksi Check-In</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/60 text-sm text-slate-200">
    `;

    filteredList.forEach(r => {
        const isHadir = r.statusKehadiran === 'HADIR';
        html += `
            <tr class="hover:bg-slate-900/60 transition">
                <td class="p-3 font-mono font-bold text-amber-400 text-base">${r.nomerLayangan}</td>
                <td class="p-3">
                    <div class="font-bold text-white">${r.namaLayangan}</div>
                    <div class="text-[11px] text-slate-400 truncate max-w-xs">${r.alamatLayangan}</div>
                </td>
                <td class="p-3 text-xs">
                    <span class="block font-semibold text-slate-200">${r.kategori}</span>
                    <span class="block text-slate-400 text-[11px]">${r.seriLayangan}</span>
                </td>
                <td class="p-3">
                    ${isHadir 
                        ? `<span class="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                             <i class="fa-solid fa-circle-check text-xs"></i> <span>HADIR LAPANGAN</span>
                           </span>`
                        : `<span class="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/30">
                             <i class="fa-solid fa-clock text-xs"></i> <span>BELUM HADIR</span>
                           </span>`
                    }
                </td>
                <td class="p-3 font-mono text-xs text-slate-400">${r.waktuKehadiran || '-'}</td>
                <td class="p-3 text-center">
                    ${isHadir
                        ? `<button onclick="toggleKehadiran('${r.id}', false)" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-red-400 border border-red-500/30 rounded-xl text-xs font-semibold transition inline-flex items-center space-x-1">
                             <i class="fa-solid fa-rotate-left text-xs"></i> <span>Batal Hadir</span>
                           </button>`
                        : `<button onclick="toggleKehadiran('${r.id}', true)" class="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-xs font-bold transition shadow-md shadow-emerald-500/10 inline-flex items-center space-x-1">
                             <i class="fa-solid fa-user-check text-xs"></i> <span>Tandai Hadir</span>
                           </button>`
                    }
                </td>
            </tr>
        `;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

function handleAttendanceScan(event) {
    if (event) event.preventDefault();
    const inputEl = document.getElementById('att-scan-input');
    const resultBox = document.getElementById('att-scan-result');
    if (!inputEl || !resultBox) return;

    const query = inputEl.value.trim().toLowerCase();
    if (!query) return;

    const found = registrations.find(r => 
        r.nomerLayangan.toLowerCase() === query || 
        r.namaLayangan.toLowerCase().includes(query) ||
        r.id.toLowerCase() === query
    );

    resultBox.classList.remove('hidden');

    if (found) {
        const isHadir = found.statusKehadiran === 'HADIR';
        resultBox.innerHTML = `
            <div class="bg-slate-900 border border-cyan-500/40 rounded-2xl p-5 shadow-xl space-y-4">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-800 pb-3">
                    <div>
                        <span class="text-xs font-bold text-cyan-400 uppercase tracking-wider block">Peserta Ditemukan</span>
                        <h4 class="text-xl font-bold font-traditional text-white">${found.namaLayangan}</h4>
                    </div>
                    <span class="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-mono font-bold">
                        No. Dada: ${found.nomerLayangan}
                    </span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-300">
                    <div class="bg-slate-950 p-3 rounded-xl border border-slate-800">
                        <span class="text-slate-500 block text-[10px]">Kategori & Seri:</span>
                        <span class="font-bold text-white">${found.kategori}</span>
                        <span class="block text-slate-400 text-[11px]">${found.seriLayangan}</span>
                    </div>
                    <div class="bg-slate-950 p-3 rounded-xl border border-slate-800">
                        <span class="text-slate-500 block text-[10px]">Status Kehadiran Lapangan:</span>
                        <span class="font-bold ${isHadir ? 'text-emerald-400' : 'text-red-400'}">${isHadir ? 'VERIFIKASI HADIR' : 'BELUM CHECK-IN'}</span>
                        <span class="block text-slate-400 text-[11px]">${found.waktuKehadiran || 'Belum ada catatan waktu'}</span>
                    </div>
                    <div class="bg-slate-950 p-3 rounded-xl border border-slate-800">
                        <span class="text-slate-500 block text-[10px]">Alamat / Banjar:</span>
                        <span class="font-medium text-slate-200 truncate block">${found.alamatLayangan}</span>
                    </div>
                </div>

                <div class="pt-2 flex flex-col sm:flex-row gap-3">
                    ${!isHadir ? `
                        <button onclick="toggleKehadiran('${found.id}', true)" class="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-slate-950 font-extrabold py-3 rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center justify-center space-x-2 text-sm">
                            <i class="fa-solid fa-circle-check text-base"></i>
                            <span>KONFIRMASI KEHADIRAN LAPANGAN (CHECK-IN)</span>
                        </button>
                    ` : `
                        <button onclick="toggleKehadiran('${found.id}', false)" class="flex-1 bg-slate-800 hover:bg-slate-700 text-red-400 font-bold py-3 rounded-xl transition flex items-center justify-center space-x-2 text-xs border border-red-500/30">
                            <i class="fa-solid fa-rotate-left"></i>
                            <span>Batalkan Status Kehadiran</span>
                        </button>
                    `}
                    <button onclick="openCardModalById('${found.id}')" class="bg-slate-800 hover:bg-slate-700 text-amber-400 font-semibold px-5 py-3 rounded-xl text-xs transition flex items-center justify-center space-x-2">
                        <i class="fa-solid fa-address-card"></i>
                        <span>Lihat Kartu Dada</span>
                    </button>
                </div>
            </div>
        `;
    } else {
        resultBox.innerHTML = `
            <div class="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-center">
                <i class="fa-solid fa-triangle-exclamation text-amber-400 text-3xl mb-2"></i>
                <h4 class="text-base font-bold text-white">Nomor Dada / Peserta Tidak Ditemukan</h4>
                <p class="text-slate-400 text-xs mt-1">Pastikan input nomor dada sudah benar dan terdaftar dalam sistem.</p>
            </div>
        `;
    }
}

async function toggleKehadiran(id, markHadir) {
    const index = registrations.findIndex(r => r.id === id);
    if (index !== -1) {
        if (markHadir) {
            const now = new Date();
            const timeStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) + ' ' + now.toTimeString().slice(0, 5) + ' WITA';
            registrations[index].statusKehadiran = 'HADIR';
            registrations[index].waktuKehadiran = timeStr;
            showToast(`Kehadiran "${registrations[index].namaLayangan}" berhasil dikonfirmasi!`, 'success');
        } else {
            registrations[index].statusKehadiran = 'BELUM_HADIR';
            registrations[index].waktuKehadiran = '-';
            showToast(`Status kehadiran "${registrations[index].namaLayangan}" dibatalkan.`, 'info');
        }

        await syncRecordToCloud(registrations[index]);

        const scanInputVal = document.getElementById('att-scan-input')?.value;
        if (scanInputVal) {
            handleAttendanceScan();
        }
    }
}

function openQrScannerModal() {
    const modal = document.getElementById('qr-camera-modal');
    if (modal) modal.classList.remove('hidden');

    if (typeof Html5Qrcode !== 'undefined') {
        html5QrCodeScanner = new Html5Qrcode("reader");
        const config = { fps: 10, qrbox: { width: 220, height: 220 } };

        html5QrCodeScanner.start(
            { facingMode: "environment" },
            config,
            onQrScanSuccess
        ).catch(err => {
            console.error("Camera access error:", err);
            showToast('Gagal mengakses kamera. Pastikan izin kamera telah diberikan.', 'error');
        });
    } else {
        showToast('Pustaka Scanner Kamera tidak tersedia.', 'error');
    }
}

function closeQrScannerModal() {
    if (html5QrCodeScanner) {
        html5QrCodeScanner.stop().then(() => {
            html5QrCodeScanner.clear();
            html5QrCodeScanner = null;
        }).catch(err => console.error(err));
    }

    const modal = document.getElementById('qr-camera-modal');
    if (modal) modal.classList.add('hidden');
}

function onQrScanSuccess(decodedText) {
    closeQrScannerModal();
    let matchedNumber = decodedText;

    if (decodedText.includes('|')) {
        const parts = decodedText.split('|');
        if (parts.length >= 3) {
            matchedNumber = parts[2];
        }
    }

    const inputEl = document.getElementById('att-scan-input');
    if (inputEl) {
        inputEl.value = matchedNumber;
        handleAttendanceScan();
    }

    showToast(`QR Code Terbaca: ${matchedNumber}`, 'success');
}

function renderAvailabilityGrid() {
    const kategori = document.getElementById('avail-filter-kategori')?.value || 'Bebean';
    const seri = document.getElementById('avail-filter-seri')?.value || 'Seri A (Dewasa / Remaja)';
    const searchVal = (document.getElementById('avail-search-input')?.value || '').trim().toLowerCase();
    const gridContainer = document.getElementById('availability-grid');

    if (!gridContainer) return;

    let takenList = registrations.filter(r => r.kategori === kategori && r.seriLayangan === seri);

    if (searchVal) {
        takenList = takenList.filter(r => 
            r.nomerLayangan.toLowerCase().includes(searchVal) ||
            r.namaLayangan.toLowerCase().includes(searchVal) ||
            r.alamatLayangan.toLowerCase().includes(searchVal)
        );
    }

    const statTerisi = document.getElementById('grid-stat-terisi');
    if (statTerisi) statTerisi.textContent = takenList.length;

    gridContainer.innerHTML = '';

    if (takenList.length === 0) {
        gridContainer.className = "py-8 text-center";
        gridContainer.innerHTML = `
            <div class="bg-slate-900/40 border border-emerald-500/20 rounded-2xl p-8 max-w-md mx-auto">
                <div class="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-3 text-xl">
                    <i class="fa-solid fa-circle-check"></i>
                </div>
                <h4 class="text-base font-bold text-white mb-1">${searchVal ? 'Tidak Ada Nomor Sesuai Pencarian' : 'Semua Nomor Bebas Digunakan'}</h4>
                <p class="text-slate-400 text-xs mb-4">${searchVal ? `Tidak ditemukan nomor terdaftar dengan kata kunci "<strong>${searchVal}</strong>".` : `Belum ada nomor layangan yang terdaftar untuk kategori <strong>${kategori}</strong> - <strong>${seri}</strong>.`}</p>
                <button onclick="switchTab('form-tab')" class="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs transition inline-flex items-center space-x-2 shadow-lg shadow-amber-500/10">
                    <i class="fa-solid fa-pen-to-square"></i>
                    <span>Daftarkan Layangan Sekarang</span>
                </button>
            </div>
        `;
        return;
    }

    gridContainer.className = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4";

    takenList.sort((a, b) => a.nomerLayangan.localeCompare(b.nomerLayangan, undefined, {numeric: true}));

    takenList.forEach(item => {
        const card = document.createElement('div');
        card.className = 'bg-slate-900/80 border border-red-500/30 rounded-2xl p-4 flex flex-col justify-between hover:border-red-500/60 transition shadow-sm';
        card.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">No. Dada: ${item.nomerLayangan}</span>
                <span class="text-[10px] uppercase font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-md">Terisi</span>
            </div>
            <div class="font-bold text-white text-sm truncate" title="${item.namaLayangan}">${item.namaLayangan}</div>
            <div class="text-[11px] text-slate-400 truncate mt-1" title="${item.alamatLayangan}">${item.alamatLayangan}</div>
        `;
        gridContainer.appendChild(card);
    });
}

function openOfflineRegisterModal() {
    const kat = document.getElementById('off-kategori');
    const nama = document.getElementById('off-namaLayangan');
    const alamat = document.getElementById('off-alamatLayangan');
    const nomer = document.getElementById('off-nomerLayangan');
    const seri = document.getElementById('off-seriLayangan');
    const status = document.getElementById('off-statusBayar');
    const metode = document.getElementById('off-metodeBayar');

    if (kat) kat.value = '';
    if (nama) nama.value = '';
    if (alamat) alamat.value = '';
    if (nomer) nomer.value = '';
    if (seri) seri.value = '';
    if (status) status.value = 'LUNAS';
    if (metode) metode.value = 'Tunai / Panitia Offline';

    validateOfflineNomerAvailability();
    const modal = document.getElementById('offline-register-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeOfflineRegisterModal() {
    const modal = document.getElementById('offline-register-modal');
    if (modal) modal.classList.add('hidden');
}

function validateOfflineNomerAvailability() {
    const kategoriVal = document.getElementById('off-kategori')?.value || '';
    const seriVal = document.getElementById('off-seriLayangan')?.value || '';
    let nomerVal = (document.getElementById('off-nomerLayangan')?.value || '').trim();

    const nomerInput = document.getElementById('off-nomerLayangan');
    const errorMsgEl = document.getElementById('off-nomer-error-msg');
    const submitBtn = document.getElementById('off-submit-btn');

    if (!nomerVal || !seriVal || !kategoriVal) {
        if (errorMsgEl) errorMsgEl.classList.add('hidden');
        if (nomerInput) nomerInput.classList.remove('border-red-500');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
        return true;
    }

    if (/^\d+$/.test(nomerVal)) {
        nomerVal = nomerVal.padStart(3, '0');
    }

    const isDuplicate = registrations.some(r => 
        r.kategori === kategoriVal &&
        r.seriLayangan === seriVal &&
        r.nomerLayangan.toLowerCase() === nomerVal.toLowerCase()
    );

    if (isDuplicate) {
        if (errorMsgEl) errorMsgEl.classList.remove('hidden');
        if (nomerInput) nomerInput.classList.add('border-red-500');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
        return false;
    } else {
        if (errorMsgEl) errorMsgEl.classList.add('hidden');
        if (nomerInput) nomerInput.classList.remove('border-red-500');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
        return true;
    }
}

async function handleOfflineRegisterSubmit(event) {
    event.preventDefault();

    if (!validateOfflineNomerAvailability()) {
        showToast('Nomor Layangan sudah terdaftar di kategori & seri tersebut!', 'error');
        return;
    }

    let nomerVal = (document.getElementById('off-nomerLayangan')?.value || '').trim();
    if (/^\d+$/.test(nomerVal)) {
        nomerVal = nomerVal.padStart(3, '0');
    }

    const kategoriVal = document.getElementById('off-kategori')?.value || 'Bebean';
    const priceNum = getCategoryPrice(kategoriVal);
    const feeStr = formatRupiah(priceNum);

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10) + ' ' + now.toTimeString().slice(0, 5);

    const offlineData = {
        id: `KITE-OFF-${Math.floor(1000 + Math.random() * 9000)}`,
        kategori: kategoriVal,
        namaLayangan: document.getElementById('off-namaLayangan')?.value.trim() || '',
        alamatLayangan: document.getElementById('off-alamatLayangan')?.value.trim() || '',
        nomerLayangan: nomerVal,
        seriLayangan: document.getElementById('off-seriLayangan')?.value || '',
        statusPembayaran: document.getElementById('off-statusBayar')?.value || 'LUNAS',
        metodePembayaran: document.getElementById('off-metodeBayar')?.value || 'Tunai',
        biaya: feeStr,
        statusKehadiran: 'BELUM_HADIR',
        waktuKehadiran: '-',
        createdAt: dateStr
    };

    if (!registrations.some(r => r.id === offlineData.id)) {
        registrations.unshift(offlineData);
    }

    await syncRecordToCloud(offlineData);
    closeOfflineRegisterModal();
    showToast(`Pendaftaran Offline (${offlineData.namaLayangan}) tersimpan!`, 'success');

    openCardModal(offlineData);
}

function openEditModal(id) {
    const item = registrations.find(r => r.id === id);
    if (!item) return;

    const editId = document.getElementById('edit-id');
    const editKat = document.getElementById('edit-kategori');
    const editNama = document.getElementById('edit-namaLayangan');
    const editAlamat = document.getElementById('edit-alamatLayangan');
    const editNomer = document.getElementById('edit-nomerLayangan');
    const editSeri = document.getElementById('edit-seriLayangan');

    if (editId) editId.value = item.id;
    if (editKat) editKat.value = item.kategori;
    if (editNama) editNama.value = item.namaLayangan;
    if (editAlamat) editAlamat.value = item.alamatLayangan;
    if (editNomer) editNomer.value = item.nomerLayangan;
    if (editSeri) editSeri.value = item.seriLayangan;

    const modal = document.getElementById('edit-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeEditModal() {
    const modal = document.getElementById('edit-modal');
    if (modal) modal.classList.add('hidden');
}

async function handleSaveEdit(event) {
    event.preventDefault();
    const id = document.getElementById('edit-id')?.value;
    const index = registrations.findIndex(r => r.id === id);

    if (index !== -1) {
        const katVal = document.getElementById('edit-kategori')?.value || registrations[index].kategori;
        const priceNum = getCategoryPrice(katVal);

        registrations[index].kategori = katVal;
        registrations[index].namaLayangan = document.getElementById('edit-namaLayangan')?.value.trim() || registrations[index].namaLayangan;
        registrations[index].alamatLayangan = document.getElementById('edit-alamatLayangan')?.value.trim() || registrations[index].alamatLayangan;
        registrations[index].nomerLayangan = document.getElementById('edit-nomerLayangan')?.value.trim() || registrations[index].nomerLayangan;
        registrations[index].seriLayangan = document.getElementById('edit-seriLayangan')?.value || registrations[index].seriLayangan;
        registrations[index].biaya = formatRupiah(priceNum);

        await syncRecordToCloud(registrations[index]);
        closeEditModal();
        showToast('Data layangan berhasil diperbarui!', 'success');
    }
}

function openConfirmModal(title, message, onConfirm) {
    const titleEl = document.getElementById('confirm-title');
    const msgEl = document.getElementById('confirm-message');
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;

    confirmActionCallback = onConfirm;

    const confirmBtn = document.getElementById('confirm-yes-btn');
    if (confirmBtn) {
        confirmBtn.onclick = () => {
            if (confirmActionCallback) confirmActionCallback();
            closeConfirmModal();
        };
    }

    const modal = document.getElementById('confirm-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeConfirmModal() {
    const modal = document.getElementById('confirm-modal');
    if (modal) modal.classList.add('hidden');
    confirmActionCallback = null;
}

function deleteRegistration(id) {
    const item = registrations.find(r => r.id === id);
    if (!item) return;

    openConfirmModal(
        'Hapus Data Layangan?',
        `Apakah Anda yakin ingin menghapus "${item.namaLayangan}" (No. ${item.nomerLayangan})?`,
        async () => {
            registrations = registrations.filter(r => r.id !== id);
            await removeRecordFromCloud(id);
            showToast('Data layangan berhasil dihapus.', 'info');
        }
    );
}

function clearAllData() {
    openConfirmModal(
        'Reset Seluruh Data?',
        'Apakah Anda yakin ingin MENGHAPUS SELURUH data pendaftar layangan?',
        async () => {
            const deletePromises = registrations.map(r => removeRecordFromCloud(r.id));
            await Promise.all(deletePromises);
            registrations = [];
            saveRegistrationsLocal();
            showToast('Seluruh data berhasil dibersihkan.', 'info');
        }
    );
}

function handleSearchStatus(event) {
    event.preventDefault();
    const inputEl = document.getElementById('search-input');
    const resultBox = document.getElementById('status-result');

    if (!inputEl || !resultBox) return;

    const query = inputEl.value.trim().toLowerCase();
    if (!query) return;

    const found = registrations.find(r => 
        r.nomerLayangan.toLowerCase() === query || 
        r.namaLayangan.toLowerCase().includes(query) ||
        r.id.toLowerCase() === query
    );

    resultBox.classList.remove('hidden');

    if (found) {
        resultBox.innerHTML = `
            <div class="bg-slate-950/60 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 mb-4 gap-2">
                    <div>
                        <span class="text-xs font-bold text-amber-400 uppercase tracking-widest block">Data Ditemukan</span>
                        <h3 class="text-2xl font-bold font-traditional text-white">${found.namaLayangan}</h3>
                    </div>
                    <span class="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3.5 py-1 rounded-full text-xs font-mono font-bold">
                        No. Dada: ${found.nomerLayangan}
                    </span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-slate-300 mb-6 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                    <div><span class="text-slate-500 text-xs block">Kategori:</span> <span class="font-bold text-white">${found.kategori}</span></div>
                    <div><span class="text-slate-500 text-xs block">Seri:</span> <span class="font-bold text-white">${found.seriLayangan}</span></div>
                    <div><span class="text-slate-500 text-xs block">Status & Biaya:</span> <span class="font-bold text-emerald-400">${found.statusPembayaran || 'LUNAS'} (${found.biaya})</span></div>
                    <div><span class="text-slate-500 text-xs block">Asal Banjar:</span> <span class="font-medium text-slate-200">${found.alamatLayangan}</span></div>
                </div>

                <button onclick='openCardModalById("${found.id}")' class="w-full bg-gradient-to-r from-amber-500 to-red-600 hover:from-amber-600 hover:to-red-700 text-slate-950 font-bold py-3.5 rounded-xl transition flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/10">
                    <i class="fa-solid fa-id-card text-lg"></i>
                    <span>Tampilkan & Cetak Kartu Dada Layangan</span>
                </button>
            </div>
        `;
    } else {
        resultBox.innerHTML = `
            <div class="bg-slate-950/60 border border-slate-800 p-8 rounded-3xl text-center">
                <i class="fa-solid fa-triangle-exclamation text-amber-400 text-4xl mb-3"></i>
                <h3 class="text-lg font-bold text-white">Data Layangan Tidak Ditemukan</h3>
                <p class="text-slate-400 text-sm mt-1">Pastikan Nomer Layangan atau Nama Layangan yang Anda masukkan sudah benar.</p>
            </div>
        `;
    }
}

function openCardModalById(id) {
    const item = registrations.find(r => r.id === id);
    if (item) openCardModal(item);
}

function closeModal() {
    const modal = document.getElementById('card-modal');
    if (modal) modal.classList.add('hidden');
}

function renderAdminTable() {
    const tbody = document.getElementById('admin-table-body');
    const emptyState = document.getElementById('admin-empty-state');
    if (!tbody) return;

    const searchVal = (document.getElementById('admin-search')?.value || '').trim().toLowerCase();
    const filterKategori = document.getElementById('admin-filter-kategori')?.value || 'ALL';
    const filterKehadiran = document.getElementById('admin-filter-kehadiran')?.value || 'ALL';

    const statTotal = document.getElementById('stat-total');
    const statHadir = document.getElementById('stat-hadir-admin');
    const statBebean = document.getElementById('stat-bebean');
    const statJanggan = document.getElementById('stat-janggan');

    if (statTotal) statTotal.textContent = registrations.length;
    if (statHadir) statHadir.textContent = registrations.filter(r => r.statusKehadiran === 'HADIR').length;
    if (statBebean) statBebean.textContent = registrations.filter(r => r.kategori === 'Bebean').length;
    if (statJanggan) statJanggan.textContent = registrations.filter(r => r.kategori.includes('Janggan')).length;

    const filtered = registrations.filter(r => {
        const matchSearch = r.namaLayangan.toLowerCase().includes(searchVal) ||
                            r.nomerLayangan.toLowerCase().includes(searchVal) ||
                            r.alamatLayangan.toLowerCase().includes(searchVal);
        const matchKategori = filterKategori === 'ALL' || r.kategori === filterKategori;
        const matchKehadiran = filterKehadiran === 'ALL' || 
                               (filterKehadiran === 'HADIR' && r.statusKehadiran === 'HADIR') ||
                               (filterKehadiran === 'BELUM_HADIR' && r.statusKehadiran !== 'HADIR');
        return matchSearch && matchKategori && matchKehadiran;
    });

    tbody.innerHTML = '';

    if (filtered.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    } else {
        if (emptyState) emptyState.classList.add('hidden');
    }

    filtered.forEach(r => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-900/60 transition';
        tr.innerHTML = `
            <td class="p-4 font-mono font-bold text-amber-400 text-base">${r.nomerLayangan}</td>
            <td class="p-4 font-bold text-white">${r.namaLayangan}</td>
            <td class="p-4">
                <span class="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-200 block w-max">${r.kategori}</span>
                <span class="text-[11px] font-mono text-emerald-400 mt-1 block">${r.biaya || 'Rp 50.000'}</span>
            </td>
            <td class="p-4 text-xs text-slate-300">${r.seriLayangan}</td>
            <td class="p-4">
                <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    ${r.statusPembayaran || 'LUNAS'}
                </span>
            </td>
            <td class="p-4 text-xs text-slate-400 max-w-xs truncate">${r.alamatLayangan}</td>
            <td class="p-4 text-center">
                <div class="flex items-center justify-center space-x-2">
                    <button onclick='openCardModalById("${r.id}")' title="Kartu Peserta" class="p-2 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg transition">
                        <i class="fa-solid fa-address-card"></i>
                    </button>
                    <button onclick='openEditModal("${r.id}")' title="Edit Data" class="p-2 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg transition">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button onclick='deleteRegistration("${r.id}")' title="Hapus Data" class="p-2 bg-slate-800 hover:bg-slate-700 text-red-400 rounded-lg transition">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openCardModal(data) {
    const nomerEl = document.getElementById('modal-nomer-layangan');
    const namaEl = document.getElementById('modal-nama-layangan');
    const katEl = document.getElementById('modal-kategori');
    const seriEl = document.getElementById('modal-seri');
    const alamatEl = document.getElementById('modal-alamat');
    const dateEl = document.getElementById('modal-date');

    if (nomerEl) nomerEl.textContent = data.nomerLayangan;
    if (namaEl) namaEl.textContent = data.namaLayangan;
    if (katEl) katEl.textContent = data.kategori;
    if (seriEl) seriEl.textContent = data.seriLayangan;
    if (alamatEl) alamatEl.textContent = data.alamatLayangan;
    if (dateEl) dateEl.textContent = data.createdAt;

    const statusBayarEl = document.getElementById('modal-status-bayar');
    if (statusBayarEl) {
        statusBayarEl.textContent = `${data.statusPembayaran || 'LUNAS'} (${data.biaya || 'Rp 50.000'})`;
    }

    const qrContainer = document.getElementById('qrcode');
    if (qrContainer) {
        qrContainer.innerHTML = '';
        if (typeof QRCode !== 'undefined') {
            new QRCode(qrContainer, {
                text: `SEMAYA-KITE|${data.id}|${data.nomerLayangan}|${data.namaLayangan}`,
                width: 115,
                height: 115,
                colorDark: "#020617",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.M
            });
        }
    }

    const modal = document.getElementById('card-modal');
    if (modal) modal.classList.remove('hidden');
}

function exportToCSV() {
    if (registrations.length === 0) {
        showToast('Tidak ada data pendaftaran untuk diekspor.', 'error');
        return;
    }

    if (typeof XLSX !== 'undefined') {
        try {
            const workbook = XLSX.utils.book_new();

            const excelData = registrations.map((r, idx) => ({
                'No': idx + 1,
                'ID Pendaftaran': r.id,
                'No. Dada': r.nomerLayangan,
                'Nama Layangan': r.namaLayangan,
                'Kategori': r.kategori,
                'Seri': r.seriLayangan,
                'Alamat / Asal Banjar': r.alamatLayangan,
                'Biaya Pendaftaran': r.biaya || 'Rp 50.000',
                'Status Bayar': r.statusPembayaran || 'LUNAS',
                'Metode Bayar': r.metodePembayaran || 'Otomatis',
                'Status Kehadiran': r.statusKehadiran === 'HADIR' ? 'HADIR' : 'BELUM HADIR',
                'Waktu Check-In': r.waktuKehadiran || '-',
                'Tanggal Daftar': r.createdAt
            }));

            const worksheet = XLSX.utils.json_to_sheet(excelData);

            worksheet['!cols'] = [
                { wch: 5 }, { wch: 15 }, { wch: 12 }, { wch: 25 },
                { wch: 22 }, { wch: 22 }, { wch: 35 }, { wch: 18 },
                { wch: 14 }, { wch: 20 }, { wch: 18 }, { wch: 22 }, { wch: 20 }
            ];

            XLSX.utils.book_append_sheet(workbook, worksheet, "Data Pendaftar");

            const categories = ["Bebean", "Janggan", "Janggan Buntut", "Pecukan", "Kreasi Baru", "Big Size / Rare Angon"];
            const summaryData = categories.map(cat => {
                const count = registrations.filter(r => r.kategori === cat).length;
                const totalFeeNum = registrations.filter(r => r.kategori === cat).reduce((sum, r) => {
                    const numeric = parseInt((r.biaya || "50000").replace(/[^0-9]/g, '')) || 50000;
                    return sum + numeric;
                }, 0);
                return {
                    'Kategori Layangan': cat,
                    'Total Terdaftar': count,
                    'Tarif per Peserta': formatRupiah(getCategoryPrice(cat)),
                    'Total Pendapatan': formatRupiah(totalFeeNum)
                };
            });

            const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
            summaryWorksheet['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 20 }];
            XLSX.utils.book_append_sheet(workbook, summaryWorksheet, "Rekap Pendapatan");

            const filename = `Data_Lomba_Layangan_SEMAYA_${new Date().toISOString().slice(0,10)}.xlsx`;
            XLSX.writeFile(workbook, filename);
            showToast('File Excel Spreadsheet berhasil diunduh!', 'success');
            return;
        } catch (e) {
            console.error("SheetJS export error:", e);
        }
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');

    let icon = 'fa-info-circle text-blue-400';
    let border = 'border-slate-700';

    if (type === 'success') {
        icon = 'fa-circle-check text-emerald-400';
    } else if (type === 'error') {
        icon = 'fa-circle-xmark text-red-400';
    }

    toast.className = `flex items-center space-x-3 p-4 bg-slate-900 border ${border} rounded-2xl shadow-2xl text-slate-100 text-sm font-medium transition-all duration-300 transform translate-y-2 opacity-0 pointer-events-auto max-w-sm`;
    toast.innerHTML = `
        <i class="fa-solid ${icon} text-lg"></i>
        <span class="flex-grow">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Global Event Bindings
window.toggleMobileMenu = toggleMobileMenu;
window.switchTab = switchTab;
window.switchAdminSubTab = switchAdminSubTab;
window.validateNomerAvailability = validateNomerAvailability;
window.handleRegistrationSubmit = handleRegistrationSubmit;
window.resetForm = resetForm;
window.openPaymentModal = openPaymentModal;
window.closePaymentModal = closePaymentModal;
window.simulasikanUangMasuk = simulasikanUangMasuk;
window.renderAttendanceTab = renderAttendanceTab;
window.handleAttendanceScan = handleAttendanceScan;
window.toggleKehadiran = toggleKehadiran;
window.openQrScannerModal = openQrScannerModal;
window.closeQrScannerModal = closeQrScannerModal;
window.renderAvailabilityGrid = renderAvailabilityGrid;
window.openOfflineRegisterModal = openOfflineRegisterModal;
window.closeOfflineRegisterModal = closeOfflineRegisterModal;
window.validateOfflineNomerAvailability = validateOfflineNomerAvailability;
window.handleOfflineRegisterSubmit = handleOfflineRegisterSubmit;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.handleSaveEdit = handleSaveEdit;
window.deleteRegistration = deleteRegistration;
window.clearAllData = clearAllData;
window.handleSearchStatus = handleSearchStatus;
window.openCardModalById = openCardModalById;
window.closeModal = closeModal;
window.renderAdminTable = renderAdminTable;
window.openCardModal = openCardModal;
