// ── 1. LOCALSTORAGE KEY NAME ──
const STORAGE_KEY = 'budgetCtrl_LocalData';

// ── 2. GLOBAL VARIABLES ──
window.items = [];
window.wallets = [];
window.installments = [];
window.categories = {};
window.budgets = [];
window.upcoming = [];

// ── 3. DEFAULT DATA ──
const DEFAULT_DATA = {
  items: [],
  wallets: [
    { id: 1, name: 'เงินสด', init: 0 },
    { id: 2, name: 'PromptPay', init: 0 }
  ],
  installments: [],
  categories: {
    income: ['เงินเดือน','ยืม','อื่นๆ'],
    expense: ['อาหาร','เดินทาง','ค่าเช่า','บันเทิง','ค่าน้ำไฟ','อินเทอร์เน็ต','ผ่อนมือถือ','ผ่อนสินเชื่อ','คืน','อื่นๆ']
  },
  budgets: [],
  upcoming: []
};

// ── 4. SAVE TO LOCALSTORAGE ──
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

// ── 5. LOAD FROM LOCALSTORAGE ──
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
      console.log('✅ โหลดข้อมูลจาก LocalStorage สำเร็จ');
    } catch (e) {
      console.error('❌ ดึงข้อมูลล้มเหลว โหลดค่า Default', e);
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
  // FIX: deep copy nested arrays ป้องกัน shared reference
  window.categories = {
    income: [...DEFAULT_DATA.categories.income],
    expense: [...DEFAULT_DATA.categories.expense]
  };
  window.budgets = [...DEFAULT_DATA.budgets];
  window.upcoming = [...DEFAULT_DATA.upcoming];
  saveLocalStorage();
  console.log('📦 สร้างข้อมูลเริ่มต้นสำเร็จ');
}

// ── 6. HELPERS ──
// FIX: เพิ่ม " และ ' ใน escapeHtml ป้องกัน XSS ใน attribute
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}

function showToast(msg){ const t=document.getElementById('toast'); t.innerText=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2000); }

const today = new Date().toISOString().split('T')[0];
document.getElementById('dateInput').value = today;
document.getElementById('instDate').value = today;
document.getElementById('instPayDate').value = today;
document.getElementById('monthLabel').innerText = new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'});

function updateCategoryDropdown(type, selectId, cur='') {
  const sel = document.getElementById(selectId);
  if(sel) sel.innerHTML = (window.categories[type] || []).map(c=>`<option value="${escapeHtml(c)}" ${c===cur?'selected':''}>${escapeHtml(c)}</option>`).join('');
}

document.getElementById('typeSelect').addEventListener('change', function(){ updateCategoryDropdown(this.value,'categorySelect'); });
document.getElementById('editType').addEventListener('change', function(){ updateCategoryDropdown(this.value,'editCategory'); });

function getWalletBalance(walletId) {
  const items = window.items || [];
  const inc = items.filter(i => i.type === 'income' && i.walletId === walletId).reduce((s,i) => s+i.amount, 0);
  const exp = items.filter(i => i.type === 'expense' && i.walletId === walletId).reduce((s,i) => s+i.amount, 0);
  const w = window.wallets.find(w => w.id === walletId);
  const init = w ? (w.init || 0) : 0;
  return init + inc - exp;
}

