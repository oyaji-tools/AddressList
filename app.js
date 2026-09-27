let contacts = [];
let deleteTargetId = null;
let selectedFilterTag = 'ALL';
let selectedKanaIndex = 'ALL'; // 五十音フィルター ('ALL', 'ア', 'カ', 'サ', 'タ', 'ナ', 'ハ', 'マ', 'ヤ', 'ラ', 'ワ')
let currentViewMode = 'card'; // 'card' または 'table'
let doubleClickBehavior = 'zoom'; // 'zoom' または 'edit'
let currentAppTheme = 'dark'; // 'dark' または 'light'
let draggedIndex = null; // ドラッグアンドドロップ用
let currentZoomScale = 1; // 拡大表示の文字倍率 (1, 1.25, 1.5, 1.8)
let deferredPrompt = null;
let printTargetId = null;

// モーダル編集中のタグデータ一時保持配列
let currentModalTags = [];
let currentModalGiftNotes = [];

// ご指定通りの初期順序・表示位置（3段階）・必須設定
let fieldSettings = [
    { id: 'name', name: 'お名前（姓・名）', elId: 'fieldName', inputIds: ['inputLastName', 'inputFirstName'], icon: 'fa-user', color: 'text-blue-400', zone: 'fixed', isLocked: true, isRequired: true },
    { id: 'address', name: '郵便番号・住所', elId: 'fieldAddress', inputIds: ['inputAddress'], icon: 'fa-location-dot', color: 'text-emerald-400', zone: 'fixed', isLocked: true, isRequired: true },
    { id: 'phone', name: '電話番号', elId: 'fieldPhone', inputIds: ['inputPhone'], icon: 'fa-phone', color: 'text-green-400', zone: 'scroll', isLocked: false, isRequired: false },
    { id: 'tags', name: 'グループタグ', elId: 'fieldTags', inputIds: ['inputTags'], icon: 'fa-tags', color: 'text-pink-400', zone: 'scroll', isLocked: false, isRequired: false },
    { id: 'giftNotes', name: 'やり取り記録タグ', elId: 'fieldGiftNotes', inputIds: ['inputGiftNotes'], icon: 'fa-gifts', color: 'text-amber-400', zone: 'scroll', isLocked: false, isRequired: false },
    { id: 'furigana', name: 'フリガナ（セイ・メイ）', elId: 'fieldFurigana', inputIds: ['inputLastFurigana', 'inputFirstFurigana'], icon: 'fa-signature', color: 'text-indigo-400', zone: 'fold', isLocked: false, isRequired: false },
    { id: 'jointName', name: '連名（ご家族など）', elId: 'fieldJointName', inputIds: ['inputJointName'], icon: 'fa-users', color: 'text-cyan-400', zone: 'fold', isLocked: false, isRequired: false },
    { id: 'company', name: '会社名 / 所属', elId: 'fieldCompany', inputIds: ['inputCompany'], icon: 'fa-building', color: 'text-purple-400', zone: 'fold', isLocked: false, isRequired: false },
    { id: 'notes', name: '自由メモ', elId: 'fieldNotes', inputIds: ['inputNotes'], icon: 'fa-note-sticky', color: 'text-sky-400', zone: 'fold', isLocked: false, isRequired: false }
];

// ページロード時初期化
window.addEventListener('DOMContentLoaded', () => {
    loadContacts();
    loadDisplaySettings();
    renderKanaIndexBar();
    applyFilters();
    initPWA();

    // インプットキー入力（Enterキーでタグ追加）イベントの登録
    document.getElementById('inputTags')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTagFromInput();
        }
    });
    document.getElementById('inputGiftNotes')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addGiftNoteFromInput();
        }
    });
});

function normalizeContactsData() {
    if (!Array.isArray(contacts)) return;
    contacts.forEach(c => {
        // 郵便番号キーの標準化 (postal, zip, zipCode, postalCode)
        const postalVal = c.postal || c.zip || c.zipCode || c.postalCode || c.postal_code || '';
        c.postal = postalVal;
        c.zip = postalVal;

        // 氏名・各フィールドのフォールバック
        if (c.lastName === undefined) c.lastName = c.name || '';
        if (c.firstName === undefined) c.firstName = '';
        if (c.lastFurigana === undefined) c.lastFurigana = c.kana || '';
        if (c.firstFurigana === undefined) c.firstFurigana = '';
        if (c.address === undefined) c.address = '';
        if (!Array.isArray(c.tags)) c.tags = typeof c.tags === 'string' ? c.tags.split(',').map(s=>s.trim()).filter(Boolean) : [];
        if (!Array.isArray(c.giftNotes)) c.giftNotes = typeof c.giftNotes === 'string' ? c.giftNotes.split(',').map(s=>s.trim()).filter(Boolean) : [];
    });
}

function loadDisplaySettings() {
    const saved = localStorage.getItem('address_book_field_settings_v5');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                fieldSettings = parsed;
            }
        } catch(e) {
            console.error('表示設定の読み込みエラー:', e);
        }
    }

    const savedDblClick = localStorage.getItem('address_book_dblclick_behavior');
    if (savedDblClick === 'edit' || savedDblClick === 'zoom') {
        doubleClickBehavior = savedDblClick;
    }
    updateDblClickGuideText();

    const savedTheme = localStorage.getItem('address_book_theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
        currentAppTheme = savedTheme;
    }
    applyAppTheme(currentAppTheme);
}

function setAppTheme(theme) {
    currentAppTheme = theme;
    localStorage.setItem('address_book_theme', theme);
    applyAppTheme(theme);
    showToast(theme === 'dark' ? 'ダークモードに変更しました' : 'ライトモードに変更しました', 'info');
}

function toggleThemeQuick() {
    const newTheme = currentAppTheme === 'dark' ? 'light' : 'dark';
    setAppTheme(newTheme);
    const themeDarkRadio = document.getElementById('themeDarkRadio');
    const themeLightRadio = document.getElementById('themeLightRadio');
    if (newTheme === 'light' && themeLightRadio) themeLightRadio.checked = true;
    if (newTheme === 'dark' && themeDarkRadio) themeDarkRadio.checked = true;
}

function applyAppTheme(theme) {
    const html = document.documentElement;
    const icon = document.getElementById('themeToggleIcon');
    const text = document.getElementById('themeToggleText');

    if (theme === 'light') {
        html.classList.remove('dark');
        html.classList.add('theme-light');
        if (icon) icon.className = 'fa-solid fa-moon text-purple-400';
        if (text) text.textContent = 'ダーク';
    } else {
        html.classList.add('dark');
        html.classList.remove('theme-light');
        if (icon) icon.className = 'fa-solid fa-sun text-amber-400';
        if (text) text.textContent = 'ライト';
    }
}

