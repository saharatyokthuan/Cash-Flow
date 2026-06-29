// ── 1. LOCALSTORAGE KEY NAME ──
const STORAGE_KEY = 'budgetCtrl_LocalData';

// ── 2. GLOBAL VARIABLES ──
window.items = [];
window.wallets = [];
window.installments = [];
window.categories = {};
window.budgets = [];
window.upcoming = [];
window.editTargetId = null;

// ── 3. DEFAULT DATA ──
const DEFAULT_DATA = {
  items: [],
  wallets: [
    { id: 1, name: 'เงินสด', init: 0 },
    { id: 2, name: 'PromptPay', init: 0 }
  ],
  installments: [],
  categories: {
    income: ['เงินเดือน', 'ยืม', 'อื่นๆ'],
    expense: ['อาหาร', 'เดินทาง', 'ค่าเช่า', 'บันเทิง', 'ค่าน้ำไฟ', 'อินเทอร์เน็ต', 'ผ่อนมือถือ', 'ผ่อนสินเชื่อ', 'คืน', 'อื่นๆ']
  },
  budgets: [],
  upcoming: []
};

// ── 4. TIMEZONE & DATE SETUP (GMT+7) ──
const tzoffset = (new Date()).getTimezoneOffset() * 60000;
const today = (new Date(Date.now() - tzoffset)).toISOString().split('T')[0];

// ── 5. SAVE / LOAD ──
function saveLocalStorage() {
  const data = {
    items: window.items || [],
    wallets: window.wallets || [],
    installments: window.installments || [],
    categories: window.categories || {},
    budgets: window.budgets || [],
    upcoming: window.upcoming || []
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadLocalStorage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const data = JSON.parse(saved);
      window.items = data.items || [];
      window.wallets = data.wallets || DEFAULT_DATA.wallets;
      window.installments = data.installments || [];
      window.categories = data.categories || DEFAULT_DATA.categories;
      window.budgets = data.budgets || [];
      window.upcoming = data.upcoming || [];
    } catch (e) {
      loadDefault();
    }
  } else {
    loadDefault();
  }
}

function loadDefault() {
  window.items = [...DEFAULT_DATA.items];
  window.wallets = [...DEFAULT_DATA.wallets];
  window.installments = [...DEFAULT_DATA.installments];
  window.categories = {
    income: [...DEFAULT_DATA.categories.income],
    expense: [...DEFAULT_DATA.categories.expense]
  };
  window.budgets = [...DEFAULT_DATA.budgets];
  window.upcoming = [...DEFAULT_DATA.upcoming];
  saveLocalStorage();
}