function updateWalletDropdowns() {
  const wallets = window.wallets || [];
  const opts = wallets.map(w => `<option value="${w.id}">${escapeHtml(w.name)}</option>`).join('');
  ['walletSelect','transferFrom','transferTo','instPayWallet'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
  const tTo = document.getElementById('transferTo');
  if (tTo && wallets.length > 1) tTo.value = wallets[1].id;
}

// FIX: เพิ่ม populate editWallet dropdown
function updateEditWalletDropdown(currentWalletId) {
  const wallets = window.wallets || [];
  const sel = document.getElementById('editWallet');
  if (!sel) return;
  sel.innerHTML = wallets.map(w =>
    `<option value="${w.id}" ${w.id === currentWalletId ? 'selected' : ''}>${escapeHtml(w.name)}</option>`
  ).join('');
}

function renderWalletFilterBar() {
  const bar = document.getElementById('walletFilterBar');
  if (!bar) return;
  const wallets = window.wallets || [];
  const allActive = window.walletFilter === 'all' || window.walletFilter === undefined;
  let html = `<button class="wallet-chip ${allActive ? 'active' : ''}" onclick="setWalletFilter('all',this)">ทั้งหมด</button>`;
  wallets.forEach(w => {
    const active = window.walletFilter === w.id;
    html += `<button class="wallet-chip ${active ? 'active' : ''}" onclick="setWalletFilter(${w.id},this)">${escapeHtml(w.name)}</button>`;
  });
  bar.innerHTML = html;
}

window.walletFilter = 'all';

function setWalletFilter(id, el) {
  window.walletFilter = id === 'all' ? 'all' : parseInt(id);
  document.querySelectorAll('.wallet-chip').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderList();
}

// ── 7. NOTE TOGGLE ──
function toggleNoteInput() {
  const input = document.getElementById('noteInput');
  const btn = document.getElementById('noteToggleBtn');
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

// ── 8. ADD / DEL / EDIT ──
function addItem(){
  const name = document.getElementById('nameInput').value.trim();
  const amount = parseFloat(document.getElementById('amountInput').value);
  const type = document.getElementById('typeSelect').value;
  const date = document.getElementById('dateInput').value || today;
  const note = document.getElementById('noteInput').value.trim();
  const category = document.getElementById('categorySelect').value;
  const walletId = parseInt(document.getElementById('walletSelect').value) || (window.wallets[0]?.id || 1);
  if(!name||isNaN(amount)||amount<=0) return showToast('กรุณากรอกข้อมูลให้ครบ');
  window.items.push({id:Date.now(),name,amount,type,date,note,category,walletId});
  saveLocalStorage();
  document.getElementById('nameInput').value='';
  document.getElementById('amountInput').value='';
  const noteInp = document.getElementById('noteInput');
  noteInp.value=''; noteInp.style.display='none';
  document.getElementById('noteToggleBtn').textContent = 'หมายเหตุ';
  renderList();
}

function deleteItem(id){
  window.items = window.items.filter(i=>i.id!==id);
  saveLocalStorage();
  renderList();
  showToast('ลบแล้ว');
}

function clearAll(){
  if(window.items.length && confirm('ล้างข้อมูลทั้งหมด?')){
    window.items = [];
    saveLocalStorage();
    renderList();
    showToast('ล้างข้อมูลแล้ว');
  }
}

let filter = 'all';
function setFilter(val,el){
  filter = val;
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  renderList();
}

function openEdit(id){
  const item = window.items.find(i=>i.id===id);
  if(!item) return;
  document.getElementById('editId').value = id;
  document.getElementById('editDate').value = item.date;
  document.getElementById('editName').value = item.name;
  document.getElementById('editNote').value = item.note||'';
  document.getElementById('editAmount').value = item.amount;
  document.getElementById('editType').value = item.type;
  updateCategoryDropdown(item.type,'editCategory',item.category);
  // FIX: populate editWallet dropdown พร้อม select wallet ปัจจุบัน
  updateEditWalletDropdown(item.walletId);
  document.getElementById('modalBg').classList.add('open');
}

function closeModal(){ document.getElementById('modalBg').classList.remove('open'); }

function saveEdit(){
  const id = parseInt(document.getElementById('editId').value);
  const idx = window.items.findIndex(i=>i.id===id);
  if(idx===-1) return;
  const amount = parseFloat(document.getElementById('editAmount').value);
  const name = document.getElementById('editName').value.trim();
  if(!name||isNaN(amount)||amount<=0) return showToast('ข้อมูลไม่ถูกต้อง');
  // FIX: อ่านค่า walletId จาก modal ด้วย
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
  showToast('บันทึกแล้ว');
}

function downloadCSV(){
  if(!window.items.length) return showToast('ไม่มีข้อมูล');
  let csv='วันที่,รายการ,หมายเหตุ,หมวดหมู่,ประเภท,จำนวน\n';
  window.items.forEach(i=>{ csv+=`${i.date},"${i.name}","${i.note||''}","${i.category||''}",${i.type==='income'?'รายรับ':'รายจ่าย'},${i.amount}\n`; });
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv'}));
  a.download=`budget_${today}.csv`;
  a.click();
}

let searchDebounce;
document.getElementById('searchInput').addEventListener('input', function(){
  clearTimeout(searchDebounce);
  searchDebounce=setTimeout(()=>renderList(),300);
});

function renderList(){
  const search = document.getElementById('searchInput').value.toLowerCase();
  const items = window.items || [];
  let filtered = items.filter(i=>{
    const matchSearch = i.name.toLowerCase().includes(search) || (i.note||'').toLowerCase().includes(search) || (i.category||'').toLowerCase().includes(search);
    const matchFilter = filter==='all' || i.type===filter;
    const matchWallet = window.walletFilter==='all' || i.walletId===window.walletFilter;
    return matchSearch && matchFilter && matchWallet;
  });

  let inc=0, exp=0;
  items.forEach(i=>{ if(i.type==='income') inc+=i.amount; else exp+=i.amount; });
  document.getElementById('totalIncome').innerText=inc.toLocaleString();
  document.getElementById('totalExpense').innerText=exp.toLocaleString();
  document.getElementById('balance').innerText=(inc-exp).toLocaleString();
  document.getElementById('listHeader').innerText=`รายการทั้งหมด (${filtered.length})`;
  const c=document.getElementById('list');
  if(!filtered.length){ c.innerHTML='<div class="empty">— ไม่พบรายการ —</div>'; return; }
  const wallets = window.wallets || [];
  // FIX: escapeHtml note ก่อนใส่ใน innerHTML
  c.innerHTML=[...filtered].reverse().map(i=>`
    <div class="item ${i.type}">
      <div class="item-left" onclick="openEdit(${i.id})" style="cursor:pointer;flex:1">
        <div class="name">${escapeHtml(i.name)}${i.note?`<span class="note-chip">${escapeHtml(i.note)}</span>`:''}</div>
        <div class="meta">${escapeHtml(i.date)} · ${escapeHtml(i.category||'')} · ${escapeHtml(wallets.find(w=>w.id===i.walletId)?.name||'')}</div>
      </div>
      <div class="item-right">
        <div class="amount">${i.type==='income'?'+':'-'}${i.amount.toLocaleString()}</div>
        <button class="btn-del" onclick="deleteItem(${i.id})">✕</button>
      </div>
    </div>`).join('');
}

// ── 9. WALLET PAGE ──
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
  renderWalletFilterBar();
  showToast('เพิ่มบัญชีแล้ว');
}

function displayCurrentDate() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const formattedDate = `${day}/${month}/${year}`;
 
  document.getElementById('currentDate').textContent = ` [${formattedDate}]`;
    
}