function openSettingsModal() {
    renderSettingsList();
    const zoomRadio = document.getElementById('dblClickZoomRadio');
    const editRadio = document.getElementById('dblClickEditRadio');
    if (doubleClickBehavior === 'edit') {
        if (editRadio) editRadio.checked = true;
    } else {
        if (zoomRadio) zoomRadio.checked = true;
    }

    const themeDarkRadio = document.getElementById('themeDarkRadio');
    const themeLightRadio = document.getElementById('themeLightRadio');
    if (currentAppTheme === 'light') {
        if (themeLightRadio) themeLightRadio.checked = true;
    } else {
        if (themeDarkRadio) themeDarkRadio.checked = true;
    }

    document.getElementById('settingsModal')?.classList.remove('hidden');
}

function closeSettingsModal() {
    document.getElementById('settingsModal')?.classList.add('hidden');
}

function setDblClickBehavior(behavior) {
    doubleClickBehavior = behavior;
    localStorage.setItem('address_book_dblclick_behavior', behavior);
    updateDblClickGuideText();
    showToast(behavior === 'zoom' ? 'ダブルクリック動作を「特大表示」に変更しました' : 'ダブルクリック動作を「編集画面を開く」に変更しました', 'info');
}

function updateDblClickGuideText() {
    const guideEl = document.getElementById('dblClickGuideText');
    if (guideEl) {
        if (doubleClickBehavior === 'edit') {
            guideEl.innerHTML = `<i class="fa-solid fa-user-pen mr-1.5 text-blue-400"></i>カード・行をダブルクリックで編集画面`;
        } else {
            guideEl.innerHTML = `<i class="fa-solid fa-magnifying-glass-plus mr-1.5 text-amber-400"></i>カード・行をダブルクリックで特大表示`;
        }
    }
}

function renderSettingsList() {
    const listEl = document.getElementById('fieldSettingsList');
    if (!listEl) return;

    listEl.innerHTML = fieldSettings.map((field, idx) => `
        <div class="p-2.5 bg-slate-900/90 rounded-xl border border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div class="flex items-center space-x-2 font-bold text-slate-200">
                <span class="text-slate-500 text-[10px] w-4">${idx + 1}.</span>
                <i class="fa-solid ${field.icon} ${field.color}"></i>
                <span>${field.name}</span>
            </div>

            <div class="flex items-center space-x-2 w-full sm:w-auto justify-end">
                <select onchange="updateFieldZone('${field.id}', this.value)" ${field.isLocked ? 'disabled' : ''} class="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 focus:outline-none ${field.isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}">
                    <option value="fixed" ${field.zone === 'fixed' ? 'selected' : ''}>固定表示</option>
                    <option value="scroll" ${field.zone === 'scroll' ? 'selected' : ''}>スクロール表示</option>
                    <option value="fold" ${field.zone === 'fold' ? 'selected' : ''}>詳細表示</option>
                </select>

                <label class="flex items-center space-x-1 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700 cursor-pointer text-[11px] ${field.isLocked ? 'opacity-50 cursor-not-allowed' : ''}">
                    <input type="checkbox" onchange="updateFieldRequired('${field.id}', this.checked)" ${field.isRequired ? 'checked' : ''} ${field.isLocked ? 'disabled' : ''} class="accent-blue-500 rounded">
                    <span class="text-slate-300">必須</span>
                </label>

                <div class="flex items-center space-x-0.5">
                    <button onclick="moveFieldSetting(${idx}, -1)" ${idx === 0 ? 'disabled class="opacity-30"' : ''} class="p-1 text-slate-400 hover:text-white cursor-pointer">
                        <i class="fa-solid fa-chevron-up"></i>
                    </button>
                    <button onclick="moveFieldSetting(${idx}, 1)" ${idx === fieldSettings.length - 1 ? 'disabled class="opacity-30"' : ''} class="p-1 text-slate-400 hover:text-white cursor-pointer">
                        <i class="fa-solid fa-chevron-down"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function updateFieldZone(id, zone) {
    const target = fieldSettings.find(f => f.id === id);
    if (target && !target.isLocked) {
        target.zone = zone;
    }
}

function updateFieldRequired(id, isReq) {
    const target = fieldSettings.find(f => f.id === id);
    if (target && !target.isLocked) {
        target.isRequired = isReq;
    }
}

function moveFieldSetting(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= fieldSettings.length) return;
    const temp = fieldSettings[index];
    fieldSettings[index] = fieldSettings[newIndex];
    fieldSettings[newIndex] = temp;
    renderSettingsList();
}

function resetFieldSettings() {
    fieldSettings = [
        { id: 'name', name: 'お名前（姓・名）', elId: 'fieldName', inputIds: ['inputLastName', 'inputFirstName'], icon: 'fa-user', color: 'text-blue-400', zone: 'fixed', isLocked: true, isRequired: true },
        { id: 'address', name: '郵便番号・住所', elId: 'fieldAddress', inputIds: ['inputAddress'], icon: 'fa-location-dot', color: 'text-emerald-400', zone: 'fixed', isLocked: true, isRequired: true },
        { id: 'phone', name: '電話番号', elId: 'fieldPhone', inputIds: ['inputPhone'], icon: 'fa-phone', color: 'text-green-400', zone: 'scroll', isLocked: false, isRequired: false },
        { id: 'tags', name: 'グループタグ', elId: 'fieldTags', inputIds: ['inputTags'], icon: 'fa-tags', color: 'text-pink-400', zone: 'scroll', isLocked: false, isRequired: false },
        { id: 'giftNotes', name: 'やり取り記録タグ', elId: 'fieldGiftNotes', inputIds: ['inputGiftNotes'], icon: 'fa-gifts', color: 'text-amber-400', zone: 'scroll', isLocked: false, isRequired: false },
        { id: 'furigana', name: 'フリガナ（セイ・メイ）', elId: 'fieldFurigana', inputIds: ['inputLastFurigana', 'inputFirstFurigana'], icon: 'fa-signature', color: 'text-indigo-400', zone: 'fold', isLocked: false, isRequired: false },
        { id: 'jointName', name: '連名（ご家族など）', elId: 'fieldJointName', inputIds: ['inputJointName'], icon: 'fa-users', color: 'text-cyan-400', zone: 'fold', isLocked: false, isRequired: false },
        { id: 'company', name: '会社名 / 所属', elId: 'fieldCompany', inputIds: ['inputCompany'], icon: 'fa-building', color: 'text-purple-400', zone: 'fold', isLocked: false, isRequired: false },
        { id: 'notes', name: '自由メモ', elId: 'fieldNotes', inputIds: ['inputNotes'], icon: 'fa-note-sticky', color: 'text-sky-400', zone: 'fold', isLocked: false, isRequired: false }
    ];
    renderSettingsList();
    showToast('初期設定に戻しました', 'info');
}

function saveDisplaySettingsModal() {
    localStorage.setItem('address_book_field_settings_v5', JSON.stringify(fieldSettings));
    closeSettingsModal();
    applyFilters();
    showToast('表示設定を更新しました', 'info');
}

function loadContacts() {
    const data = localStorage.getItem('address_book_contacts_v6');
    if (data) {
        try {
            contacts = JSON.parse(data);
            normalizeContactsData();
        } catch(e) {
            console.error('データ読み込みエラー:', e);
            contacts = getSampleData();
        }
    } else {
        contacts = getSampleData();
        saveContacts();
    }
}

function saveContacts() {
    normalizeContactsData();
    localStorage.setItem('address_book_contacts_v6', JSON.stringify(contacts));
    updateTagCandidates();
}

function getSampleData() {
    return [
        {
            id: '1',
            lastName: '山田',
            firstName: '太郎',
            lastFurigana: 'ヤマダ',
            firstFurigana: 'タロウ',
            postal: '100-0001',
            zip: '100-0001',
            address: '東京都千代田区千代田1-1',
            jointName: '花子（妻）, 翔太（長男）',
            phone: '03-1234-5678',
            company: '株式会社サンプル',
            tags: ['親戚', '年賀状'],
            giftNotes: ['2026年賀状送付済', 'お歳暮受領'],
            notes: '毎年お中元をいただく。',
            createdAt: Date.now() - 100000
        },
        {
            id: '2',
            lastName: '佐藤',
            firstName: '健一',
            lastFurigana: 'サトウ',
            firstFurigana: 'ケンイチ',
            postal: '530-0001',
            zip: '530-0001',
            address: '大阪府大阪市北区梅田1-2-3',
            jointName: '',
            phone: '06-9876-5432',
            company: '佐藤商事',
            tags: ['仕事', '年賀状'],
            giftNotes: ['2026年賀状受領'],
            notes: '前職の同僚。',
            createdAt: Date.now() - 50000
        }
    ];
}

function updateTagCandidates() {
    const groupSet = new Set();
    const giftSet = new Set();

    contacts.forEach(c => {
        (Array.isArray(c.tags) ? c.tags : []).forEach(t => t && groupSet.add(t));
        (Array.isArray(c.giftNotes) ? c.giftNotes : []).forEach(g => g && giftSet.add(g));
    });

    const tagList = document.getElementById('tagCandidateList');
    if (tagList) tagList.innerHTML = Array.from(groupSet).map(t => `<option value="${t}">`).join('');

    const giftList = document.getElementById('giftCandidateList');
    if (giftList) giftList.innerHTML = Array.from(giftSet).map(g => `<option value="${g}">`).join('');

    const sugGroupEl = document.getElementById('suggestedGroupTags');
    if (sugGroupEl) {
        sugGroupEl.innerHTML = Array.from(groupSet).slice(0, 6).map(t => `
            <button type="button" onclick="addTagDirect('${t}')" class="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-pink-400 rounded-md border border-slate-700">
                + #${t}
            </button>
        `).join('');
    }

    const sugGiftEl = document.getElementById('suggestedGiftNotes');
    if (sugGiftEl) {
        sugGiftEl.innerHTML = Array.from(giftSet).slice(0, 6).map(g => `
            <button type="button" onclick="addGiftNoteDirect('${g}')" class="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-md border border-slate-700">
                + 🎁 ${g}
            </button>
        `).join('');
    }
}

function setupModalFormFields() {
    const pool = document.getElementById('fieldsPool');
    const fixedZone = document.getElementById('fixedZoneContainer');
    const scrollZone = document.getElementById('scrollZoneContainer');
    const foldZone = document.getElementById('foldZoneContainer');

    if (!pool || !fixedZone || !scrollZone || !foldZone) return;

    fixedZone.querySelectorAll('.field-item').forEach(el => el.remove());
    scrollZone.innerHTML = '';
    foldZone.innerHTML = '';

    fieldSettings.forEach(field => {
        const el = document.getElementById(field.elId);
        if (!el) return;

        field.inputIds.forEach(inputId => {
            const reqLabel = document.querySelector(`label[for="${inputId}"] span, #${field.elId} label span`);
            if (reqLabel) {
                reqLabel.style.display = field.isRequired ? 'inline' : 'none';
            }
        });

        el.classList.add('field-item');

        if (field.zone === 'fixed') {
            fixedZone.appendChild(el);
        } else if (field.zone === 'scroll') {
            scrollZone.appendChild(el);
        } else {
            foldZone.appendChild(el);
        }
    });
}