// ── 6. HELPERS ──
function escapeHtml(str) {
  if (!str) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(str).replace(/[&<>"']/g, m => map[m]);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (t) { t.innerText = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2000); }
}

function updateCategoryDropdown(type, selectId, cur = '') {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const cats = window.categories[type] || [];
  sel.innerHTML = cats.map(c =>
    `<option value="${escapeHtml(c)}" ${c === cur ? 'selected' : ''}>${escapeHtml(c)}</option>`
  ).join('');
}

function getWalletBalance(walletId) {
  const items = window.items || [];
  const inc = items.filter(i => i.type === 'income' && i.walletId === walletId).reduce((s, i) => s + i.amount, 0);
  const exp = items.filter(i => i.type === 'expense' && i.walletId === walletId).reduce((s, i) => s + i.amount, 0);
  const w = window.wallets.find(w => w.id === walletId);
  const init = w ? (w.init || 0) : 0;
  return init + inc - exp;
}

// ── 7. CONFIRM MODAL (ใหม่) ──
let confirmResolver = null;

function showConfirmModal(message, isDanger = true) {
  return new Promise((resolve) => {
    const bg = document.getElementById('confirmModalBg');
    const title = document.getElementById('confirmTitle');
    const msg = document.getElementById('confirmMessage');
    const yesBtn = document.getElementById('confirmYesBtn');
    
    msg.innerText = message;
    if (isDanger) {
      title.style.color = 'var(--red)';
      yesBtn.style.borderColor = 'var(--red) !important';
      yesBtn.style.color = 'var(--red)';
      title.innerText = '⚠️ ยืนยันการลบ';
    } else {
      title.style.color = 'var(--gold)';
      yesBtn.style.borderColor = 'var(--gold-dim) !important';
      yesBtn.style.color = 'var(--gold)';
      title.innerText = '⚠️ ยืนยันการดำเนินการ';
    }
    bg.classList.add('open');
    confirmResolver = resolve;
  });
}

// ── 8. DROPDOWNS ──
function updateWalletDropdowns() {
  const wallets = window.wallets || [];
  const opts = wallets.map(w => `<option value="${w.id}">${escapeHtml(w.name)}</option>`).join('');
  ['walletSelect', 'transferFrom', 'transferTo', 'instPayWallet', 'editWallet'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
  const tTo = document.getElementById('transferTo');
  if (tTo && wallets.length > 1) tTo.value = wallets[1]?.id || wallets[0]?.id || '';
}


// ── 9. NOTE TOGGLE ──
function toggleNoteInput() {
  const input = document.getElementById('noteInput');
  const btn = document.getElementById('noteToggleBtn');
  if (!input || !btn) return;
  if (input.style.display === 'none' || !input.style.display) {
    input.style.display = 'block';
    btn.textContent = '✖ ไม่ต้องใช้หมายเหตุ';
    input.focus();
  } else {
    input.style.display = 'none';
    input.value = '';
    btn.textContent = 'หมายเหตุ';
  }
}

// ── 10. ADD / DEL / EDIT TRANSACTION ──
function addItem() {
  const name = document.getElementById('nameInput').value.trim();
  const amount = parseFloat(document.getElementById('amountInput').value);
  const type = document.getElementById('typeSelect').value;
  const date = document.getElementById('dateInput').value || today;
  const note = document.getElementById('noteInput').value.trim();
  const category = document.getElementById('categorySelect').value;
  const walletId = parseInt(document.getElementById('walletSelect').value) || (window.wallets[0]?.id || 1);

  if (!name || isNaN(amount) || amount <= 0) return showToast('กรุณากรอกข้อมูลให้ครบ');

  window.items.push({ id: Date.now(), name, amount, type, date, note, category, walletId });
  saveLocalStorage();

  document.getElementById('nameInput').value = '';
  document.getElementById('amountInput').value = '';
  const noteInp = document.getElementById('noteInput');
  if (noteInp) { noteInp.value = ''; noteInp.style.display = 'none'; }
  const noteBtn = document.getElementById('noteToggleBtn');
  if (noteBtn) noteBtn.textContent = 'หมายเหตุ';

  renderList();
  updateSummary();
}

// ✅ ใช้ Confirm Modal
async function deleteItem(id) {
  if (await showConfirmModal('คุณแน่ใจว่าต้องการลบรายการนี้?')) {
    window.items = window.items.filter(i => i.id !== id);
    saveLocalStorage();
    renderList();
    updateSummary();
    showToast('ลบแล้ว');
  }
}

// ✅ ใช้ Confirm Modal
async function clearAll() {
  if (window.items.length && await showConfirmModal('ล้างข้อมูลทั้งหมด?')) {
    window.items = [];
    saveLocalStorage();
    renderList();
    updateSummary();
    showToast('ล้างข้อมูลแล้ว');
  }
}


function openEdit(id) {
  const item = window.items.find(i => i.id === id);
  if (!item) return;
  window.editTargetId = id;
  document.getElementById('editId').value = id;
  document.getElementById('editDate').value = item.date;
  document.getElementById('editName').value = item.name;
  document.getElementById('editNote').value = item.note || '';
  document.getElementById('editAmount').value = item.amount;
  document.getElementById('editType').value = item.type;
  updateCategoryDropdown(item.type, 'editCategory', item.category);
  updateWalletDropdowns();
  const editWalletSel = document.getElementById('editWallet');
  if (editWalletSel) editWalletSel.value = item.walletId;
  document.getElementById('modalBg').classList.add('open');
}

function closeModal() { document.getElementById('modalBg').classList.remove('open'); }

function saveEdit() {
  const id = parseInt(document.getElementById('editId').value);
  const idx = window.items.findIndex(i => i.id === id);
  if (idx === -1) return;
  const amount = parseFloat(document.getElementById('editAmount').value);
  const name = document.getElementById('editName').value.trim();
  if (!name || isNaN(amount) || amount <= 0) return showToast('ข้อมูลไม่ถูกต้อง');

  const walletId = parseInt(document.getElementById('editWallet').value) || window.items[idx].walletId;
  window.items[idx] = {
    ...window.items[idx],
    date: document.getElementById('editDate').value,
    name,
    note: document.getElementById('editNote').value.trim(),
    amount,
    type: document.getElementById('editType').value,
    category: document.getElementById('editCategory').value,
    walletId
  };
  saveLocalStorage();
  closeModal();
  renderList();
  updateSummary();
  showToast('บันทึกแล้ว');
}

function downloadCSV() {
  if (!window.items.length) return showToast('ไม่มีข้อมูล');
  let csv = 'วันที่,รายการ,หมายเหตุ,หมวดหมู่,ประเภท,จำนวน\n';
  window.items.forEach(i => {
    csv += `${i.date},"${i.name}","${i.note || ''}","${i.category || ''}",${i.type === 'income' ? 'รายรับ' : 'รายจ่าย'},${i.amount}\n`;
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv' }));
  a.download = `budget_${today}.csv`;
  a.click();
}

function renderList() {
  // list ย้ายไปหน้า SEARCH แล้ว — ฟังก์ชันนี้คงไว้เพื่อไม่ให้ error
  // การแสดงรายการทำผ่าน searchItems() ที่หน้า SEARCH แทน
}

function updateSummary() {
  const items = window.items || [];
  let inc = 0, exp = 0;
  items.forEach(i => { if (i.type === 'income') inc += i.amount; else exp += i.amount; });
  const incEl = document.getElementById('totalIncome');
  const expEl = document.getElementById('totalExpense');
  const balEl = document.getElementById('balance');
  if (incEl) incEl.innerText = inc.toLocaleString();
  if (expEl) expEl.innerText = exp.toLocaleString();
  if (balEl) balEl.innerText = (inc - exp).toLocaleString();
}

// ── 11. WALLET MANAGEMENT ──
function addWallet() {
  const name = document.getElementById('walletNameInput').value.trim();
  const init = parseFloat(document.getElementById('walletInitInput').value) || 0;
  if (!name) return showToast('กรุณากรอกชื่อบัญชี');
  if (window.wallets.find(w => w.name === name)) return showToast('มีบัญชีนี้แล้ว');
  const id = Date.now();
  window.wallets.push({ id, name, init });
  saveLocalStorage();
  document.getElementById('walletNameInput').value = '';
  document.getElementById('walletInitInput').value = '0';
  renderWalletPage();
  updateWalletDropdowns();
  showToast('เพิ่มบัญชีแล้ว');
}

function displayCurrentDate() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const formattedDate = `${day}/${month}/${year}`;
  const el = document.getElementById('currentDate');
  if (el) el.textContent = ` [${formattedDate}]`;
}

// ✅ ใช้ Confirm Modal
async function deleteWallet(id) {
  if (window.wallets.length <= 1) return showToast('ต้องมีบัญชีอย่างน้อย 1 บัญชี');
  
  const hasTransfer = window.items.some(i => i.transferId && (i.walletId === id));
  if (hasTransfer && !await showConfirmModal('บัญชีนี้มีรายการโอนเงินอยู่ ยืนยันลบ?')) return;
  
  const used = window.items.some(i => i.walletId === id && !i.transferId);
  if (used && !await showConfirmModal('บัญชีนี้มีรายการอยู่ ยืนยันลบ?')) return;
  
  if (!await showConfirmModal('คุณแน่ใจว่าต้องการลบบัญชีนี้?')) return;
  
  window.wallets = window.wallets.filter(w => w.id !== id);
  saveLocalStorage();
  renderWalletPage();
  updateWalletDropdowns();
  showToast('ลบบัญชีแล้ว');
}

function doTransfer() {
  const fromId = parseInt(document.getElementById('transferFrom').value);
  const toId = parseInt(document.getElementById('transferTo').value);
  const amount = parseFloat(document.getElementById('transferAmount').value);
  const note = document.getElementById('transferNote').value.trim();
  if (fromId === toId) return showToast('บัญชีต้นทางและปลายทางห้ามเดียวกัน');
  if (isNaN(amount) || amount <= 0) return showToast('กรุณากรอกจำนวนเงิน');

  const fromName = window.wallets.find(w => w.id === fromId)?.name || '';
  const toName = window.wallets.find(w => w.id === toId)?.name || '';
  const ts = Date.now();
  const transferId = ts + Math.random() * 1000;
  window.items.push({ id: ts, name: `โอน → ${toName}`, amount, type: 'expense', date: today, note: note || 'โอนเงิน', category: 'โอน', walletId: fromId, transferId });
  window.items.push({ id: ts + 1, name: `รับโอน ← ${fromName}`, amount, type: 'income', date: today, note: note || 'โอนเงิน', category: 'โอน', walletId: toId, transferId });
  saveLocalStorage();
  document.getElementById('transferAmount').value = '';
  document.getElementById('transferNote').value = '';
  renderWalletPage();
  renderList();
  updateSummary();
  showToast(`โอน ${amount.toLocaleString()} ฿ สำเร็จ`);
}

function renderWalletPage() {
  const wallets = window.wallets || [];
  const grid = document.getElementById('walletSummary');
  if (grid) {
    grid.innerHTML = wallets.map(w => {
      const bal = getWalletBalance(w.id);
      return `<div class="wsc-card"><div class="wsc-name">${escapeHtml(w.name)}</div><div class="wsc-bal" style="color:${bal >= 0 ? 'var(--gold)' : 'var(--red)'}">${bal.toLocaleString()} ฿</div></div>`;
    }).join('');
  }
  const list = document.getElementById('walletList');
  if (list) {
    if (!wallets.length) { list.innerHTML = '<div class="empty">— ไม่มีบัญชี —</div>'; return; }
    list.innerHTML = wallets.map(w => {
      const bal = getWalletBalance(w.id);
      const txCount = window.items.filter(i => i.walletId === w.id).length;
      return `<div class="wallet-card">
        <div><div class="wc-name">👛 ${escapeHtml(w.name)}</div><div class="wc-meta">${txCount} รายการ · ยอดเริ่ม ${(w.init || 0).toLocaleString()} ฿</div></div>
        <div style="display:flex;align-items:center;gap:0.7rem">
          <div class="wc-bal" style="color:${bal >= 0 ? 'var(--gold)' : 'var(--red)'}">${bal.toLocaleString()} ฿</div>
          ${wallets.length > 1 ? `<button class="btn-wallet-del" onclick="deleteWallet(${w.id})">✕</button>` : ''}
        </div>
      </div>`;
    }).join('');
  }
  updateWalletDropdowns();
}

// ── 12. LOAN TRACKER ──
let loanDisplayMode = 'person';

function setLoanTab(mode, el) { loanDisplayMode = mode; document.querySelectorAll('.loan-tab').forEach(b => b.classList.remove('active')); if (el) el.classList.add('active'); renderLoan(); }

function renderLoan() {
  const items = window.items || [];
  const borrows = items.filter(i => i.type === 'income' && i.category === 'ยืม');
  const repays = items.filter(i => i.type === 'expense' && i.category === 'คืน');
  const totalBorrow = borrows.reduce((s, i) => s + i.amount, 0);
  const totalRepaid = repays.reduce((s, i) => s + i.amount, 0);
  const remain = totalBorrow - totalRepaid;
  document.getElementById('loanTotalBorrow').innerText = totalBorrow.toLocaleString() + ' ฿';
  document.getElementById('loanTotalRepaid').innerText = totalRepaid.toLocaleString() + ' ฿';
  const remEl = document.getElementById('loanTotalRemain');
  remEl.innerText = remain.toLocaleString() + ' ฿';
  remEl.style.color = remain > 0 ? 'var(--red)' : (remain < 0 ? 'var(--green)' : 'var(--muted)');

  if (loanDisplayMode === 'list') {
    document.getElementById('loanListHeader').innerText = `รายการทั้งหมด (${borrows.length + repays.length})`;
    const all = [...borrows.map(i => ({ ...i, ltype: 'borrow' })), ...repays.map(i => ({ ...i, ltype: 'repay' }))].sort((a, b) => b.date.localeCompare(a.date));
    document.getElementById('loanList').innerHTML = all.length ? all.map(i => `
      <div class="item ${i.ltype === 'borrow' ? 'income' : 'expense'}">
        <div class="item-left" style="flex:1">
          <div class="name">${escapeHtml(i.name)}<span style="font-size:0.62rem;color:var(--muted)"> ${i.ltype === 'borrow' ? '(ยืม)' : '(คืน)'}</span></div>
          <div class="meta">${escapeHtml(i.date)}${i.note ? ' · ' + escapeHtml(i.note) : ''}</div>
        </div>
        <div class="item-right">
          <div class="amount" style="color:${i.ltype === 'borrow' ? 'var(--red)' : 'var(--green)'}">${i.ltype === 'borrow' ? '+' : '-'}${i.amount.toLocaleString()}</div>
        </div>
      </div>`).join('') : '<div class="empty">— ไม่มีรายการ —</div>';
  } else {
    document.getElementById('loanListHeader').innerText = 'สรุปรายคน';
    const persons = new Map();
    borrows.forEach(i => { let p = persons.get(i.name) || { borrow: 0, repay: 0, txns: [] }; p.borrow += i.amount; p.txns.push({ ...i, ltype: 'borrow' }); persons.set(i.name, p); });
    repays.forEach(i => { let p = persons.get(i.name) || { borrow: 0, repay: 0, txns: [] }; p.repay += i.amount; p.txns.push({ ...i, ltype: 'repay' }); persons.set(i.name, p); });
    const sorted = [...persons.entries()].sort((a, b) => (b[1].borrow - b[1].repay) - (a[1].borrow - a[1].repay));
    if (!sorted.length) { document.getElementById('loanList').innerHTML = '<div class="empty">— ไม่มีข้อมูล —</div>'; return; }
    document.getElementById('loanList').innerHTML = sorted.map(([name, data]) => {
      const rem = data.borrow - data.repay;
      const cleared = rem <= 0;
      const pct = data.borrow > 0 ? Math.min((data.repay / data.borrow) * 100, 100).toFixed(0) : 100;
      const rows = [...data.txns].sort((a, b) => b.date.localeCompare(a.date)).map(t => `
        <div class="person-txn-row">
          <span>${t.ltype === 'borrow' ? '📥 ยืม' : '📤 คืน'}</span>
          <span>${escapeHtml(t.date)}</span>
          <span style="color:${t.ltype === 'borrow' ? 'var(--red)' : 'var(--green)'}">${t.ltype === 'borrow' ? '+' : '-'}${t.amount.toLocaleString()} ฿</span>
        </div>`).join('');
      return `<div class="person-card ${cleared ? 'cleared' : ''}">
        <div class="person-top"><span class="person-name">${escapeHtml(name)} ${cleared ? '<span class="loan-done-badge">✓ เคลียร์</span>' : ''}</span><span class="person-remain" style="color:${rem > 0 ? 'var(--red)' : 'var(--green)'}">${rem > 0 ? '+' : ''}${rem.toLocaleString()} ฿</span></div>
        <div class="person-prog"><div class="person-prog-fill" style="width:${pct}%"></div></div>
        <div class="person-prog-text">คืนแล้ว ${data.repay.toLocaleString()} / ${data.borrow.toLocaleString()} ฿ (${pct}%)</div>
        <div class="person-txns">${rows}</div>
      </div>`;
    }).join('');
  }
}

// ── 13. INSTALLMENT ──
let instTab = 'phone';

function setInstTab(type, el) { instTab = type; document.querySelectorAll('.inst-tab').forEach(b => b.classList.remove('active')); if (el) el.classList.add('active'); renderInstallment(); }

function addInstallment() {
  const name = document.getElementById('instName').value.trim();
  const total = parseFloat(document.getElementById('instTotal').value);
  const monthly = parseFloat(document.getElementById('instMonthly').value);
  const terms = parseInt(document.getElementById('instTerms').value);
  const paid = parseInt(document.getElementById('instPaid').value) || 0;
  const date = document.getElementById('instDate').value || today;
  const note = document.getElementById('instNote').value.trim();
  if (!name || isNaN(total) || isNaN(monthly) || isNaN(terms) || terms < 1) return showToast('กรอกข้อมูลให้ครบ');
  if (paid > terms) return showToast('งวดที่จ่ายเกินจำนวนงวด');

  window.installments.push({ id: Date.now(), name, total, monthly, terms, type: instTab, date, note, paidTerms: paid, payments: [] });
  saveLocalStorage();
  ['instName', 'instTotal', 'instMonthly', 'instTerms', 'instNote'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('instPaid').value = '0';
  renderInstallment();
  showToast('เพิ่มรายการแล้ว');
}

// ✅ ใช้ Confirm Modal
async function deleteInstallment(id) {
  if (await showConfirmModal('คุณแน่ใจว่าต้องการลบรายการผ่อนนี้?')) {
    window.installments = window.installments.filter(i => i.id !== id);
    saveLocalStorage();
    renderInstallment();
    showToast('ลบแล้ว');
  }
}

function openInstPayModal(id) {
  const inst = window.installments.find(i => i.id === id);
  if (!inst) return;
  const remTerms = inst.terms - inst.paidTerms;
  document.getElementById('instPayId').value = id;
  document.getElementById('instPayQty').value = 1;
  document.getElementById('instPayQty').max = remTerms;
  document.getElementById('instPayDate').value = today;
  document.getElementById('instPayNote').value = '';
  document.getElementById('instPayTitle').innerText = `💳 จ่ายงวด ${inst.name} (เหลือ ${remTerms} งวด × ${inst.monthly.toLocaleString()} ฿)`;
  updateWalletDropdowns();
  document.getElementById('instPayModalBg').classList.add('open');
}

function closeInstPayModal() { document.getElementById('instPayModalBg').classList.remove('open'); }

function saveInstPay() {
  const id = parseInt(document.getElementById('instPayId').value);
  const qty = parseInt(document.getElementById('instPayQty').value);
  const date = document.getElementById('instPayDate').value || today;
  const note = document.getElementById('instPayNote').value.trim();
  const walletId = parseInt(document.getElementById('instPayWallet').value) || (window.wallets[0]?.id || 1);
  if (isNaN(qty) || qty < 1) return showToast('กรุณากรอกจำนวนงวด');
  const inst = window.installments.find(i => i.id === id);
  if (!inst) return;
  const remTerms = inst.terms - inst.paidTerms;
  if (qty > remTerms) return showToast(`จ่ายได้สูงสุด ${remTerms} งวด`);

  inst.paidTerms += qty;
  const now = Date.now() + Math.random() * 1000;
  const amount = qty * inst.monthly;
  inst.payments.push({ id: now, qty, amount, date, note });

  window.items.push({
    id: now,
    name: `ผ่อนชำระ: ${inst.name} (งวดที่ ${inst.paidTerms})`,
    amount,
    type: 'expense',
    date,
    note: note || `จ่ายผ่อนชำระ ${qty} งวด`,
    category: inst.type === 'phone' ? 'ผ่อนมือถือ' : 'ผ่อนสินเชื่อ',
    walletId
  });

  saveLocalStorage();
  closeInstPayModal();
  renderInstallment();
  renderList();
  updateSummary();
  showToast(`บันทึกจ่าย ${qty} งวดแล้ว`);
}

function renderInstallment() {
  const insts = window.installments || [];
  let phoneRem = 0, paynextRem = 0;
  insts.forEach(inst => { const rem = (inst.terms - inst.paidTerms) * inst.monthly; if (rem > 0) inst.type === 'phone' ? phoneRem += rem : paynextRem += rem; });
  document.getElementById('instPhoneTotal').innerText = phoneRem.toLocaleString() + ' ฿';
  document.getElementById('instPaynextTotal').innerText = paynextRem.toLocaleString() + ' ฿';
  const filtered = insts.filter(i => i.type === instTab);
  document.getElementById('instListHeader').innerText = instTab === 'phone' ? `ผ่อนมือถือ (${filtered.length})` : `PayNext (${filtered.length})`;
  const container = document.getElementById('instList');
  if (!filtered.length) { container.innerHTML = '<div class="empty">— ยังไม่มีรายการ —</div>'; return; }

  container.innerHTML = [...filtered].reverse().map(inst => {
    const paidTerms = inst.paidTerms, remTerms = inst.terms - paidTerms;
    const pct = Math.min((paidTerms / inst.terms) * 100, 100).toFixed(0);
    const done = remTerms <= 0;
    const payRows = inst.payments.length ? `<div class="pay-history">${inst.payments.map(p => `<div class="pay-row"><span>${escapeHtml(p.date)} · ${p.qty} งวด${p.note ? ' · ' + escapeHtml(p.note) : ''}</span><span class="pr-amount">+${p.amount.toLocaleString()} ฿</span></div>`).join('')}</div>` : '';
    return `<div class="inst-item ${inst.type}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div><div class="inst-name">${escapeHtml(inst.name)} ${done ? '<span class="inst-done-badge">✓ ผ่อนหมด</span>' : ''}</div><div class="inst-meta">${escapeHtml(inst.date)}${inst.note ? ' · ' + escapeHtml(inst.note) : ''}</div></div>
        <div class="inst-remain">${(remTerms * inst.monthly).toLocaleString()} ฿</div>
      </div>
      <div class="inst-progress"><div class="inst-fill" style="width:${pct}%"></div></div>
      <div class="inst-progress-text">จ่ายแล้ว ${paidTerms}/${inst.terms} งวด (${pct}%)</div>
      <div class="inst-detail">
        <div class="inst-stat"><div class="inst-stat-label">งวดละ</div><div class="inst-stat-val">${inst.monthly.toLocaleString()} ฿</div></div>
        <div class="inst-stat"><div class="inst-stat-label">เหลืองวด</div><div class="inst-stat-val">${remTerms}</div></div>
        <div class="inst-stat"><div class="inst-stat-label">ยอดรวม</div><div class="inst-stat-val">${inst.total.toLocaleString()} ฿</div></div>
      </div>
      ${payRows}
      <div class="inst-actions">${!done ? `<button class="btn-pay" onclick="openInstPayModal(${inst.id})">💳 จ่ายงวด</button>` : ''}<button class="btn-del-sm" onclick="deleteInstallment(${inst.id})">🗑</button></div>
    </div>`;
  }).join('');
}

// ── 14. CATEGORIES ──
let catTab = 'income';

function setCatTab(type, el) { catTab = type; document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active')); if (el) el.classList.add('active'); renderCatList(); }

function addCategory() {
  const name = document.getElementById('catNameInput').value.trim();
  if (!name) return showToast('กรุณากรอกชื่อหมวด');
  if (window.categories[catTab].includes(name)) return showToast('มีหมวดนี้แล้ว');
  window.categories[catTab].push(name);
  saveLocalStorage();
  document.getElementById('catNameInput').value = '';
  renderCatList();
  updateCategoryDropdown(document.getElementById('typeSelect').value, 'categorySelect');
}

// ✅ ใช้ Confirm Modal
async function deleteCategory(type, name) {
  if (DEFAULT_DATA.categories[type].includes(name)) return showToast('ไม่สามารถลบหมวดเริ่มต้น');
  if (!await showConfirmModal(`คุณแน่ใจว่าต้องการลบหมวด "${name}"?`)) return;
  window.categories[type] = window.categories[type].filter(c => c !== name);
  saveLocalStorage();
  renderCatList();
  updateCategoryDropdown(document.getElementById('typeSelect').value, 'categorySelect');
}

function resetCategories() {
  window.categories = {
    income: [...DEFAULT_DATA.categories.income],
    expense: [...DEFAULT_DATA.categories.expense]
  };
  saveLocalStorage();
  renderCatList();
  updateCategoryDropdown(document.getElementById('typeSelect').value, 'categorySelect');
  showToast('รีเซ็ตหมวดแล้ว');
}

function renderCatList() {
  const el = document.getElementById('catList');
  if (!el) return;
  const cats = window.categories[catTab] || [];
  if (!cats.length) { el.innerHTML = '<div class="empty">— ยังไม่มีหมวดหมู่ —</div>'; return; }
  el.innerHTML = cats.map(c => `
    <div class="cat-item">
      <span>${escapeHtml(c)}${DEFAULT_DATA.categories[catTab].includes(c) ? '<span class="ci-default">default</span>' : ''}</span>
      <button class="btn-cat-del" onclick="deleteCategory('${catTab}','${escapeHtml(c)}')">✕</button>
    </div>`).join('');
}

// ── 15. BUDGET & UPCOMING ──
// ✅ ใช้ Confirm Modal สำหรับการอัปเดต
async function addBudget() {
  const month = document.getElementById('budgetMonthSelect').value;
  if (!month) return showToast('เลือกเดือนก่อน');
  const category = document.getElementById('budgetCategorySelect').value;
  if (!category) return showToast('เลือกหมวดหมู่');
  const amount = parseFloat(document.getElementById('budgetAmountInput').value);
  if (isNaN(amount) || amount <= 0) return showToast('กรอกจำนวนเงิน');

  const exists = window.budgets.find(b => b.month === month && b.category === category);
  if (exists) {
    if (await showConfirmModal(`หมวด "${category}" ในเดือนนี้มีงบอยู่แล้ว (${exists.amount} ฿) ต้องการอัปเดตหรือไม่?`, false)) {
      exists.amount = amount;
    } else {
      return;
    }
  } else {
    window.budgets.push({ id: Date.now(), category, month, amount });
  }
  saveLocalStorage();
  document.getElementById('budgetAmountInput').value = '';
  renderBudgetPage();
  showToast('บันทึกงบประมาณแล้ว');
}

// ✅ ใช้ Confirm Modal
async function deleteBudget(id) {
  if (await showConfirmModal('คุณแน่ใจว่าต้องการลบงบประมาณนี้?')) {
    window.budgets = window.budgets.filter(b => b.id !== id);
    saveLocalStorage();
    renderBudgetPage();
    showToast('ลบงบประมาณแล้ว');
  }
}

function addUpcomingFromBudget() {
  const month = document.getElementById('budgetMonthSelect').value;
  const name = document.getElementById('upcomingName').value.trim();
  const amount = parseFloat(document.getElementById('upcomingAmount').value);
  const category = document.getElementById('upcomingCategorySelect').value;
  if (!month || !name || isNaN(amount) || amount <= 0) return showToast('กรอกข้อมูลให้ครบถ้วน');
  window.upcoming.push({ id: Date.now(), month, name, amount, category: category || 'อื่นๆ' });
  saveLocalStorage();
  document.getElementById('upcomingName').value = '';
  document.getElementById('upcomingAmount').value = '';
  renderBudgetPage();
  showToast('เพิ่มรายการคาดการณ์แล้ว');
}

// ✅ ใช้ Confirm Modal
async function deleteUpcoming(id) {
  if (await showConfirmModal('คุณแน่ใจว่าต้องการลบรายการคาดการณ์นี้?')) {
    window.upcoming = window.upcoming.filter(u => u.id !== id);
    saveLocalStorage();
    renderBudgetPage();
    showToast('ลบแล้ว');
  }
}

function renderBudgetPage() {
  const monthSelect = document.getElementById('budgetMonthSelect');
  if (!monthSelect) return;

  const months = [...new Set(window.items.map(i => i.date.slice(0, 7)))].sort().reverse();
  const thisMonth = today.slice(0, 7);
  if (!months.includes(thisMonth)) months.unshift(thisMonth);

  const previousSelection = monthSelect.value || thisMonth;
  monthSelect.innerHTML = months.map(m => {
    const [y, mo] = m.split('-');
    return `<option value="${m}" ${m === previousSelection ? 'selected' : ''}>${new Date(y, mo - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</option>`;
  }).join('');
  const selectedMonth = monthSelect.value;

  const catSelect = document.getElementById('budgetCategorySelect');
  if (catSelect) {
    catSelect.innerHTML = '<option value="">-- เลือกหมวดรายจ่าย --</option>' +
      (window.categories.expense || []).map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  }

  const upcomingCatSel = document.getElementById('upcomingCategorySelect');
  if (upcomingCatSel) {
    upcomingCatSel.innerHTML = '<option value="">-- หมวดหมู่ --</option>' +
      (window.categories.expense || []).map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  }

  const budgets = window.budgets.filter(b => b.month === selectedMonth);
  const expenses = window.items.filter(i => i.type === 'expense' && i.date.startsWith(selectedMonth));
  const expenseByCat = {};
  expenses.forEach(i => {
    const cat = i.category || 'อื่นๆ';
    expenseByCat[cat] = (expenseByCat[cat] || 0) + i.amount;
  });

  let totalBudget = 0, totalSpent = 0;
  budgets.forEach(b => { totalBudget += b.amount; });
  Object.values(expenseByCat).forEach(v => totalSpent += v);

  document.getElementById('budgetTotalAmount').innerText = totalBudget.toLocaleString();
  document.getElementById('budgetTotalSpent').innerText = totalSpent.toLocaleString();

  const listDiv = document.getElementById('budgetList');
  const listHeader = document.getElementById('budgetListHeader');
  if (listDiv && listHeader) {
    if (budgets.length === 0) {
      listHeader.innerText = 'ยังไม่มีงบประมาณ';
      listDiv.innerHTML = '<div class="empty">— ตั้งงบประมาณสำหรับเดือนนี้ —</div>';
    } else {
      listHeader.innerText = `งบประมาณ (${budgets.length} หมวด)`;
      listDiv.innerHTML = budgets.map(b => {
        const actual = expenseByCat[b.category] || 0;
        const remaining = b.amount - actual;
        const pct = Math.min((actual / b.amount) * 100, 100).toFixed(0);
        const over = remaining < 0;
        const statusColor = over ? 'var(--red)' : 'var(--green)';
        const statusText = over ? 'เกินงบ' : 'เหลือ';
        return `
          <div class="item expense" style="flex-direction:column;align-items:stretch;border-left-color:${over ? 'var(--red)' : 'var(--green)'}">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem">
              <span class="name">${escapeHtml(b.category)}</span>
              <button class="btn-del" onclick="deleteBudget(${b.id})" style="font-size:0.8rem">✕</button>
            </div>
            <div class="bar-row" style="margin-bottom:0.2rem">
              <div class="bar-label" style="width:auto;flex:1">ใช้ไป ${actual.toLocaleString()} / งบ ${b.amount.toLocaleString()}</div>
              <div class="bar-val" style="color:${statusColor};font-weight:bold">${statusText} ${Math.abs(remaining).toLocaleString()} ฿</div>
            </div>
            <div class="bar-track" style="height:8px">
              <div class="bar-fill expense" style="width:${pct}%;background:${over ? 'linear-gradient(90deg, #ff4f64, #ff8fa0)' : 'linear-gradient(90deg, #39d98a, #8ff0c0)'}"></div>
            </div>
          </div>`;
      }).join('');
    }
  }

  const upcomingForMonth = window.upcoming.filter(u => u.month === selectedMonth);
  const upcomingListDiv = document.getElementById('upcomingBudgetList');
  if (upcomingListDiv) {
    if (upcomingForMonth.length === 0) {
      upcomingListDiv.innerHTML = '<div class="empty">— ยังไม่มีรายการคาดการณ์ —</div>';
    } else {
      upcomingListDiv.innerHTML = upcomingForMonth.map(u => `
        <div class="item expense">
          <div class="item-left" style="flex:1">
            <div class="name">${escapeHtml(u.name)}</div>
            <div class="meta">${escapeHtml(u.month)} · ${escapeHtml(u.category || 'อื่นๆ')}</div>
          </div>
          <div class="item-right">
            <div class="amount">-${u.amount.toLocaleString()}</div>
            <button class="btn-del" onclick="deleteUpcoming(${u.id})">✕</button>
          </div>
        </div>`).join('');
    }
  }
}

// ── 16. DASHBOARD / SUMMARY ──
let chartBarType = 'expense';
let chartDonutType = 'expense';

function renderSummary() {
  const month = document.getElementById('sumMonthSelect').value || today.slice(0, 7);
  const items = window.items || [];
  const monthItems = items.filter(i => i.date.startsWith(month));
  let inc = 0, exp = 0;
  monthItems.forEach(i => { if (i.type === 'income') inc += i.amount; else exp += i.amount; });
  document.getElementById('sumIncome').innerText = inc.toLocaleString();
  document.getElementById('sumExpense').innerText = exp.toLocaleString();
  const bal = inc - exp;
  const balEl = document.getElementById('sumBalance');
  if (balEl) {
    balEl.innerText = (bal >= 0 ? '+' : '') + bal.toLocaleString() + ' บาท';
    balEl.style.color = bal >= 0 ? 'var(--green)' : 'var(--red)';
  }

  const loanBorrow = items.filter(i => i.type === 'income' && i.category === 'ยืม').reduce((s, i) => s + i.amount, 0);
  const loanRepay = items.filter(i => i.type === 'expense' && i.category === 'คืน').reduce((s, i) => s + i.amount, 0);
  const loanRemain = loanBorrow - loanRepay;
  const loanRemEl = document.getElementById('summaryLoanRemain');
  if (loanRemEl) loanRemEl.innerText = (loanRemain > 0 ? loanRemain.toLocaleString() : '0') + ' ฿';

  renderBar('expenseBar', monthItems, 'expense');
  renderBar('incomeBar', monthItems, 'income');
  drawBar(monthItems, chartBarType);
  drawDonut(monthItems, chartDonutType);

  const topExp = [...monthItems.filter(i => i.type === 'expense')].sort((a, b) => b.amount - a.amount).slice(0, 5);
  const topExpEl = document.getElementById('topExpense');
  if (topExpEl) {
    topExpEl.innerHTML = topExp.length ? topExp.map(i => `<div class="top-item"><div>${escapeHtml(i.name)} <span style="font-size:0.62rem;color:var(--muted)">${escapeHtml(i.category || '')}</span></div><div class="ti-amount">-${i.amount.toLocaleString()}</div></div>`).join('') : '<div class="empty">— ไม่มีรายจ่าย —</div>';
  }
}

function renderBar(elId, monthItems, type) {
  const filtered = monthItems.filter(i => i.type === type);
  const catMap = new Map();
  filtered.forEach(i => { const cat = i.category || 'อื่นๆ'; catMap.set(cat, (catMap.get(cat) || 0) + i.amount); });
  const sorted = [...catMap.entries()].sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((s, c) => s + c[1], 0);
  const el = document.getElementById(elId);
  if (!el) return;
  if (!sorted.length) { el.innerHTML = '<div class="empty">— ไม่มีข้อมูล —</div>'; return; }
  el.innerHTML = sorted.map(([cat, amt]) => `<div class="bar-row"><div class="bar-label">${escapeHtml(cat)}</div><div class="bar-track"><div class="bar-fill ${type}" style="width:${total ? (amt / total * 100).toFixed(1) : 0}%"></div></div><div class="bar-val">${amt.toLocaleString()}</div></div>`).join('');
}

function initMonthSelect() {
  const items = window.items || [];
  const months = [...new Set(items.map(i => i.date.slice(0, 7)))].sort().reverse();
  const thisMonth = today.slice(0, 7);
  if (!months.includes(thisMonth)) months.unshift(thisMonth);
  const sel = document.getElementById('sumMonthSelect');
  if (!sel) return;
  const curVal = sel.value;
  sel.innerHTML = months.map(m => { const [y, mo] = m.split('-'); return `<option value="${m}">${new Date(y, mo - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</option>`; }).join('');
  sel.value = curVal && months.includes(curVal) ? curVal : thisMonth;
}

// ── 17. CANVAS CHARTS ──
const COLORS_EXP = ['#ff4f64', '#ff8c5a', '#ffb347', '#ffd700', '#c8a84b', '#e07b9a', '#ff6b8a', '#ffaa44', '#e6861a', '#d4604a'];
const COLORS_INC = ['#39d98a', '#4f9bff', '#a78bfa', '#34d399', '#60a5fa', '#818cf8', '#2dd4bf', '#38bdf8', '#c084fc', '#86efac'];

function getCatData(monthItems, type) {
  const filtered = monthItems.filter(i => i.type === type);
  const catMap = new Map();
  filtered.forEach(i => { const c = i.category || 'อื่นๆ'; catMap.set(c, (catMap.get(c) || 0) + i.amount); });
  return [...catMap.entries()].sort((a, b) => b[1] - a[1]);
}

function setChartTab(type, el) {
  chartBarType = type;
  document.querySelectorAll('#page-summary .chart-wrap:first-of-type .chart-tab').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  const month = document.getElementById('sumMonthSelect').value || today.slice(0, 7);
  const items = window.items || [];
  const monthItems = items.filter(i => i.date.startsWith(month));
  drawBar(monthItems, type);
}

function setDonutTab(type, el) {
  chartDonutType = type;
  const wraps = document.querySelectorAll('#page-summary .chart-wrap');
  if (wraps[1]) wraps[1].querySelectorAll('.chart-tab').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  const month = document.getElementById('sumMonthSelect').value || today.slice(0, 7);
  const items = window.items || [];
  const monthItems = items.filter(i => i.date.startsWith(month));
  drawDonut(monthItems, type);
}

function drawBar(monthItems, type) {
  const canvas = document.getElementById('barCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const data = getCatData(monthItems, type);
  const colors = type === 'expense' ? COLORS_EXP : COLORS_INC;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.parentElement.clientWidth - 32;
  const H = 200;
  if (W <= 0) return;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);
  if (!data.length) {
    ctx.fillStyle = '#4a5568';
    ctx.font = '13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('— ไม่มีข้อมูล —', W / 2, H / 2);
    return;
  }
  const maxVal = Math.max(...data.map(d => d[1]));
  const padL = 70, padR = 10, padT = 10, padB = 30;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const barH = Math.min(28, (chartH / data.length) - 6);
  const gap = (chartH - barH * data.length) / (data.length + 1);
  data.forEach(([cat, amt], i) => {
    const y = padT + gap + i * (barH + gap);
    const barW = (amt / maxVal) * chartW;
    const color = colors[i % colors.length];
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.fillStyle = color;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(padL, y, barW, barH, 3);
    else ctx.rect(padL, y, barW, barH);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#cdd4e0';
    ctx.font = `11px 'Sarabun', sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const label = cat.length > 7 ? cat.slice(0, 7) + '…' : cat;
    ctx.fillText(label, padL - 4, y + barH / 2);
    ctx.fillStyle = color;
    ctx.font = `10px monospace`;
    ctx.textAlign = 'left';
    ctx.fillText(amt.toLocaleString(), padL + barW + 4, y + barH / 2);
  });
}

function drawDonut(monthItems, type) {
  const canvas = document.getElementById('donutCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const data = getCatData(monthItems, type);
  const colors = type === 'expense' ? COLORS_EXP : COLORS_INC;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.parentElement.clientWidth - 32;
  const H = 200;
  if (W <= 0) return;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);
  const legend = document.getElementById('donutLegend');
  if (!data.length) {
    ctx.fillStyle = '#4a5568';
    ctx.font = '13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('— ไม่มีข้อมูล —', W / 2, H / 2);
    if (legend) legend.innerHTML = '';
    return;
  }
  const total = data.reduce((s, d) => s + d[1], 0);
  const cx = W / 2, cy = H / 2;
  const radius = Math.min(cx, cy) - 16;
  const inner = radius * 0.55;
  let startAngle = -Math.PI / 2;
  data.forEach(([cat, amt], i) => {
    const slice = (amt / total) * 2 * Math.PI;
    const color = colors[i % colors.length];
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, startAngle + slice);
    ctx.arc(cx, cy, inner, startAngle + slice, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    startAngle += slice;
  });
  ctx.beginPath();
  ctx.arc(cx, cy, inner, 0, 2 * Math.PI);
  ctx.fillStyle = '#0f1320';
  ctx.fill();
  ctx.fillStyle = '#c8a84b';
  ctx.font = `bold 13px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(total.toLocaleString(), cx, cy - 7);
  ctx.fillStyle = '#4a5568';
  ctx.font = `10px monospace`;
  ctx.fillText('บาท', cx, cy + 9);

  if (legend) {
    legend.innerHTML = data.map(([cat, amt], i) => {
      const pct = ((amt / total) * 100).toFixed(1);
      return `<div class="legend-item"><div class="legend-dot" style="background:${colors[i % colors.length]}"></div><span>${escapeHtml(cat)} <span style="color:var(--muted)">${pct}%</span></span></div>`;
    }).join('');
  }
}

// ── 18. SEARCH PAGE ──
function searchItems() {
  const query = document.getElementById('searchInputPage')?.value.toLowerCase().trim() || '';
  const items = window.items || [];
  const filtered = items.filter(i => {
    const matchName = i.name.toLowerCase().includes(query);
    const matchNote = (i.note || '').toLowerCase().includes(query);
    const matchCat = (i.category || '').toLowerCase().includes(query);
    return matchName || matchNote || matchCat;
  });

  const container = document.getElementById('searchResults');
  const header = document.getElementById('searchListHeader');
  if (!container) return;

  if (!query) {
    if (header) header.innerText = 'ผลลัพธ์ (พิมพ์คำค้นเพื่อเริ่ม)';
    container.innerHTML = '<div class="empty">— พิมพ์คำค้นด้านบน —</div>';
    return;
  }

  if (header) header.innerText = `ผลลัพธ์ (${filtered.length} รายการ)`;

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty">— ไม่พบรายการ —</div>';
    return;
  }

  const wallets = window.wallets || [];
  container.innerHTML = [...filtered].reverse().map(i => `
    <div class="item ${i.type}">
      <div class="item-left" onclick="openEdit(${i.id})" style="cursor:pointer;flex:1">
        <div class="name">${escapeHtml(i.name)}${i.note ? `<span class="note-chip">${escapeHtml(i.note)}</span>` : ''}</div>
        <div class="meta">${escapeHtml(i.date)} · ${escapeHtml(i.category || '')} · ${escapeHtml(wallets.find(w => w.id === i.walletId)?.name || '')}</div>
      </div>
      <div class="item-right">
        <div class="amount">${i.type === 'income' ? '+' : '-'}${i.amount.toLocaleString()}</div>
        <button class="btn-del" onclick="deleteItem(${i.id})">✕</button>
      </div>
    </div>
  `).join('');
}

// ── 19. PAGE ROUTING ──
function showPage(id, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const pageEl = document.getElementById(id);
  if (pageEl) pageEl.classList.add('active');
  if (el) el.classList.add('active');

  if (id === 'page-summary') { initMonthSelect(); renderSummary(); }
  if (id === 'page-category') renderCatList();
  if (id === 'page-loan') renderLoan();
  if (id === 'page-install') renderInstallment();
  if (id === 'page-wallet') renderWalletPage();
  if (id === 'page-budget') renderBudgetPage();
  if (id === 'page-search') {
    const inp = document.getElementById('searchInputPage');
    if (inp) {
      setTimeout(() => inp.focus(), 100);
      if (inp.value.trim()) searchItems();
    }
  }
}

// ── 20. INITIALIZE APP ──
function initApp() {
  loadLocalStorage();
  displayCurrentDate();

  const initialType = document.getElementById('typeSelect')?.value || 'income';
  updateCategoryDropdown(initialType, 'categorySelect');
  updateCategoryDropdown('income', 'editCategory');

  updateWalletDropdowns();
  renderList();
  updateSummary();

  ['dateInput', 'instDate', 'instPayDate'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = today;
  });

  const monthLbl = document.getElementById('monthLabel');
  if (monthLbl) monthLbl.innerText = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Modal events (Edit)
  const modalBg = document.getElementById('modalBg');
  if (modalBg) {
    modalBg.addEventListener('click', e => {
      if (e.target === modalBg) closeModal();
    });
  }
  const instPayModalBg = document.getElementById('instPayModalBg');
  if (instPayModalBg) {
    instPayModalBg.addEventListener('click', e => {
      if (e.target === instPayModalBg) closeInstPayModal();
    });
  }

  // Confirm Modal events
  const confirmBg = document.getElementById('confirmModalBg');
  if (confirmBg) {
    confirmBg.addEventListener('click', e => {
      if (e.target === confirmBg) {
        confirmBg.classList.remove('open');
        if (confirmResolver) { confirmResolver(false); confirmResolver = null; }
      }
    });
  }
  document.getElementById('confirmYesBtn')?.addEventListener('click', () => {
    document.getElementById('confirmModalBg').classList.remove('open');
    if (confirmResolver) { confirmResolver(true); confirmResolver = null; }
  });
  document.getElementById('confirmNoBtn')?.addEventListener('click', () => {
    document.getElementById('confirmModalBg').classList.remove('open');
    if (confirmResolver) { confirmResolver(false); confirmResolver = null; }
  });

  document.getElementById('typeSelect')?.addEventListener('change', function() { updateCategoryDropdown(this.value, 'categorySelect'); });
  document.getElementById('editType')?.addEventListener('change', function() { updateCategoryDropdown(this.value, 'editCategory'); });

  // Search input auto-search (debounce)
  const searchInput = document.getElementById('searchInputPage');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      clearTimeout(window.searchDebouncePage);
      window.searchDebouncePage = setTimeout(searchItems, 300);
    });
    searchInput.addEventListener('focus', function() { this.select(); });
  }

  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const summaryPage = document.getElementById('page-summary');
      if (summaryPage && summaryPage.classList.contains('active')) {
        renderSummary();
      }
    }, 200);
  });

  console.log(' พร้อมใช้งาน (FULL FIXED + CUSTOM CONFIRM UI)');
}

initApp();