function deleteWallet(id) {
  if (window.wallets.length <= 1) return showToast('ต้องมีบัญชีอย่างน้อย 1 บัญชี');
  const used = window.items.some(i => i.walletId === id);
  if (used && !confirm('บัญชีนี้มีรายการอยู่ ยืนยันลบ?')) return;
  window.wallets = window.wallets.filter(w => w.id !== id);
  saveLocalStorage();
  renderWalletPage();
  updateWalletDropdowns();
  renderWalletFilterBar();
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
  window.items.push({ id: ts, name: `โอน → ${toName}`, amount, type: 'expense', date: today, note: note || 'โอนเงิน', category: 'โอน', walletId: fromId, transferId: ts });
  window.items.push({ id: ts+1, name: `รับโอน ← ${fromName}`, amount, type: 'income', date: today, note: note || 'โอนเงิน', category: 'โอน', walletId: toId, transferId: ts });
  saveLocalStorage();
  document.getElementById('transferAmount').value = '';
  document.getElementById('transferNote').value = '';
  renderWalletPage();
  renderList();
  showToast(`โอน ${amount.toLocaleString()} ฿ สำเร็จ`);
}

function renderWalletPage() {
  const wallets = window.wallets || [];
  const grid = document.getElementById('walletSummary');
  if (grid) {
    grid.innerHTML = wallets.map(w => {
      const bal = getWalletBalance(w.id);
      return `<div class="wsc-card"><div class="wsc-name">${escapeHtml(w.name)}</div><div class="wsc-bal" style="color:${bal>=0?'var(--gold)':'var(--red)'}">${bal.toLocaleString()} ฿</div></div>`;
    }).join('');
  }
  const list = document.getElementById('walletList');
  if (list) {
    if (!wallets.length) { list.innerHTML = '<div class="empty">— ไม่มีบัญชี —</div>'; return; }
    list.innerHTML = wallets.map(w => {
      const bal = getWalletBalance(w.id);
      const txCount = window.items.filter(i => i.walletId === w.id).length;
      return `<div class="wallet-card">
        <div><div class="wc-name">👛 ${escapeHtml(w.name)}</div><div class="wc-meta">${txCount} รายการ · ยอดเริ่ม ${(w.init||0).toLocaleString()} ฿</div></div>
        <div style="display:flex;align-items:center;gap:0.7rem">
          <div class="wc-bal" style="color:${bal>=0?'var(--gold)':'var(--red)'}">${bal.toLocaleString()} ฿</div>
          ${wallets.length > 1 ? `<button class="btn-wallet-del" onclick="deleteWallet(${w.id})">✕</button>` : ''}
        </div>
      </div>`;
    }).join('');
  }
  updateWalletDropdowns();
}

// ── 10. LOAN TRACKER ──
let loanDisplayMode = 'person';
function setLoanTab(mode,el){ loanDisplayMode=mode; document.querySelectorAll('.loan-tab').forEach(b=>b.classList.remove('active')); el.classList.add('active'); renderLoan(); }