function openModal(id = null) {
    setupModalFormFields();
    updateTagCandidates();

    const modal = document.getElementById('contactModal');
    const form = document.getElementById('contactForm');
    const title = document.getElementById('modalTitle');
    const zipStatus = document.getElementById('zipStatus');

    if (zipStatus) zipStatus.textContent = '';
    form.reset();

    currentModalTags = [];
    currentModalGiftNotes = [];

    if (id) {
        const contact = contacts.find(c => c.id === id);
        if (contact) {
            title.innerHTML = `<i class="fa-solid fa-user-pen mr-2 text-blue-400"></i>連絡先の編集`;
            document.getElementById('contactId').value = contact.id;
            document.getElementById('inputLastName').value = contact.lastName || '';
            document.getElementById('inputFirstName').value = contact.firstName || '';
            document.getElementById('inputLastFurigana').value = contact.lastFurigana || '';
            document.getElementById('inputFirstFurigana').value = contact.firstFurigana || '';
            document.getElementById('inputPostal').value = contact.postal || contact.zip || '';
            document.getElementById('inputAddress').value = contact.address || '';
            document.getElementById('inputJointName').value = contact.jointName || '';
            document.getElementById('inputPhone').value = contact.phone || '';
            document.getElementById('inputCompany').value = contact.company || '';
            document.getElementById('inputNotes').value = contact.notes || '';

            currentModalTags = Array.isArray(contact.tags) ? [...contact.tags] : [];
            currentModalGiftNotes = Array.isArray(contact.giftNotes) ? [...contact.giftNotes] : [];
        }
    } else {
        title.innerHTML = `<i class="fa-solid fa-user-plus mr-2 text-blue-400"></i>新規連絡先の登録`;
        document.getElementById('contactId').value = '';
    }

    renderModalTagBadges();
    modal.classList.remove('hidden');
}

function closeModal() {
    const pool = document.getElementById('fieldsPool');
    fieldSettings.forEach(field => {
        const el = document.getElementById(field.elId);
        if (el && pool) pool.appendChild(el);
    });

    document.getElementById('contactModal')?.classList.add('hidden');
}

function renderModalTagBadges() {
    const tagsList = document.getElementById('modalTagsBadgeList');
    if (tagsList) {
        tagsList.innerHTML = currentModalTags.map((t, idx) => `
            <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-pink-950/80 text-pink-300 border border-pink-700/60">
                #${t}
                <button type="button" onclick="removeModalTag(${idx})" class="ml-1 text-pink-400 hover:text-white cursor-pointer">
                    <i class="fa-solid fa-xmark text-[10px]"></i>
                </button>
            </span>
        `).join('');
    }

    const giftList = document.getElementById('modalGiftNotesBadgeList');
    if (giftList) {
        giftList.innerHTML = currentModalGiftNotes.map((g, idx) => `
            <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-950/80 text-amber-300 border border-amber-700/60">
                🎁 ${g}
                <button type="button" onclick="removeModalGiftNote(${idx})" class="ml-1 text-amber-400 hover:text-white cursor-pointer">
                    <i class="fa-solid fa-xmark text-[10px]"></i>
                </button>
            </span>
        `).join('');
    }
}