function renderLoan(){
  const items = window.items || [];
  const borrows = items.filter(i=>i.type==='income'&&i.category==='ยืม');
  const repays = items.filter(i=>i.type==='expense'&&i.category==='คืน');
  const totalBorrow = borrows.reduce((s,i)=>s+i.amount,0);
  const totalRepaid = repays.reduce((s,i)=>s+i.amount,0);
  const remain = Math.max(totalBorrow-totalRepaid,0);
  document.getElementById('loanTotalBorrow').innerText = totalBorrow.toLocaleString()+' ฿';
  document.getElementById('loanTotalRepaid').innerText = totalRepaid.toLocaleString()+' ฿';
  const remEl = document.getElementById('loanTotalRemain');
  remEl.innerText = remain.toLocaleString()+' ฿';
  remEl.style.color = remain>0?'var(--red)':'var(--green)';

  if(loanDisplayMode==='list'){
    document.getElementById('loanListHeader').innerText = `รายการทั้งหมด (${borrows.length+repays.length})`;
    const all = [...borrows.map(i=>({...i,ltype:'borrow'})), ...repays.map(i=>({...i,ltype:'repay'}))].sort((a,b)=>b.date.localeCompare(a.date));
    // FIX: escapeHtml i.note ใน loan list mode
    document.getElementById('loanList').innerHTML = all.length ? all.map(i=>`
      <div class="item ${i.ltype==='borrow'?'income':'expense'}">
        <div class="item-left" style="flex:1">
          <div class="name">${escapeHtml(i.name)}<span style="font-size:0.62rem;color:var(--muted)"> ${i.ltype==='borrow'?'(ยืม)':'(คืน)'}</span></div>
          <div class="meta">${escapeHtml(i.date)}${i.note?' · '+escapeHtml(i.note):''}</div>
        </div>
        <div class="item-right">
          <div class="amount" style="color:${i.ltype==='borrow'?'var(--red)':'var(--green)'}">${i.ltype==='borrow'?'+':'-'}${i.amount.toLocaleString()}</div>
        </div>
      </div>`).join('') : '<div class="empty">— ไม่มีรายการ —</div>';
  } else {
    document.getElementById('loanListHeader').innerText = 'สรุปรายคน';
    const persons = new Map();
    borrows.forEach(i=>{ let p=persons.get(i.name)||{borrow:0,repay:0,txns:[]}; p.borrow+=i.amount; p.txns.push({...i,ltype:'borrow'}); persons.set(i.name,p); });
    repays.forEach(i=>{ let p=persons.get(i.name)||{borrow:0,repay:0,txns:[]}; p.repay+=i.amount; p.txns.push({...i,ltype:'repay'}); persons.set(i.name,p); });
    const sorted = [...persons.entries()].sort((a,b)=>(b[1].borrow-b[1].repay)-(a[1].borrow-a[1].repay));
    if(!sorted.length){ document.getElementById('loanList').innerHTML='<div class="empty">— ไม่มีข้อมูล —</div>'; return; }
    document.getElementById('loanList').innerHTML = sorted.map(([name,data])=>{
      const rem = Math.max(data.borrow-data.repay,0);
      const pct = data.borrow>0?Math.min((data.repay/data.borrow)*100,100).toFixed(0):100;
      const cleared = rem<=0;
      // FIX: escapeHtml note ใน txn rows
      const rows = [...data.txns].sort((a,b)=>b.date.localeCompare(a.date)).map(t=>`
        <div class="person-txn-row">
          <span>${t.ltype==='borrow'?'📥 ยืม':'📤 คืน'}</span>
          <span>${escapeHtml(t.date)}</span>
          <span style="color:${t.ltype==='borrow'?'var(--red)':'var(--green)'}">${t.ltype==='borrow'?'+':'-'}${t.amount.toLocaleString()} ฿</span>
        </div>`).join('');
      return `<div class="person-card ${cleared?'cleared':''}">
        <div class="person-top"><span class="person-name">${escapeHtml(name)} ${cleared?'<span class="loan-done-badge">✓ เคลียร์</span>':''}</span><span class="person-remain">${rem.toLocaleString()} ฿</span></div>
        <div class="person-prog"><div class="person-prog-fill" style="width:${pct}%"></div></div>
        <div class="person-prog-text">คืนแล้ว ${data.repay.toLocaleString()} / ${data.borrow.toLocaleString()} ฿ (${pct}%)</div>
        <div class="person-txns">${rows}</div>
      </div>`;
    }).join('');
  }
}

// ── 11. INSTALLMENT ──
let instTab = 'phone';
function setInstTab(type,el){ instTab=type; document.querySelectorAll('.inst-tab').forEach(b=>b.classList.remove('active')); el.classList.add('active'); renderInstallment(); }