function addTagFromInput() {
    const input = document.getElementById('inputTags');
    if (!input) return;
    const val = input.value.trim();
    if (val) {
        val.split(',').forEach(v => {
            const tag = v.trim();
            if (tag && !currentModalTags.includes(tag)) currentModalTags.push(tag);
        });
        input.value = '';
        renderModalTagBadges();
    }
}

function addTagDirect(tag) {
    if (tag && !currentModalTags.includes(tag)) {
        currentModalTags.push(tag);
        renderModalTagBadges();
    }
}

function removeModalTag(idx) {
    currentModalTags.splice(idx, 1);
    renderModalTagBadges();
}

function addGiftNoteFromInput() {
    const input = document.getElementById('inputGiftNotes');
    if (!input) return;
    const val = input.value.trim();
    if (val) {
        val.split(',').forEach(v => {
            const note = v.trim();
            if (note && !currentModalGiftNotes.includes(note)) currentModalGiftNotes.push(note);
        });
        input.value = '';
        renderModalTagBadges();
    }
}

function addGiftNoteDirect(note) {
    if (note && !currentModalGiftNotes.includes(note)) {
        currentModalGiftNotes.push(note);
        renderModalTagBadges();
    }
}

function removeModalGiftNote(idx) {
    currentModalGiftNotes.splice(idx, 1);
    renderModalTagBadges();
}

function toggleAccordion() {
    const content = document.getElementById('foldZoneContainer');
    const icon = document.getElementById('accordionIcon');
    if (content) {
        content.classList.toggle('hidden');
        if (icon) icon.classList.toggle('rotate-180');
    }
}

function saveContact(e) {
    e.preventDefault();

    addTagFromInput();
    addGiftNoteFromInput();

    const id = document.getElementById('contactId').value;
    const lastName = document.getElementById('inputLastName').value.trim();
    const firstName = document.getElementById('inputFirstName').value.trim();
    const postal = document.getElementById('inputPostal').value.trim();
    const address = document.getElementById('inputAddress').value.trim();

    if (!lastName || !firstName || !postal || !address) {
        showToast('必須項目（姓・名・郵便番号・住所）を入力してください', 'error');
        return;
    }

    const contactData = {
        id: id || Date.now().toString(),
        lastName,
        firstName,
        lastFurigana: document.getElementById('inputLastFurigana').value.trim(),
        firstFurigana: document.getElementById('inputFirstFurigana').value.trim(),
        postal,
        zip: postal,
        address,
        jointName: document.getElementById('inputJointName').value.trim(),
        phone: document.getElementById('inputPhone').value.trim(),
        company: document.getElementById('inputCompany').value.trim(),
        tags: [...currentModalTags],
        giftNotes: [...currentModalGiftNotes],
        notes: document.getElementById('inputNotes').value.trim(),
        createdAt: id ? (contacts.find(c => c.id === id)?.createdAt || Date.now()) : Date.now()
    };

    if (id) {
        const index = contacts.findIndex(c => c.id === id);
        if (index !== -1) contacts[index] = contactData;
    } else {
        contacts.unshift(contactData);
    }

    saveContacts();
    closeModal();
    applyFilters();
    showToast(id ? '連絡先を更新しました' : '新しい連絡先を登録しました', 'success');
}