function addInstallment(){
  const name = document.getElementById('instName').value.trim();
  const total = parseFloat(document.getElementById('instTotal').value);
  const monthly = parseFloat(document.getElementById('instMonthly').value);
  const terms = parseInt(document.getElementById('instTerms').value);
  const paid = parseInt(document.getElementById('instPaid').value)||0;
  const date = document.getElementById('instDate').value||today;
  const note = document.getElementById('instNote').value.trim();
  if(!name||isNaN(total)||isNaN(monthly)||isNaN(terms)||terms<1) return showToast('กรอกข้อมูลให้ครบ');
  if(paid>terms) return showToast('งวดที่จ่ายเกินจำนวนงวด');
  window.installments.push({id:Date.now(),name,total,monthly,terms,type:instTab,date,note,paidTerms:paid,payments:[]});
  saveLocalStorage();
  ['instName','instTotal','instMonthly','instTerms','instNote'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('instPaid').value='0';
  renderInstallment();
  showToast('เพิ่มรายการแล้ว');
}

function deleteInstallment(id){
  window.installments = window.installments.filter(i=>i.id!==id);
  saveLocalStorage();
  renderInstallment();
  showToast('ลบแล้ว');
}

function openInstPayModal(id){
  const inst = window.installments.find(i=>i.id===id);
  if(!inst) return;
  const remTerms = inst.terms - inst.paidTerms;
  document.getElementById('instPayId').value = id;
  document.getElementById('instPayQty').value = 1;
  document.getElementById('instPayQty').max = remTerms;
  document.getElementById('instPayDate').value = today;
  document.getElementById('instPayNote').value = '';
  document.getElementById('instPayTitle').innerText = `💳 จ่ายงวด ${inst.name} (เหลือ ${remTerms} งวด × ${inst.monthly.toLocaleString()} ฿)`;
  // FIX: populate wallet dropdown ใน modal ผ่อนชำระ
  updateWalletDropdowns();
  document.getElementById('instPayModalBg').classList.add('open');
}

function closeInstPayModal(){ document.getElementById('instPayModalBg').classList.remove('open'); }

function saveInstPay(){
  const id = parseInt(document.getElementById('instPayId').value);
  const qty = parseInt(document.getElementById('instPayQty').value);
  const date = document.getElementById('instPayDate').value||today;
  const note = document.getElementById('instPayNote').value.trim();
  // FIX: อ่าน walletId จาก modal แทนการ hardcode wallets[0]
  const walletId = parseInt(document.getElementById('instPayWallet').value) || (window.wallets[0]?.id || 1);
  if(isNaN(qty)||qty<1) return showToast('กรุณากรอกจำนวนงวด');
  const inst = window.installments.find(i=>i.id===id);
  if(!inst) return;
  const remTerms = inst.terms - inst.paidTerms;
  if(qty>remTerms) return showToast(`จ่ายได้สูงสุด ${remTerms} งวด`);

  inst.paidTerms += qty;

  // FIX: ใช้ timestamp เดียวกัน หลีกเลี่ยง ID collision
  const now = Date.now();
  inst.payments.push({ id: now, qty, amount: qty * inst.monthly, date, note });

  window.items.push({
    id: now + 1,
    name: `ผ่อนชำระ: ${inst.name} (งวดที่ ${inst.paidTerms})`,
    amount: qty * inst.monthly,
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
  showToast(`บันทึกจ่าย ${qty} งวดแล้ว`);
}

function renderInstallment(){
  const insts = window.installments || [];
  let phoneRem=0, paynextRem=0;
  insts.forEach(inst=>{ const rem=(inst.terms-inst.paidTerms)*inst.monthly; if(rem>0) inst.type==='phone'?phoneRem+=rem:paynextRem+=rem; });
  document.getElementById('instPhoneTotal').innerText = phoneRem.toLocaleString()+' ฿';
  document.getElementById('instPaynextTotal').innerText = paynextRem.toLocaleString()+' ฿';
  const filtered = insts.filter(i=>i.type===instTab);
  document.getElementById('instListHeader').innerText = instTab==='phone'?`ผ่อนมือถือ (${filtered.length})`:`PayNext (${filtered.length})`;
  const container = document.getElementById('instList');
  if(!filtered.length){ container.innerHTML='<div class="empty">— ยังไม่มีรายการ —</div>'; return; }
  // FIX: escapeHtml note ใน installment render
  container.innerHTML = [...filtered].reverse().map(inst=>{
    const paidTerms = inst.paidTerms, remTerms = inst.terms-paidTerms;
    const pct = Math.min((paidTerms/inst.terms)*100,100).toFixed(0);
    const done = remTerms<=0;
    const payRows = inst.payments.length ? `<div class="pay-history">${inst.payments.map(p=>`<div class="pay-row"><span>${escapeHtml(p.date)} · ${p.qty} งวด${p.note?' · '+escapeHtml(p.note):''}</span><span class="pr-amount">+${p.amount.toLocaleString()} ฿</span></div>`).join('')}</div>` : '';
    return `<div class="inst-item ${inst.type}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div><div class="inst-name">${escapeHtml(inst.name)} ${done?'<span class="inst-done-badge">✓ ผ่อนหมด</span>':''}</div><div class="inst-meta">${escapeHtml(inst.date)}${inst.note?' · '+escapeHtml(inst.note):''}</div></div>
        <div class="inst-remain">${(remTerms*inst.monthly).toLocaleString()} ฿</div>
      </div>
      <div class="inst-progress"><div class="inst-fill" style="width:${pct}%"></div></div>
      <div class="inst-progress-text">จ่ายแล้ว ${paidTerms}/${inst.terms} งวด (${pct}%)</div>
      <div class="inst-detail">
        <div class="inst-stat"><div class="inst-stat-label">งวดละ</div><div class="inst-stat-val">${inst.monthly.toLocaleString()} ฿</div></div>
        <div class="inst-stat"><div class="inst-stat-label">เหลืองวด</div><div class="inst-stat-val">${remTerms}</div></div>
        <div class="inst-stat"><div class="inst-stat-label">ยอดรวม</div><div class="inst-stat-val">${inst.total.toLocaleString()} ฿</div></div>
      </div>
      ${payRows}
      <div class="inst-actions">${!done?`<button class="btn-pay" onclick="openInstPayModal(${inst.id})">💳 จ่ายงวด</button>`:''}<button class="btn-del-sm" onclick="deleteInstallment(${inst.id})">🗑</button></div>
    </div>`;
  }).join('');
}

// ── 12. CATEGORIES ──
let catTab = 'income';
function setCatTab(type,el){ catTab=type; document.querySelectorAll('.cat-tab').forEach(b=>b.classList.remove('active')); el.classList.add('active'); renderCatList(); }

function addCategory(){
  const name = document.getElementById('catNameInput').value.trim();
  if(!name) return showToast('กรุณากรอกชื่อหมวด');
  if(window.categories[catTab].includes(name)) return showToast('มีหมวดนี้แล้ว');
  window.categories[catTab].push(name);
  saveLocalStorage();
  document.getElementById('catNameInput').value='';
  renderCatList();
  updateCategoryDropdown(document.getElementById('typeSelect').value,'categorySelect');
}

function deleteCategory(type,name){
  // FIX: ใช้ DEFAULT_DATA แทน hardcode ซ้ำ
  if(DEFAULT_DATA.categories[type].includes(name)) return showToast('ไม่สามารถลบหมวดเริ่มต้น');
  window.categories[type] = window.categories[type].filter(c=>c!==name);
  saveLocalStorage();
  renderCatList();
  updateCategoryDropdown(document.getElementById('typeSelect').value,'categorySelect');
}

function resetCategories(){
  // FIX: ใช้ DEFAULT_DATA แทน hardcode ซ้ำ
  window.categories = {
    income: [...DEFAULT_DATA.categories.income],
    expense: [...DEFAULT_DATA.categories.expense]
  };
  saveLocalStorage();
  renderCatList();
  updateCategoryDropdown('income','categorySelect');
  showToast('รีเซ็ตหมวดแล้ว');
}

function renderCatList(){
  const el = document.getElementById('catList');
  const cats = window.categories[catTab] || [];
  // FIX: ใช้ DEFAULT_DATA แทน hardcode ซ้ำ
  if(!cats.length){ el.innerHTML='<div class="empty">— ยังไม่มีหมวดหมู่ —</div>'; return; }
  el.innerHTML = cats.map(c=>`
    <div class="cat-item">
      <span>${escapeHtml(c)}${DEFAULT_DATA.categories[catTab].includes(c)?'<span class="ci-default">default</span>':''}</span>
      <button class="btn-cat-del" onclick="deleteCategory('${catTab}','${escapeHtml(c)}')">✕</button>
    </div>`).join('');
}

// ── 13. BUDGET & UPCOMING MANAGEMENT ──
function addBudget() {
  const month = document.getElementById('budgetMonthSelect').value;
  if (!month) return showToast('เลือกเดือนก่อน');
  const category = document.getElementById('budgetCategorySelect').value;
  if (!category) return showToast('เลือกหมวดหมู่');
  const amount = parseFloat(document.getElementById('budgetAmountInput').value);
  if (isNaN(amount) || amount <= 0) return showToast('กรอกจำนวนเงิน');

  const exists = window.budgets.find(b => b.month === month && b.category === category);
  if (exists) {
    if (!confirm(`หมวด "${category}" ในเดือนนี้มีงบอยู่แล้ว (${exists.amount} ฿) ต้องการอัปเดตหรือไม่?`)) return;
    exists.amount = amount;
  } else {
    window.budgets.push({ id: Date.now(), category, month, amount });
  }
  saveLocalStorage();
  document.getElementById('budgetAmountInput').value = '';
  renderBudgetPage();
  showToast('บันทึกงบประมาณแล้ว');
}

function deleteBudget(id) {
  window.budgets = window.budgets.filter(b => b.id !== id);
  saveLocalStorage();
  renderBudgetPage();
  showToast('ลบงบประมาณแล้ว');
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

function deleteUpcoming(id) {
  window.upcoming = window.upcoming.filter(u => u.id !== id);
  saveLocalStorage();
  renderBudgetPage();
  showToast('ลบแล้ว');
}

function renderBudgetPage() {
  const monthSelect = document.getElementById('budgetMonthSelect');
  if (!monthSelect) return;

  const months = [...new Set(window.items.map(i => i.date.slice(0,7)))].sort().reverse();
  const thisMonth = new Date().toISOString().slice(0,7);
  if (!months.includes(thisMonth)) months.unshift(thisMonth);
  monthSelect.innerHTML = months.map(m => {
    const [y,mo] = m.split('-');
    return `<option value="${m}" ${m === thisMonth ? 'selected' : ''}>${new Date(y,mo-1).toLocaleDateString('en-US',{month:'long',year:'numeric'})}</option>`;
  }).join('');
  const selectedMonth = monthSelect.value;

  const catSelect = document.getElementById('budgetCategorySelect');
  catSelect.innerHTML = '<option value="">-- เลือกหมวดรายจ่าย --</option>' +
    (window.categories.expense || []).map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

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
        <div class="item expense" style="flex-direction:column;align-items:stretch;border-left-color:${over?'var(--red)':'var(--green)'}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem">
            <span class="name">${escapeHtml(b.category)}</span>
            <button class="btn-del" onclick="deleteBudget(${b.id})" style="font-size:0.8rem">✕</button>
          </div>
          <div class="bar-row" style="margin-bottom:0.2rem">
            <div class="bar-label" style="width:auto;flex:1">ใช้ไป ${actual.toLocaleString()} / งบ ${b.amount.toLocaleString()}</div>
            <div class="bar-val" style="color:${statusColor};font-weight:bold">${statusText} ${Math.abs(remaining).toLocaleString()} ฿</div>
          </div>
          <div class="bar-track" style="height:8px">
            <div class="bar-fill expense" style="width:${pct}%;background:${over?'linear-gradient(90deg, #ff4f64, #ff8fa0)':'linear-gradient(90deg, #39d98a, #8ff0c0)'}"></div>
          </div>
        </div>`;
    }).join('');
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

// ── 14. DASHBOARD / SUMMARY ──
let chartBarType = 'expense';
let chartDonutType = 'expense';

function renderSummary(){
  const month = document.getElementById('sumMonthSelect').value || today.slice(0,7);
  const items = window.items || [];
  const monthItems = items.filter(i=>i.date.startsWith(month));
  let inc=0, exp=0;
  monthItems.forEach(i=>{ if(i.type==='income') inc+=i.amount; else exp+=i.amount; });
  document.getElementById('sumIncome').innerText = inc.toLocaleString();
  document.getElementById('sumExpense').innerText = exp.toLocaleString();
  const bal = inc-exp;
  const balEl = document.getElementById('sumBalance');
  balEl.innerText = (bal>=0?'+':'')+bal.toLocaleString()+' บาท';
  balEl.style.color = bal>=0?'var(--green)':'var(--red)';

  const loanBorrow = items.filter(i=>i.type==='income'&&i.category==='ยืม').reduce((s,i)=>s+i.amount,0);
  const loanRepay = items.filter(i=>i.type==='expense'&&i.category==='คืน').reduce((s,i)=>s+i.amount,0);
  const loanRemain = loanBorrow-loanRepay;
  document.getElementById('summaryLoanRemain').innerText = (loanRemain>0?loanRemain.toLocaleString():'0')+' ฿';

  renderBar('expenseBar',monthItems,'expense');
  renderBar('incomeBar',monthItems,'income');
  drawBar(monthItems, chartBarType);
  drawDonut(monthItems, chartDonutType);

  const topExp = [...monthItems.filter(i=>i.type==='expense')].sort((a,b)=>b.amount-a.amount).slice(0,5);
  document.getElementById('topExpense').innerHTML = topExp.length ? topExp.map(i=>`<div class="top-item"><div>${escapeHtml(i.name)} <span style="font-size:0.62rem;color:var(--muted)">${escapeHtml(i.category||'')}</span></div><div class="ti-amount">-${i.amount.toLocaleString()}</div></div>`).join('') : '<div class="empty">— ไม่มีรายจ่าย —</div>';
}

function renderBar(elId, monthItems, type){
  const filtered = monthItems.filter(i=>i.type===type);
  const catMap = new Map();
  filtered.forEach(i=>{ const cat=i.category||'อื่นๆ'; catMap.set(cat,(catMap.get(cat)||0)+i.amount); });
  const sorted = [...catMap.entries()].sort((a,b)=>b[1]-a[1]);
  const total = sorted.reduce((s,c)=>s+c[1],0);
  const el = document.getElementById(elId);
  if(!sorted.length){ el.innerHTML='<div class="empty">— ไม่มีข้อมูล —</div>'; return; }
  el.innerHTML = sorted.map(([cat,amt])=>`<div class="bar-row"><div class="bar-label">${escapeHtml(cat)}</div><div class="bar-track"><div class="bar-fill ${type}" style="width:${total?(amt/total*100).toFixed(1):0}%"></div></div><div class="bar-val">${amt.toLocaleString()}</div></div>`).join('');
}

function initMonthSelect(){
  const items = window.items || [];
  const months = [...new Set(items.map(i=>i.date.slice(0,7)))].sort().reverse();
  const thisMonth = today.slice(0,7);
  if(!months.includes(thisMonth)) months.unshift(thisMonth);
  const sel = document.getElementById('sumMonthSelect');
  sel.innerHTML = months.map(m=>{ const [y,mo]=m.split('-'); return `<option value="${m}">${new Date(y,mo-1).toLocaleDateString('en-US',{month:'long',year:'numeric'})}</option>`; }).join('');
  if(months.length) sel.value = thisMonth;
}

// ── 15. CANVAS CHARTS ──
const COLORS_EXP = ['#ff4f64','#ff8c5a','#ffb347','#ffd700','#c8a84b','#e07b9a','#ff6b8a','#ffaa44','#e6861a','#d4604a'];
const COLORS_INC = ['#39d98a','#4f9bff','#a78bfa','#34d399','#60a5fa','#818cf8','#2dd4bf','#38bdf8','#c084fc','#86efac'];

function getCatData(monthItems, type){
  const filtered = monthItems.filter(i=>i.type === type);
  const catMap = new Map();
  filtered.forEach(i=>{ const c=i.category||'อื่นๆ'; catMap.set(c,(catMap.get(c)||0)+i.amount); });
  return [...catMap.entries()].sort((a,b)=>b[1]-a[1]);
}

function setChartTab(type,el){
  chartBarType = type;
  document.querySelectorAll('#page-summary .chart-wrap:first-of-type .chart-tab').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  const month = document.getElementById('sumMonthSelect').value || today.slice(0,7);
  const items = window.items || [];
  const monthItems = items.filter(i=>i.date.startsWith(month));
  drawBar(monthItems, type);
}

function setDonutTab(type,el){
  chartDonutType = type;
  const wraps = document.querySelectorAll('#page-summary .chart-wrap');
  if (wraps[1]) wraps[1].querySelectorAll('.chart-tab').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  const month = document.getElementById('sumMonthSelect').value || today.slice(0,7);
  const items = window.items || [];
  const monthItems = items.filter(i=>i.date.startsWith(month));
  drawDonut(monthItems, type);
}

function drawBar(monthItems, type){
  const canvas = document.getElementById('barCanvas');
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
    ctx.roundRect ? ctx.roundRect(padL, y, barW, barH, 3) : ctx.rect(padL, y, barW, barH);
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

function drawDonut(monthItems, type){
  const canvas = document.getElementById('donutCanvas');
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
    legend.innerHTML = '';
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
  legend.innerHTML = data.map(([cat, amt], i) => {
    const pct = ((amt / total) * 100).toFixed(1);
    return `<div class="legend-item"><div class="legend-dot" style="background:${colors[i % colors.length]}"></div><span>${escapeHtml(cat)} <span style="color:var(--muted)">${pct}%</span></span></div>`;
  }).join('');
}

// ── 16. PAGE ROUTING ──
function showPage(id, el) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  el.classList.add('active');
  if(id==='page-summary') { initMonthSelect(); renderSummary(); }
  if(id==='page-category') renderCatList();
  if(id==='page-loan') renderLoan();
  if(id==='page-install') renderInstallment();
  if(id==='page-wallet') renderWalletPage();
  if(id==='page-budget') renderBudgetPage();
}

// ── 17. INITIALIZE APP ──
function initApp() {
  loadLocalStorage();
  displayCurrentDate();
  updateCategoryDropdown('income', 'categorySelect');
  updateCategoryDropdown('income', 'editCategory');
  updateWalletDropdowns();
  renderWalletFilterBar();
  renderList();
  document.getElementById('modalBg').addEventListener('click', e => {
    if (e.target === document.getElementById('modalBg')) closeModal();
  });
  document.getElementById('instPayModalBg').addEventListener('click', e => {
    if (e.target === document.getElementById('instPayModalBg')) closeInstPayModal();
  });
  console.log('🚀 Budget//Ctrl พร้อมใช้งาน');
}

initApp();