async function searchAddress() {
    const postalInput = document.getElementById('inputPostal');
    const statusEl = document.getElementById('zipStatus');
    if (!postalInput || !statusEl) return;

    let code = postalInput.value.replace(/[^\d]/g, '');
    if (code.length !== 7) {
        statusEl.textContent = '※7桁の郵便番号を入力してください';
        statusEl.className = 'text-[10px] text-amber-400 mt-1 block';
        return;
    }

    statusEl.textContent = '住所を検索中...';
    statusEl.className = 'text-[10px] text-blue-400 mt-1 block';

    try {
        const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${code}`);
        const data = await res.json();

        if (data.results && data.results.length > 0) {
            const result = data.results[0];
            const fullAddr = `${result.address1}${result.address2}${result.address3}`;
            document.getElementById('inputAddress').value = fullAddr;
            statusEl.textContent = '✓ 住所を補完しました';
            statusEl.className = 'text-[10px] text-emerald-400 mt-1 block';
        } else {
            statusEl.textContent = '住所が見つかりませんでした';
            statusEl.className = 'text-[10px] text-rose-400 mt-1 block';
        }
    } catch(err) {
        console.error(err);
        statusEl.textContent = '住所検索に失敗しました';
        statusEl.className = 'text-[10px] text-rose-400 mt-1 block';
    }
}

/* 50音インデックスバー描画 */
function renderKanaIndexBar() {
    const container = document.getElementById('kanaIndexContainer');
    if (!container) return;

    const kanaList = [
        { label: 'すべて', value: 'ALL' },
        { label: 'ア行', value: 'ア' },
        { label: 'カ行', value: 'カ' },
        { label: 'サ行', value: 'サ' },
        { label: 'タ行', value: 'タ' },
        { label: 'ナ行', value: 'ナ' },
        { label: 'ハ行', value: 'ハ' },
        { label: 'マ行', value: 'マ' },
        { label: 'ヤ行', value: 'ヤ' },
        { label: 'ラ行', value: 'ラ' },
        { label: 'ワ行', value: 'ワ' }
    ];

    container.innerHTML = kanaList.map(k => `
        <button onclick="filterByKana('${k.value}')" class="px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition cursor-pointer ${selectedKanaIndex === k.value ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80'}">
            ${k.label}
        </button>
    `).join('');
}

function filterByKana(kana) {
    selectedKanaIndex = kana;
    renderKanaIndexBar();
    applyFilters();
}

function checkKanaRow(furigana, targetRow) {
    if (!furigana) return false;
    const firstChar = furigana.charAt(0);
    const map = {
        'ア': /^[ア-オあ-お]/,
        'カ': /^[カ-コか-こガ-ゴが-ご]/,
        'サ': /^[サ-ソさ-そザ-ゾざ-ぞ]/,
        'タ': /^[タ-トた-とダ-ドだ-ど]/,
        'ナ': /^[ナ-ノな-の]/,
        'ハ': /^[ハ-ホは-ほバ-ボば-ぼパ-ポぱ-ぽ]/,
        'マ': /^[マ-モま-も]/,
        'ヤ': /^[ヤ-ヨや-よ]/,
        'ラ': /^[ラ-ロら-ろ]/,
        'ワ': /^[ワ-ンわ-ん]/
    };
    return map[targetRow] ? map[targetRow].test(firstChar) : true;
}

function applyFilters() {
    const query = document.getElementById('searchInput')?.value.toLowerCase().trim() || '';
    const sortMode = document.getElementById('sortSelect')?.value || 'custom';
    const clearBtn = document.getElementById('clearSearchBtn');

    if (clearBtn) clearBtn.classList.toggle('hidden', query === '');

    renderTagFilterBar();

    let filtered = contacts.filter(item => {
        // 50音行フィルター
        if (selectedKanaIndex !== 'ALL') {
            const furigana = item.lastFurigana || item.firstFurigana || '';
            if (!checkKanaRow(furigana, selectedKanaIndex)) return false;
        }

        // タグフィルター
        if (selectedFilterTag !== 'ALL') {
            const hasGroup = Array.isArray(item.tags) && item.tags.includes(selectedFilterTag);
            const hasGift = Array.isArray(item.giftNotes) && item.giftNotes.includes(selectedFilterTag);
            if (!hasGroup && !hasGift) return false;
        }

        // テキスト検索
        if (!query) return true;
        const matchName = `${item.lastName || ''}${item.firstName || ''}`.toLowerCase().includes(query);
        const matchKana = `${item.lastFurigana || ''}${item.firstFurigana || ''}`.toLowerCase().includes(query);
        const matchAddr = (item.address || '').toLowerCase().includes(query);
        const matchCompany = (item.company || '').toLowerCase().includes(query);
        const matchNotes = (item.notes || '').toLowerCase().includes(query);
        const matchJoint = (item.jointName || '').toLowerCase().includes(query);
        const matchTags = (Array.isArray(item.tags) ? item.tags.join(' ') : '').toLowerCase().includes(query);
        const matchGifts = (Array.isArray(item.giftNotes) ? item.giftNotes.join(' ') : '').toLowerCase().includes(query);

        return matchName || matchKana || matchAddr || matchCompany || matchNotes || matchJoint || matchTags || matchGifts;
    });

    // ソート
    if (sortMode === 'kanaAsc') {
        filtered.sort((a, b) => `${a.lastFurigana || ''}${a.firstFurigana || ''}`.localeCompare(`${b.lastFurigana || ''}${b.firstFurigana || ''}`, 'ja'));
    } else if (sortMode === 'kanaDesc') {
        filtered.sort((a, b) => `${b.lastFurigana || ''}${b.firstFurigana || ''}`.localeCompare(`${a.lastFurigana || ''}${a.firstFurigana || ''}`, 'ja'));
    }

    const countEl = document.getElementById('contactCount');
    if (countEl) countEl.textContent = `${filtered.length} 件`;

    const emptyEl = document.getElementById('emptyState');
    if (emptyEl) emptyEl.classList.toggle('hidden', filtered.length > 0);

    if (currentViewMode === 'card') {
        renderCardView(filtered);
    } else {
        renderTableView(filtered);
    }
}

function renderTagFilterBar() {
    const container = document.getElementById('tagFilterContainer');
    if (!container) return;

    const allTags = new Set();
    contacts.forEach(c => {
        (Array.isArray(c.tags) ? c.tags : []).forEach(t => t && allTags.add(t));
        (Array.isArray(c.giftNotes) ? c.giftNotes : []).forEach(g => g && allTags.add(g));
    });

    let html = `
        <button onclick="filterByTag('ALL')" class="px-3 py-1 rounded-full whitespace-nowrap text-xs font-bold transition cursor-pointer ${selectedFilterTag === 'ALL' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'}">
            すべて (${contacts.length})
        </button>
    `;

    Array.from(allTags).forEach(tag => {
        const count = contacts.filter(c => (c.tags || []).includes(tag) || (c.giftNotes || []).includes(tag)).length;
        const isSelected = selectedFilterTag === tag;
        html += `
            <button onclick="filterByTag('${tag}')" class="px-3 py-1 rounded-full whitespace-nowrap text-xs font-bold transition cursor-pointer ${isSelected ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'}">
                #${tag} (${count})
            </button>
        `;
    });

    container.innerHTML = html;
}

function filterByTag(tag) {
    selectedFilterTag = tag;
    applyFilters();
}

function clearSearch() {
    const input = document.getElementById('searchInput');
    if (input) input.value = '';
    applyFilters();
}

function switchViewMode(mode) {
    currentViewMode = mode;
    const cardBtn = document.getElementById('viewCardBtn');
    const tableBtn = document.getElementById('viewTableBtn');
    const cardContainer = document.getElementById('cardViewContainer');
    const tableContainer = document.getElementById('tableViewContainer');

    if (mode === 'card') {
        cardBtn.className = 'px-2.5 py-1 text-xs rounded-lg transition font-medium cursor-pointer flex items-center space-x-1 bg-blue-600 text-white';
        tableBtn.className = 'px-2.5 py-1 text-xs rounded-lg transition font-medium cursor-pointer flex items-center space-x-1 text-slate-400 hover:text-slate-200';
        cardContainer.classList.remove('hidden');
        tableContainer.classList.add('hidden');
    } else {
        cardBtn.className = 'px-2.5 py-1 text-xs rounded-lg transition font-medium cursor-pointer flex items-center space-x-1 text-slate-400 hover:text-slate-200';
        tableBtn.className = 'px-2.5 py-1 text-xs rounded-lg transition font-medium cursor-pointer flex items-center space-x-1 bg-blue-600 text-white';
        cardContainer.classList.add('hidden');
        tableContainer.classList.remove('hidden');
    }
    applyFilters();
}

function handleCardDblClick(id) {
    if (doubleClickBehavior === 'edit') {
        openModal(id);
    } else {
        openZoomModal(id);
    }
}

function renderCardView(items) {
    const container = document.getElementById('cardViewContainer');
    if (!container) return;

    container.innerHTML = items.map((item, index) => {
        const isFirst = index === 0;
        const isLast = index === items.length - 1;
        const displayPostal = item.postal || item.zip || '';

        let extraHtml = '';
        fieldSettings.forEach(field => {
            if (field.id === 'name' || field.id === 'address') return;

            if (field.id === 'furigana' && (item.lastFurigana || item.firstFurigana)) {
                extraHtml += `<div class="text-[11px] text-indigo-400 font-bold mb-0.5"><i class="fa-solid fa-signature mr-1"></i>${item.lastFurigana || ''} ${item.firstFurigana || ''}</div>`;
            }
            if (field.id === 'jointName' && item.jointName) {
                extraHtml += `<div class="text-xs font-bold text-cyan-300 mb-1"><i class="fa-solid fa-users mr-1"></i>連名: ${item.jointName}</div>`;
            }
            if (field.id === 'phone' && item.phone) {
                extraHtml += `<div class="text-xs font-bold text-emerald-400 mb-1"><i class="fa-solid fa-phone mr-1"></i><a href="tel:${item.phone}" class="hover:underline">${item.phone}</a></div>`;
            }
            if (field.id === 'company' && item.company) {
                extraHtml += `<div class="text-xs text-purple-300 font-medium mb-1"><i class="fa-solid fa-building mr-1"></i>${item.company}</div>`;
            }
            if (field.id === 'tags' && Array.isArray(item.tags) && item.tags.length > 0) {
                extraHtml += `
                    <div class="flex flex-wrap gap-1 my-1">
                        ${item.tags.map(t => `<span class="px-2 py-0.5 bg-pink-950/80 text-pink-300 rounded-md text-[10px] font-bold border border-pink-700/50">#${t}</span>`).join('')}
                    </div>
                `;
            }
            if (field.id === 'giftNotes' && Array.isArray(item.giftNotes) && item.giftNotes.length > 0) {
                extraHtml += `
                    <div class="flex flex-wrap gap-1 my-1">
                        ${item.giftNotes.map(g => `<span class="px-2 py-0.5 bg-amber-950/80 text-amber-300 rounded-md text-[10px] font-bold border border-amber-700/50">🎁 ${g}</span>`).join('')}
                    </div>
                `;
            }
            if (field.id === 'notes' && item.notes) {
                extraHtml += `<div class="text-xs text-slate-300 bg-slate-900/80 p-2 rounded-lg border border-slate-700/60 my-1 whitespace-pre-wrap"><i class="fa-solid fa-note-sticky text-sky-400 mr-1"></i>${item.notes}</div>`;
            }
        });

        return `
            <div id="card-${item.id}"
                 draggable="true"
                 ondragstart="handleDragStart(event, ${index})"
                 ondragover="handleDragOver(event)"
                 ondragleave="handleDragLeave(event)"
                 ondrop="handleDrop(event, ${index})"
                 ondblclick="handleCardDblClick('${item.id}')"
                 class="bg-slate-800 rounded-2xl p-4 border border-slate-700/80 shadow-lg hover:border-slate-600 transition flex flex-col justify-between relative group">

                <div>
                    <div class="flex justify-between items-start mb-2 pb-2 border-b border-slate-700/60">
                        <div>
                            <div class="text-[11px] text-slate-400 font-bold tracking-widest">
                                ${item.lastFurigana || ''} ${item.firstFurigana || ''}
                            </div>
                            <h3 class="text-xl font-black text-slate-100 flex items-center">
                                ${item.lastName || ''} ${item.firstName || ''}
                                <span class="text-xs text-slate-400 ml-1.5 font-normal">様</span>
                            </h3>
                        </div>

                        <div class="flex items-center space-x-1 bg-slate-900/90 p-1 rounded-xl border border-slate-700">
                            <span title="ドラッグで並び替え" class="p-1.5 text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing">
                                <i class="fa-solid fa-grip-vertical text-xs"></i>
                            </span>
                            <button onclick="moveContact(${index}, -1)" ${isFirst ? 'disabled class="p-1 text-slate-600 cursor-not-allowed"' : 'class="p-1 text-slate-400 hover:text-white cursor-pointer"'}>
                                <i class="fa-solid fa-chevron-up text-xs"></i>
                            </button>
                            <button onclick="moveContact(${index}, 1)" ${isLast ? 'disabled class="p-1 text-slate-600 cursor-not-allowed"' : 'class="p-1 text-slate-400 hover:text-white cursor-pointer"'}>
                                <i class="fa-solid fa-chevron-down text-xs"></i>
                            </button>
                            <div class="w-px h-3 bg-slate-700 my-auto"></div>
                            <button onclick="openPrintModal('${item.id}')" title="ハガキ宛名印刷" class="p-1.5 text-emerald-400 hover:text-emerald-300 cursor-pointer">
                                <i class="fa-solid fa-print text-xs"></i>
                            </button>
                            <button onclick="openZoomModal('${item.id}')" title="手書き特大表示" class="p-1.5 text-amber-400 hover:text-amber-300 cursor-pointer">
                                <i class="fa-solid fa-magnifying-glass-plus text-xs"></i>
                            </button>
                            <button onclick="openModal('${item.id}')" title="編集" class="p-1.5 text-blue-400 hover:text-blue-300 cursor-pointer">
                                <i class="fa-solid fa-pen-to-square text-xs"></i>
                            </button>
                            <button onclick="openDeleteModal('${item.id}')" title="削除" class="p-1.5 text-rose-400 hover:text-rose-300 cursor-pointer">
                                <i class="fa-solid fa-trash-can text-xs"></i>
                            </button>
                        </div>
                    </div>

                    <div class="bg-blue-950/60 p-3 rounded-xl border border-blue-900/80 mb-3 space-y-1">
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-mono font-bold text-blue-300">〒 ${displayPostal}</span>
                            <div class="flex space-x-1">
                                <button onclick="copyAddress('${displayPostal}', '${item.address || ''}')" class="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] rounded-lg transition cursor-pointer flex items-center space-x-1 shadow">
                                    <i class="fa-solid fa-copy"></i>
                                    <span>住所</span>
                                </button>
                                <button onclick="shareContactText('${item.id}')" class="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] rounded-lg transition cursor-pointer flex items-center space-x-1 shadow">
                                    <i class="fa-solid fa-share-nodes"></i>
                                    <span>一括</span>
                                </button>
                            </div>
                        </div>
                        <div class="text-sm font-bold text-slate-100 leading-snug tracking-wide">
                            ${item.address || ''}
                        </div>
                    </div>

                    <div class="space-y-1">
                        ${extraHtml}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderTableView(items) {
    const tbody = document.getElementById('tableTbody');
    if (!tbody) return;

    tbody.innerHTML = items.map((item, index) => {
        const isFirst = index === 0;
        const isLast = index === items.length - 1;
        const displayPostal = item.postal || item.zip || '';

        const tagsHtml = (Array.isArray(item.tags) ? item.tags : []).map(t => `<span class="px-1.5 py-0.5 bg-pink-950/80 text-pink-300 rounded text-[10px] font-bold border border-pink-700/50 mr-1">#${t}</span>`).join('');
        const giftsHtml = (Array.isArray(item.giftNotes) ? item.giftNotes : []).map(g => `<span class="px-1.5 py-0.5 bg-amber-950/80 text-amber-300 rounded text-[10px] font-bold border border-amber-700/50 mr-1">🎁 ${g}</span>`).join('');

        return `
            <tr ondblclick="handleCardDblClick('${item.id}')" class="hover:bg-slate-700/40 transition">
                <td class="py-2 px-2 text-center align-middle border-r border-slate-700/50">
                    <div class="grid grid-cols-2 gap-1 w-14 mx-auto">
                        <button onclick="openZoomModal('${item.id}')" title="手書き特大表示" class="p-1.5 bg-slate-900 hover:bg-slate-700 text-amber-400 rounded border border-slate-700 cursor-pointer">
                            <i class="fa-solid fa-magnifying-glass-plus text-xs"></i>
                        </button>
                        <button onclick="openPrintModal('${item.id}')" title="ハガキ印刷" class="p-1.5 bg-slate-900 hover:bg-slate-700 text-emerald-400 rounded border border-slate-700 cursor-pointer">
                            <i class="fa-solid fa-print text-xs"></i>
                        </button>
                        <button onclick="openModal('${item.id}')" title="編集" class="p-1.5 bg-slate-900 hover:bg-slate-700 text-blue-400 rounded border border-slate-700 cursor-pointer">
                            <i class="fa-solid fa-pen-to-square text-xs"></i>
                        </button>
                        <button onclick="openDeleteModal('${item.id}')" title="削除" class="p-1.5 bg-slate-900 hover:bg-slate-700 text-rose-400 rounded border border-slate-700 cursor-pointer">
                            <i class="fa-solid fa-trash-can text-xs"></i>
                        </button>
                    </div>
                </td>

                <td class="py-2 px-1 text-center align-middle border-r border-slate-700/50">
                    <div class="flex flex-col items-center space-y-1">
                        <button onclick="moveContact(${index}, -1)" ${isFirst ? 'disabled class="text-slate-600 cursor-not-allowed"' : 'class="text-slate-400 hover:text-white cursor-pointer"'}>
                            <i class="fa-solid fa-chevron-up text-xs"></i>
                        </button>
                        <button onclick="moveContact(${index}, 1)" ${isLast ? 'disabled class="text-slate-600 cursor-not-allowed"' : 'class="text-slate-400 hover:text-white cursor-pointer"'}>
                            <i class="fa-solid fa-chevron-down text-xs"></i>
                        </button>
                    </div>
                </td>

                <td class="py-2.5 px-3 align-middle">
                    <div class="flex flex-col sm:flex-row sm:items-baseline sm:space-x-2">
                        <span class="text-xs text-slate-400 font-bold">${item.lastFurigana || ''} ${item.firstFurigana || ''}</span>
                        <span class="text-base font-bold text-white">${item.lastName || ''} ${item.firstName || ''} 様</span>
                        ${item.jointName ? `<span class="text-xs text-cyan-300 font-medium">(${item.jointName})</span>` : ''}
                    </div>
                    <div class="text-xs font-bold text-slate-200 mt-0.5">
                        <span class="text-blue-400 font-mono">〒${displayPostal}</span> ${item.address || ''}
                    </div>
                    <div class="flex flex-wrap items-center gap-1 mt-1">
                        ${item.phone ? `<span class="text-[11px] text-emerald-400 font-bold mr-2"><i class="fa-solid fa-phone mr-1"></i>${item.phone}</span>` : ''}
                        ${item.company ? `<span class="text-[11px] text-purple-300 font-medium mr-2"><i class="fa-solid fa-building mr-1"></i>${item.company}</span>` : ''}
                        ${tagsHtml}
                        ${giftsHtml}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/* ドラッグ＆ドロップ 並び替え処理 */
function handleDragStart(e, index) {
    draggedIndex = index;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const card = e.target.closest('[draggable="true"]');
    if (card) card.classList.add('drag-over');
}

function handleDragLeave(e) {
    const card = e.target.closest('[draggable="true"]');
    if (card) card.classList.remove('drag-over');
}

function handleDrop(e, targetIndex) {
    e.preventDefault();
    const card = e.target.closest('[draggable="true"]');
    if (card) card.classList.remove('drag-over');

    if (draggedIndex !== null && draggedIndex !== targetIndex) {
        const movedItem = contacts.splice(draggedIndex, 1)[0];
        contacts.splice(targetIndex, 0, movedItem);
        saveContacts();
        applyFilters();
        showToast('並び順を変更しました', 'info');
    }
    draggedIndex = null;
}

function moveContact(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= contacts.length) return;
    const temp = contacts[index];
    contacts[index] = contacts[newIndex];
    contacts[newIndex] = temp;
    saveContacts();
    applyFilters();
    showToast('順序を移動しました', 'info');
}

/* コピー＆共有処理 */
function copyAddress(postal, address) {
    const textToCopy = `〒${postal || ''}\n${address || ''}`;
    copyTextToClipboard(textToCopy, '✓ 住所をコピーしました');
}

function shareContactText(id) {
    const item = contacts.find(c => c.id === id);
    if (!item) return;
    const text = `【名前】${item.lastName || ''} ${item.firstName || ''} 様\n【郵便番号】〒${item.postal || item.zip || ''}\n【住所】${item.address || ''}\n【電話】${item.phone || 'なし'}\n【会社】${item.company || 'なし'}`;
    copyTextToClipboard(text, '✓ 連絡先情報をコピーしました (LINE/メール用)');
}

function copyTextToClipboard(text, successMsg) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showToast(successMsg, 'success');
        }).catch(() => fallbackCopy(text, successMsg));
    } else {
        fallbackCopy(text, successMsg);
    }
}

function fallbackCopy(text, successMsg) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        showToast(successMsg, 'success');
    } catch (err) {
        showToast('コピーに失敗しました', 'error');
    }
    document.body.removeChild(textArea);
}

/* 特大表示モーダル制御 */
function openZoomModal(id) {
    const item = contacts.find(c => c.id === id);
    if (!item) return;

    printTargetId = id;

    document.getElementById('zoomFurigana').textContent = `${item.lastFurigana || ''} ${item.firstFurigana || ''}`;
    document.getElementById('zoomName').textContent = `${item.lastName || ''} ${item.firstName || ''}`;

    const jointEl = document.getElementById('zoomJointName');
    const jointTextEl = document.getElementById('zoomJointNameText');
    if (item.jointName) {
        jointTextEl.textContent = item.jointName;
        jointEl.classList.remove('hidden');
    } else {
        jointEl.classList.add('hidden');
    }

    const displayPostal = item.postal || item.zip || '';
    document.getElementById('zoomPostal').textContent = `〒 ${displayPostal}`;
    document.getElementById('zoomAddress').textContent = item.address || '';

    document.getElementById('zoomCopyBtn').onclick = () => copyAddress(displayPostal, item.address || '');

    const phoneBox = document.getElementById('zoomPhoneBox');
    if (item.phone) {
        document.getElementById('zoomPhone').textContent = item.phone;
        phoneBox.classList.remove('hidden');
    } else {
        phoneBox.classList.add('hidden');
    }

    const companyBox = document.getElementById('zoomCompanyBox');
    if (item.company) {
        document.getElementById('zoomCompany').textContent = item.company;
        companyBox.classList.remove('hidden');
    } else {
        companyBox.classList.add('hidden');
    }

    const notesBox = document.getElementById('zoomNotesBox');
    if (item.notes) {
        document.getElementById('zoomNotes').textContent = item.notes;
        notesBox.classList.remove('hidden');
    } else {
        notesBox.classList.add('hidden');
    }

    setZoomScale(1);
    document.getElementById('zoomModal').classList.remove('hidden');
}

function closeZoomModal() {
    document.getElementById('zoomModal').classList.add('hidden');
}

function setZoomScale(scale) {
    currentZoomScale = scale;
    const container = document.getElementById('zoomScaleContainer');
    if (container) {
        container.style.transform = `scale(${scale})`;
    }

    [1, 1.25, 1.5, 1.8].forEach(s => {
        const btn = document.getElementById(`zoomScale${s.toString().replace('.', '')}`);
        if (btn) {
            if (s === scale) {
                btn.className = 'px-2 py-1 rounded-lg transition font-bold bg-amber-500 text-slate-950';
            } else {
                btn.className = 'px-2 py-1 rounded-lg transition font-bold text-slate-300 hover:text-white';
            }
        }
    });
}

function copyAddressFromZoom() {
    const postal = document.getElementById('zoomPostal').textContent.replace('〒 ', '');
    const address = document.getElementById('zoomAddress').textContent;
    copyAddress(postal, address);
}

function shareContactTextFromZoom() {
    if (printTargetId) shareContactText(printTargetId);
}

function openPrintModalFromZoom() {
    closeZoomModal();
    if (printTargetId) openPrintModal(printTargetId);
}

/* ハガキ宛名印刷モーダル */
function openPrintModal(id) {
    const item = contacts.find(c => c.id === id);
    if (!item) return;

    document.getElementById('printName').textContent = `${item.lastName || ''} ${item.firstName || ''}`;
    document.getElementById('printPostalCode').textContent = item.postal || item.zip || '';
    document.getElementById('printAddress').textContent = item.address || '';

    document.getElementById('printModal').classList.remove('hidden');
}

function closePrintModal() {
    document.getElementById('printModal').classList.add('hidden');
}

/* 削除モーダル */
function openDeleteModal(id) {
    deleteTargetId = id;
    document.getElementById('deleteModal').classList.remove('hidden');
}

function closeDeleteModal() {
    deleteTargetId = null;
    document.getElementById('deleteModal').classList.add('hidden');
}

function confirmDelete() {
    if (deleteTargetId) {
        contacts = contacts.filter(c => c.id !== deleteTargetId);
        saveContacts();
        closeDeleteModal();
        applyFilters();
        showToast('連絡先を削除しました', 'info');
    }
}

/* データ管理 (JSON/CSV 保存・復元) - スマホ安定化対応 */
function openDataModal() {
    document.getElementById('dataModal').classList.remove('hidden');
}

function closeDataModal() {
    document.getElementById('dataModal').classList.add('hidden');
}

function exportJSON() {
    normalizeContactsData();
    const jsonStr = JSON.stringify(contacts, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.download = `smart_address_book_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('バックアップJSONをダウンロードしました', 'success');
}

function exportCSV() {
    normalizeContactsData();
    let csv = "\uFEFF"; // UTF-8 BOM
    csv += "姓,名,セイ,メイ,郵便番号,住所,連名,電話番号,会社名,グループタグ,やり取り記録,自由メモ\n";

    contacts.forEach(c => {
        const row = [
            c.lastName || '',
            c.firstName || '',
            c.lastFurigana || '',
            c.firstFurigana || '',
            c.postal || c.zip || '',
            c.address || '',
            c.jointName || '',
            c.phone || '',
            c.company || '',
            Array.isArray(c.tags) ? c.tags.join(';') : '',
            Array.isArray(c.giftNotes) ? c.giftNotes.join(';') : '',
            c.notes || ''
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
        csv += row + "\n";
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `address_book_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('CSVファイルを保存しました (Excel等で開けます)', 'success');
}

function importDataFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (event) => {
        try {
            const content = event.target.result;
            let success = false;

            // 1. まずJSON形式としてのパースを試みる (拡張子が.txtや無拡張子の場合にも対応)
            try {
                const imported = JSON.parse(content);
                const dataArray = Array.isArray(imported) ? imported : (imported.contacts || imported.data);
                if (Array.isArray(dataArray) && dataArray.length > 0) {
                    contacts = dataArray;
                    normalizeContactsData();
                    saveContacts();
                    applyFilters();
                    closeDataModal();
                    showToast(`✓ ${contacts.length}件の連絡先を復元しました`, 'success');
                    success = true;
                }
            } catch (jsonErr) {
                // JSONでない場合はCSVパースへスキップ
            }

            // 2. JSONパースで復元できなかった場合、CSVパースを試行
            if (!success) {
                const csvSuccess = parseCSVAndImport(content);
                if (!csvSuccess) {
                    showToast('ファイルの形式を自動判定できませんでした (JSON/CSV)', 'error');
                }
            }
        } catch(err) {
            console.error(err);
            showToast('ファイルの読み込みに失敗しました', 'error');
        } finally {
            e.target.value = ''; // 次回同じファイルを選択してもonchangeが発生するようにリセット
        }
    };

    reader.readAsText(file, 'UTF-8');
}

function parseCSVAndImport(csvText) {
    if (!csvText || typeof csvText !== 'string') return false;
    const lines = csvText.split(/\r\n|\n/).filter(line => line.trim());
    if (lines.length <= 1) {
        return false;
    }

    const newContacts = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVRow(lines[i]);
        if (cols.length < 2) continue;

        newContacts.push({
            id: (Date.now() + i).toString(),
            lastName: cols[0] || '',
            firstName: cols[1] || '',
            lastFurigana: cols[2] || '',
            firstFurigana: cols[3] || '',
            postal: cols[4] || '',
            zip: cols[4] || '',
            address: cols[5] || '',
            jointName: cols[6] || '',
            phone: cols[7] || '',
            company: cols[8] || '',
            tags: cols[9] ? cols[9].split(';').map(s=>s.trim()).filter(Boolean) : [],
            giftNotes: cols[10] ? cols[10].split(';').map(s=>s.trim()).filter(Boolean) : [],
            notes: cols[11] || '',
            createdAt: Date.now()
        });
    }

    if (newContacts.length > 0) {
        contacts = newContacts;
        saveContacts();
        applyFilters();
        closeDataModal();
        showToast(`✓ CSVから ${newContacts.length}件の連絡先を取り込みました`, 'success');
        return true;
    }
    return false;
}

function parseCSVRow(rowText) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < rowText.length; i++) {
        const char = rowText[i];
        if (char === '"') {
            if (inQuotes && rowText[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

/* PWA 関連 */
function initPWA() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        const btnArea = document.getElementById('pwaInstallPromptBtnArea');
        if (btnArea) btnArea.classList.remove('hidden');
    });
}

function openPwaModal() {
    document.getElementById('pwaModal').classList.remove('hidden');
}

function closePwaModal() {
    document.getElementById('pwaModal').classList.add('hidden');
}

function triggerPwaInstall() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                showToast('アプリをインストールしました', 'success');
            }
            deferredPrompt = null;
            closePwaModal();
        });
    }
}

/* トースト通知機能 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    let bgClass = 'bg-slate-800 text-slate-100 border-slate-700';
    let icon = '<i class="fa-solid fa-circle-info text-blue-400 mr-2"></i>';

    if (type === 'success') {
        bgClass = 'bg-emerald-950 text-emerald-100 border-emerald-700';
        icon = '<i class="fa-solid fa-circle-check text-emerald-400 mr-2"></i>';
    } else if (type === 'error') {
        bgClass = 'bg-rose-950 text-rose-100 border-rose-700';
        icon = '<i class="fa-solid fa-circle-exclamation text-rose-400 mr-2"></i>';
    }

    toast.className = `${bgClass} border px-4 py-2.5 rounded-xl shadow-2xl text-xs font-bold flex items-center transform transition-all duration-300 translate-y-2 opacity-0 pointer-events-auto`;
    toast.innerHTML = `${icon}<span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}