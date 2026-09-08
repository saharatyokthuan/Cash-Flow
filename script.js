/* ===== Cash-Flow — script.js ===== */

const KEY = 'cashflow_v1';
const DEFAULT_CATS = {
  income:  ['เงินเดือน','โบนัส','ขายของ','ยืมเงิน','อื่นๆ'],
  expense: ['อาหาร','เดินทาง','ที่พัก','ช้อปปิ้ง','บิล/ค่าน้ำค่าไฟ','คืนเงินกู้','ผ่อนชำระ','อื่นๆ']
};
const PALETTE = ['#ffc94d','#4da3ff','#2fe6a8','#ff5c7a','#a97bff','#ffa53d','#41d6d6','#ff8ab8'];

let db = {
  items: [], wallets: [], cats: JSON.parse(JSON.stringify(DEFAULT_CATS)),
  installments: [], bills: []
};
let ui = {
  mode:'expense', filter:'all', walletFilter:'all', searchWalletFilter:'all',
  loanTab:'person', instTab:'phone', catTab:'income',
  chartTab:'expense', donutTab:'expense', sumMonth:'',
  billMode:'expense', confirmCb:null
};

/* ---------- utils ---------- */
const $  = id => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const money = n => (Number(n)||0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
const todayStr = () => new Date().toISOString().slice(0,10);
const monthOf = d => (d||'').slice(0,7);
const fmtDate = d => {
  if(!d) return '-';
  const [y,m,dd] = d.split('-');
  return `${dd}/${m}/${(+y+543).toString().slice(-2)}`;
};

function save(){ localStorage.setItem(KEY, JSON.stringify(db)); }
function load(){
  try{
    const raw = localStorage.getItem(KEY);
    if(raw) db = Object.assign(db, JSON.parse(raw));
  }catch(e){ console.warn('load failed', e); }
  if(!db.wallets.length) db.wallets = [{id:uid(), name:'เงินสด', init:0}];
  if(!db.cats || !db.cats.income) db.cats = JSON.parse(JSON.stringify(DEFAULT_CATS));
}

function toast(msg, type=''){
  const t = $('toast'); if(!t) return;
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(t._tm);
  t._tm = setTimeout(()=> t.className = 'toast ' + type, 2200);
}

/* ---------- confirm modal ---------- */
function askConfirm(title, message, cb){
  const bg = $('confirmModalBg'); if(!bg){ if(confirm(message)) cb(); return; }
  if($('confirmTitle')) $('confirmTitle').textContent = title;
  if($('confirmMessage')) $('confirmMessage').textContent = message;
  ui.confirmCb = cb;
  bg.classList.add('active');
}
function closeConfirm(){ $('confirmModalBg')?.classList.remove('active'); ui.confirmCb = null; }

/* ---------- navigation ---------- */
function showPage(id, el){
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === id));
  document.querySelectorAll('.nav-btn,.sidebar-btn').forEach(b=>{
    const on = (b.getAttribute('onclick')||'').includes(`'${id}'`);
    b.classList.toggle('active', on);
  });
  closeSidebar();
  window.scrollTo({top:0, behavior:'smooth'});
  if(id === 'page-summary') renderSummaryPage();
  if(id === 'page-search')  renderSearch();
  if(id === 'page-settings')renderSettings();
  if(id === 'page-loan')    renderLoan();
  if(id === 'page-install') renderInstallments();
  if(id === 'page-budget')  renderBills();
  if(id === 'page-wallet')  renderWallets();
  if(id === 'page-category')renderCats();
}
function openSidebar(){ $('sidebar')?.classList.add('active'); document.querySelector('.sidebar-overlay')?.classList.add('active'); }
function closeSidebar(){ $('sidebar')?.classList.remove('active'); document.querySelector('.sidebar-overlay')?.classList.remove('active'); }
function toggleSidebar(){ $('sidebar')?.classList.contains('active') ? closeSidebar() : openSidebar(); }

/* ---------- selects ---------- */
function fillSelect(sel, arr, valKey, txtKey, placeholder){
  if(!sel) return;
  const cur = sel.value;
  sel.innerHTML = (placeholder ? `<option value="">${placeholder}</option>` : '')
    + arr.map(o => `<option value="${valKey?o[valKey]:o}">${txtKey?o[txtKey]:o}</option>`).join('');
  if(cur && [...sel.options].some(o=>o.value===cur)) sel.value = cur;
}
function refreshSelects(){
  const cats = db.cats[ui.mode] || [];
  fillSelect($('categorySelect'), cats, null, null, '-- หมวดหมู่ --');
  fillSelect($('walletSelect'),   db.wallets, 'id', 'name');
  fillSelect($('transferFrom'),   db.wallets, 'id', 'name');
  fillSelect($('transferTo'),     db.wallets, 'id', 'name');
  fillSelect($('editWallet'),     db.wallets, 'id', 'name');
  fillSelect($('instPayWallet'),  db.wallets, 'id', 'name');
  fillSelect($('billWalletSelect'),db.wallets,'id','name');
  fillSelect($('billCategorySelect'), db.cats[ui.billMode]||[], null, null, '-- หมวดหมู่ --');
}

/* ---------- home form ---------- */
function setMode(mode, el){
  ui.mode = mode;
  document.querySelectorAll('#page-home .mode-btn').forEach(b=>b.classList.remove('active'));
  el?.classList.add('active');
  refreshSelects();
}
function toggleNoteInput(){
  const n = $('noteInput'); if(!n) return;
  const show = n.style.display === 'none';
  n.style.display = show ? 'block' : 'none';
  if($('noteToggleBtn')) $('noteToggleBtn').textContent = show ? '➖ ซ่อนหมายเหตุ' : '➕ เพิ่มหมายเหตุ';
  if(show) n.focus();
}
function addItem(){
  const name = $('nameInput').value.trim();
  const amount = parseFloat($('amountInput').value);
  if(!name)                 return toast('กรอกชื่อรายการก่อนนะ','err');
  if(!amount || amount<=0)  return toast('กรอกจำนวนเงินให้ถูกต้อง','err');
  db.items.push({
    id:uid(), date:$('dateInput').value || todayStr(), name,
    amount, type:ui.mode, category:$('categorySelect').value || 'อื่นๆ',
    wallet:$('walletSelect').value || (db.wallets[0]&&db.wallets[0].id),
    note:$('noteInput').value.trim()
  });
  save();
  $('nameInput').value=''; $('amountInput').value=''; $('noteInput').value='';
  renderAll(); toast('บันทึกรายการแล้ว','ok');
  $('nameInput').focus();
}
function setFilter(f, el){
  ui.filter = f;
  document.querySelectorAll('#page-home .filter-btn').forEach(b=>b.classList.remove('active'));
  el?.classList.add('active');
  renderList();
}

/* ---------- render: totals & list ---------- */
function walletName(id){ return (db.wallets.find(w=>w.id===id)||{}).name || '-'; }

function renderTotals(){
  const inc = db.items.filter(i=>i.type==='income').reduce((s,i)=>s+i.amount,0);
  const exp = db.items.filter(i=>i.type==='expense').reduce((s,i)=>s+i.amount,0);
  const init = db.wallets.reduce((s,w)=>s+(Number(w.init)||0),0);
  if($('totalIncome'))  $('totalIncome').textContent  = money(inc);
  if($('totalExpense')) $('totalExpense').textContent = money(exp);
  if($('balance'))      $('balance').textContent      = money(init + inc - exp);
}

function itemRow(it){
  const sign = it.type==='income' ? '+' : '-';
  const col  = it.type==='income' ? 'green' : 'red';
  return `<div class="item ${it.type}">
    <div class="item-left">
      <div class="item-name">${it.name}</div>
      <div class="item-meta">${fmtDate(it.date)} · ${it.category} · ${walletName(it.wallet)}${it.note?' · '+it.note:''}</div>
    </div>
    <div class="item-amount ${col}">${sign}${money(it.amount)}</div>
    <div class="item-actions">
      <button class="icon-btn" onclick="openEdit('${it.id}')">✏️</button>
      <button class="icon-btn del" onclick="deleteItem('${it.id}')">🗑️</button>
    </div>
  </div>`;
}

function renderWalletBar(){
  const bar = document.querySelector('#page-home .wallet-bar');
  if(bar){
    bar.innerHTML = [{id:'all',name:'ทั้งหมด'},...db.wallets].map(w=>
      `<button class="chip ${ui.walletFilter===w.id?'active':''}" onclick="setWalletFilter('${w.id}')">${w.name}</button>`).join('');
  }
  const sBar = $('walletFilterBarSearch');
  if(sBar){
    sBar.innerHTML = [{id:'all',name:'ทั้งหมด'},...db.wallets].map(w=>
      `<button class="chip ${ui.searchWalletFilter===w.id?'active':''}" onclick="setSearchWalletFilter('${w.id}')">${w.name}</button>`).join('');
  }
}
function setWalletFilter(id){ ui.walletFilter=id; renderWalletBar(); renderList(); }
function setSearchWalletFilter(id){ ui.searchWalletFilter=id; renderWalletBar(); renderSearch(); }

function renderList(){
  const box = $('list'); if(!box) return;
  let rows = [...db.items].sort((a,b)=> (b.date+b.id).localeCompare(a.date+a.id));
  if(ui.filter!=='all')       rows = rows.filter(i=>i.type===ui.filter);
  if(ui.walletFilter!=='all') rows = rows.filter(i=>i.wallet===ui.walletFilter);
  box.innerHTML = rows.length ? rows.map(itemRow).join('') : '<div class="empty">ยังไม่มีรายการ 📭</div>';
  const hd = document.querySelector('#page-home .list-header span:last-child');
  if(hd) hd.textContent = `${rows.length} รายการ`;
}

function deleteItem(id){
  const it = db.items.find(i=>i.id===id); if(!it) return;
  askConfirm('ลบรายการ', `ต้องการลบ "${it.name}" ใช่ไหม?`, ()=>{
    db.items = db.items.filter(i=>i.id!==id);
    save(); renderAll(); toast('ลบแล้ว','ok');
  });
}

/* ---------- edit modal ---------- */
function openEdit(id){
  const it = db.items.find(i=>i.id===id); if(!it) return;
  refreshSelects();
  $('editId').value = it.id;
  $('editDate').value = it.date;
  $('editName').value = it.name;
  $('editAmount').value = it.amount;
  $('editNote').value = it.note || '';
  $('editType').value = it.type;
  $('editWallet').value = it.wallet;
  fillSelect($('editCategory'), db.cats[it.type]||[], null, null, '-- หมวดหมู่ --');
  $('editCategory').value = it.category;
  $('editType').onchange = () => {
    fillSelect($('editCategory'), db.cats[$('editType').value]||[], null, null, '-- หมวดหมู่ --');
  };
  $('modalBg').classList.add('active');
}
function closeModal(){ $('modalBg')?.classList.remove('active'); }
function saveEdit(){
  const it = db.items.find(i=>i.id===$('editId').value); if(!it) return;
  const amt = parseFloat($('editAmount').value);
  if(!$('editName').value.trim()) return toast('กรอกชื่อรายการ','err');
  if(!amt || amt<=0)              return toast('จำนวนเงินไม่ถูกต้อง','err');
  Object.assign(it,{
    date:$('editDate').value, name:$('editName').value.trim(), amount:amt,
    type:$('editType').value, wallet:$('editWallet').value,
    category:$('editCategory').value || 'อื่นๆ', note:$('editNote').value.trim()
  });
  save(); closeModal(); renderAll(); toast('แก้ไขเรียบร้อย','ok');
}

/* ---------- wallets ---------- */
function addWallet(){
  const name = $('walletNameInput').value.trim();
  if(!name) return toast('กรอกชื่อบัญชี','err');
  db.wallets.push({id:uid(), name, init:parseFloat($('walletInitInput').value)||0});
  $('walletNameInput').value=''; $('walletInitInput').value='';
  save(); renderAll(); toast('เพิ่มบัญชีแล้ว','ok');
}
function walletBalance(id){
  const w = db.wallets.find(x=>x.id===id); if(!w) return 0;
  return db.items.filter(i=>i.wallet===id)
    .reduce((s,i)=> s + (i.type==='income'? i.amount : -i.amount), Number(w.init)||0);
}
function deleteWallet(id){
  if(db.wallets.length<=1) return toast('ต้องมีอย่างน้อย 1 บัญชี','err');
  const w = db.wallets.find(x=>x.id===id);
  askConfirm('ลบบัญชี', `ลบ "${w.name}" และรายการทั้งหมดในบัญชีนี้?`, ()=>{
    db.wallets = db.wallets.filter(x=>x.id!==id);
    db.items   = db.items.filter(i=>i.wallet!==id);
    save(); renderAll(); toast('ลบบัญชีแล้ว','ok');
  });
}
function renderWallets(){
  const box = $('walletList'); if(!box) return;
  box.innerHTML = db.wallets.length ? db.wallets.map(w=>{
    const b = walletBalance(w.id);
    return `<div class="item">
      <div class="item-left">
        <div class="item-name">💳 ${w.name}</div>
        <div class="item-meta">ยอดตั้งต้น ${money(w.init)} ฿</div>
      </div>
      <div class="item-amount ${b>=0?'green':'red'}">${money(b)}</div>
      <div class="item-actions"><button class="icon-btn del" onclick="deleteWallet('${w.id}')">🗑️</button></div>
    </div>`;
  }).join('') : '<div class="empty">ยังไม่มีบัญชี</div>';
}
function doTransfer(){
  const from=$('transferFrom').value, to=$('transferTo').value;
  const amt = parseFloat($('transferAmount').value);
  const note= $('transferNote').value.trim();
  if(!from||!to)      return toast('เลือกบัญชีให้ครบ','err');
  if(from===to)       return toast('บัญชีต้นทาง/ปลายทางซ้ำกัน','err');
  if(!amt||amt<=0)    return toast('จำนวนเงินไม่ถูกต้อง','err');
  const d = todayStr();
  db.items.push({id:uid(),date:d,name:`โอนไป ${walletName(to)}`,amount:amt,type:'expense',category:'โอนเงิน',wallet:from,note});
  db.items.push({id:uid(),date:d,name:`รับโอนจาก ${walletName(from)}`,amount:amt,type:'income',category:'โอนเงิน',wallet:to,note});
  $('transferAmount').value=''; $('transferNote').value='';
  save(); renderAll(); toast('โอนเงินสำเร็จ','ok');
}

/* ---------- categories ---------- */
function setCatTab(t, el){
  ui.catTab = t;
  document.querySelectorAll('.cat-tab').forEach(b=>b.classList.remove('active'));
  el?.classList.add('active'); renderCats();
}
function addCategory(){
  const n = $('catNameInput').value.trim();
  if(!n) return toast('กรอกชื่อหมวดหมู่','err');
  if(db.cats[ui.catTab].includes(n)) return toast('มีหมวดหมู่นี้แล้ว','err');
  db.cats[ui.catTab].push(n); $('catNameInput').value='';
  save(); renderCats(); refreshSelects(); toast('เพิ่มหมวดหมู่แล้ว','ok');
}
function deleteCategory(name){
  db.cats[ui.catTab] = db.cats[ui.catTab].filter(c=>c!==name);
  save(); renderCats(); refreshSelects(); toast('ลบหมวดหมู่แล้ว','ok');
}
function resetCategories(){
  askConfirm('รีเซ็ตหมวดหมู่','คืนค่าหมวดหมู่เริ่มต้นทั้งหมด?',()=>{
    db.cats = JSON.parse(JSON.stringify(DEFAULT_CATS));
    save(); renderCats(); refreshSelects(); toast('รีเซ็ตแล้ว','ok');
  });
}
function renderCats(){
  const box = $('catList'); if(!box) return;
  const list = db.cats[ui.catTab]||[];
  box.innerHTML = list.length ? list.map(c=>{
    const used = db.items.filter(i=>i.category===c && i.type===ui.catTab).length;
    return `<div class="item ${ui.catTab}">
      <div class="item-left"><div class="item-name">${c}</div>
      <div class="item-meta">ใช้ไป ${used} รายการ</div></div>
      <div class="item-actions"><button class="icon-btn del" onclick="deleteCategory('${c}')">🗑️</button></div>
    </div>`;
  }).join('') : '<div class="empty">ยังไม่มีหมวดหมู่</div>';
}

/* ---------- loan (อิงหมวด "ยืมเงิน" / "คืนเงินกู้") ---------- */
function loanData(){
  const borrow = db.items.filter(i=>i.type==='income'  && i.category==='ยืมเงิน');
  const repaid = db.items.filter(i=>i.type==='expense' && i.category==='คืนเงินกู้');
  const map = {};
  borrow.forEach(i=>{ map[i.name] = map[i.name]||{name:i.name,b:0,r:0}; map[i.name].b += i.amount; });
  repaid.forEach(i=>{ map[i.name] = map[i.name]||{name:i.name,b:0,r:0}; map[i.name].r += i.amount; });
  return {
    borrow: borrow.reduce((s,i)=>s+i.amount,0),
    repaid: repaid.reduce((s,i)=>s+i.amount,0),
    people: Object.values(map),
    rows: [...borrow,...repaid].sort((a,b)=>(b.date+b.id).localeCompare(a.date+a.id))
  };
}
function setLoanTab(t, el){
  ui.loanTab = t;
  document.querySelectorAll('.loan-tab').forEach(b=>b.classList.remove('active'));
  el?.classList.add('active'); renderLoan();
}
function renderLoan(){
  const d = loanData();
  if($('loanTotalBorrow')) $('loanTotalBorrow').textContent = money(d.borrow);
  if($('loanTotalRepaid')) $('loanTotalRepaid').textContent = money(d.repaid);
  if($('loanTotalRemain')) $('loanTotalRemain').textContent = money(d.borrow - d.repaid);
  const box = $('loanList'); if(!box) return;
  if(ui.loanTab === 'person'){
    box.innerHTML = d.people.length ? d.people.map(p=>{
      const remain = p.b - p.r, pct = p.b ? Math.min(100, p.r/p.b*100) : 0;
      return `<div class="item">
        <div class="item-left" style="width:100%">
          <div class="item-name">🤝 ${p.name}</div>
          <div class="item-meta">ยืม ${money(p.b)} · คืนแล้ว ${money(p.r)}</div>
          <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
        </div>
        <div class="item-amount ${remain>0?'red':'green'}">${money(remain)}</div>
      </div>`;
    }).join('') : '<div class="empty">ยังไม่มีรายการเงินกู้<br><small>เพิ่มรายรับหมวด "ยืมเงิน" หรือรายจ่ายหมวด "คืนเงินกู้"</small></div>';
  }else{
    box.innerHTML = d.rows.length ? d.rows.map(itemRow).join('') : '<div class="empty">ยังไม่มีรายการ</div>';
  }
}

/* ---------- installments ---------- */
function setInstTab(t, el){
  ui.instTab = t;
  document.querySelectorAll('.inst-tab').forEach(b=>b.classList.remove('active'));
  el?.classList.add('active'); renderInstallments();
}
function addInstallment(){
  const name = $('instName').value.trim();
  const total = parseFloat($('instTotal').value)||0;
  const monthly = parseFloat($('instMonthly').value)||0;
  const terms = parseInt($('instTerms').value)||0;
  if(!name)             return toast('กรอกชื่อรายการผ่อน','err');
  if(!monthly||!terms)  return toast('กรอกค่างวด/จำนวนงวดให้ครบ','err');
  db.installments.push({
    id:uid(), type:ui.instTab, name, total: total || monthly*terms,
    monthly, terms, paid: parseInt($('instPaid').value)||0,
    date: $('instDate').value || todayStr(), note: $('instNote').value.trim()
  });
  ['instName','instTotal','instMonthly','instTerms','instPaid','instNote'].forEach(id=>$(id).value='');
  save(); renderInstallments(); toast('เพิ่มรายการผ่อนแล้ว','ok');
}
function deleteInst(id){
  const it = db.installments.find(x=>x.id===id);
  askConfirm('ลบรายการผ่อน', `ลบ "${it.name}" ใช่ไหม?`, ()=>{
    db.installments = db.installments.filter(x=>x.id!==id);
    save(); renderInstallments(); toast('ลบแล้ว','ok');
  });
}
function renderInstallments(){
  const phone = db.installments.filter(i=>i.type==='phone');
  const pay   = db.installments.filter(i=>i.type==='paynext');
  const remain = a => a.reduce((s,i)=> s + Math.max(0,(i.terms-i.paid))*i.monthly, 0);
  if($('instPhoneTotal'))   $('instPhoneTotal').textContent   = money(remain(phone));
  if($('instPaynextTotal')) $('instPaynextTotal').textContent = money(remain(pay));
  const box = $('instList'); if(!box) return;
  const list = ui.instTab==='phone' ? phone : pay;
  box.innerHTML = list.length ? list.map(i=>{
    const left = Math.max(0, i.terms - i.paid);
    const pct  = i.terms ? (i.paid/i.terms*100) : 0;
    return `<div class="item">
      <div class="item-left" style="width:100%">
        <div class="item-name">📱 ${i.name} ${left===0?'<span class="badge paid">ครบแล้ว</span>':''}</div>
        <div class="item-meta">งวดละ ${money(i.monthly)} · จ่ายแล้ว ${i.paid}/${i.terms} งวด · เหลือ ${money(left*i.monthly)} ฿</div>
        <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
      </div>
      <div class="item-actions">
        ${left>0?`<button class="icon-btn" onclick="openInstPay('${i.id}')">💸</button>`:''}
        <button class="icon-btn del" onclick="deleteInst('${i.id}')">🗑️</button>
      </div>
    </div>`;
  }).join('') : '<div class="empty">ยังไม่มีรายการผ่อน</div>';
}
function openInstPay(id){
  const i = db.installments.find(x=>x.id===id); if(!i) return;
  refreshSelects();
  $('instPayId').value = id;
  $('instPayQty').value = 1;
  $('instPayDate').value = todayStr();
  $('instPayNote').value = '';
  $('instPayModalBg').classList.add('active');
}
function closeInstPayModal(){ $('instPayModalBg')?.classList.remove('active'); }
function saveInstPay(){
  const i = db.installments.find(x=>x.id===$('instPayId').value); if(!i) return;
  const qty = parseInt($('instPayQty').value)||1;
  const left = i.terms - i.paid;
  if(qty<1 || qty>left) return toast(`จ่ายได้ 1-${left} งวด`,'err');
  i.paid += qty;
  db.items.push({
    id:uid(), date:$('instPayDate').value||todayStr(),
    name:`ผ่อน ${i.name} (${qty} งวด)`, amount:i.monthly*qty, type:'expense',
    category:'ผ่อนชำระ', wallet:$('instPayWallet').value, note:$('instPayNote').value.trim()
  });
  save(); closeInstPayModal(); renderAll(); toast('บันทึกการจ่ายงวดแล้ว','ok');
}

/* ---------- bills / budget ---------- */
function setBillMode(m, el){
  ui.billMode = m;
  document.querySelectorAll('#billModeToggle .mode-btn').forEach(b=>b.classList.remove('active'));
  el?.classList.add('active');
  fillSelect($('billCategorySelect'), db.cats[m]||[], null, null, '-- หมวดหมู่ --');
}
function addBill(){
  const name = $('billName').value.trim();
  const amount = parseFloat($('billAmount').value);
  if(!name)                return toast('กรอกชื่อรายการ','err');
  if(!amount||amount<=0)   return toast('จำนวนเงินไม่ถูกต้อง','err');
  db.bills.push({
    id:uid(), name, amount, type:ui.billMode,
    due:$('billDueDate').value || todayStr(),
    category:$('billCategorySelect').value || 'อื่นๆ',
    wallet:$('billWalletSelect').value, repeat:$('billRepeatMonthly').checked, paid:false
  });
  $('billName').value=''; $('billAmount').value='';
  save(); renderBills(); toast('เพิ่มบิลแล้ว','ok');
}
function payBill(id){
  const b = db.bills.find(x=>x.id===id); if(!b) return;
  db.items.push({id:uid(),date:todayStr(),name:b.name,amount:b.amount,type:b.type,
    category:b.category,wallet:b.wallet,note:'จ่ายจากบิล'});
  if(b.repeat){
    const d = new Date(b.due); d.setMonth(d.getMonth()+1);
    b.due = d.toISOString().slice(0,10);
  }else b.paid = true;
  save(); renderAll(); toast('บันทึกการจ่ายบิลแล้ว','ok');
}
function deleteBill(id){
  db.bills = db.bills.filter(x=>x.id!==id);
  save(); renderBills(); toast('ลบบิลแล้ว','ok');
}
function renderBills(){
  const box = $('billList'); if(!box) return;
  const today = todayStr();
  const list = [...db.bills].sort((a,b)=>a.due.localeCompare(b.due));
  const unpaid = list.filter(b=>!b.paid).reduce((s,b)=>s+b.amount,0);
  if($('billListHeader')) $('billListHeader').innerHTML =
    `<span>บิลทั้งหมด ${list.length} รายการ</span><span class="gold">ค้างจ่าย ${money(unpaid)} ฿</span>`;
  box.innerHTML = list.length ? list.map(b=>{
    const overdue = !b.paid && b.due < today;
    return `<div class="item ${b.type}">
      <div class="item-left">
        <div class="item-name">${b.name} ${b.paid?'<span class="badge paid">จ่ายแล้ว</span>':overdue?'<span class="badge due">เลยกำหนด</span>':''}</div>
        <div class="item-meta">ครบกำหนด ${fmtDate(b.due)} · ${b.category}${b.repeat?' · ทำซ้ำทุกเดือน':''}</div>
      </div>
      <div class="item-amount ${b.type==='income'?'green':'red'}">${money(b.amount)}</div>
      <div class="item-actions">
        ${b.paid?'':`<button class="icon-btn" onclick="payBill('${b.id}')">✅</button>`}
        <button class="icon-btn del" onclick="deleteBill('${b.id}')">🗑️</button>
      </div>
    </div>`;
  }).join('') : '<div class="empty">ยังไม่มีบิล/รายการประจำ</div>';
}

/* ---------- search ---------- */
function renderSearch(){
  const box = $('searchList'); if(!box) return;
  const q = ($('searchInputPage')?.value || '').trim().toLowerCase();
  let rows = [...db.items].sort((a,b)=>(b.date+b.id).localeCompare(a.date+a.id));
  if(ui.searchWalletFilter!=='all') rows = rows.filter(i=>i.wallet===ui.searchWalletFilter);
  if(q) rows = rows.filter(i =>
    i.name.toLowerCase().includes(q) || (i.category||'').toLowerCase().includes(q) ||
    (i.note||'').toLowerCase().includes(q) || i.date.includes(q));
  const sum = rows.reduce((s,i)=> s + (i.type==='income'? i.amount : -i.amount), 0);
  if($('searchListHeader')) $('searchListHeader').innerHTML =
    `<span>พบ ${rows.length} รายการ</span><span class="${sum>=0?'green':'red'}">${money(sum)} ฿</span>`;
  box.innerHTML = rows.length ? rows.map(itemRow).join('') : '<div class="empty">ไม่พบรายการที่ค้นหา 🔍</div>';
}

/* ---------- summary + charts ---------- */
function monthList(){
  const s = new Set(db.items.map(i=>monthOf(i.date)).filter(Boolean));
  s.add(monthOf(todayStr()));
  return [...s].sort().reverse();
}
function setChartTab(t, el){
  ui.chartTab = t;
  el?.parentElement.querySelectorAll('.chart-tab').forEach(b=>b.classList.remove('active'));
  el?.classList.add('active'); drawBar();
}
function setDonutTab(t, el){
  ui.donutTab = t;
  el?.parentElement.querySelectorAll('.chart-tab').forEach(b=>b.classList.remove('active'));
  el?.classList.add('active'); drawDonut();
}
function renderSummaryPage(){
  const sel = $('sumMonthSelect');
  if(sel){
    const ms = monthList();
    sel.innerHTML = ms.map(m=>`<option value="${m}">${m}</option>`).join('');
    if(!ui.sumMonth || !ms.includes(ui.sumMonth)) ui.sumMonth = ms[0];
    sel.value = ui.sumMonth;
    sel.onchange = () => { ui.sumMonth = sel.value; renderSummaryPage(); };
  }
  const rows = db.items.filter(i=>monthOf(i.date)===ui.sumMonth);
  const inc = rows.filter(i=>i.type==='income').reduce((s,i)=>s+i.amount,0);
  const exp = rows.filter(i=>i.type==='expense').reduce((s,i)=>s+i.amount,0);
  if($('sumIncome'))  $('sumIncome').textContent  = money(inc);
  if($('sumExpense')) $('sumExpense').textContent = money(exp);
  if($('sumBalance')) $('sumBalance').textContent = money(inc-exp);
  const max = Math.max(inc,exp,1);
  if($('incomeBar'))  $('incomeBar').style.width  = (inc/max*100)+'%';
  if($('expenseBar')) $('expenseBar').style.width = (exp/max*100)+'%';
  const byCat = {};
  rows.filter(i=>i.type==='expense').forEach(i=> byCat[i.category]=(byCat[i.category]||0)+i.amount);
  const top = Object.entries(byCat).sort((a,b)=>b[1]-a[1])[0];
  if($('topExpense')) $('topExpense').textContent = top ? `${top[0]} (${money(top[1])} ฿)` : '-';
  const d = loanData();
  if($('summaryLoanRemain')) $('summaryLoanRemain').textContent = money(d.borrow-d.repaid);
  drawBar(); drawDonut();
}
function prepCanvas(cv, h){
  const dpr = window.devicePixelRatio||1;
  const w = cv.clientWidth || 300;
  cv.width = w*dpr; cv.height = h*dpr; cv.style.height = h+'px';
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,w,h);
  return {ctx,w,h};
}
function drawBar(){
  const cv = $('barCanvas'); if(!cv) return;
  const {ctx,w,h} = prepCanvas(cv,170);
  const months = monthList().slice(0,6).reverse();
  const vals = months.map(m => db.items.filter(i=>monthOf(i.date)===m && i.type===ui.chartTab)
                                       .reduce((s,i)=>s+i.amount,0));
  const max = Math.max(...vals,1);
  const pad = 24, bw = (w-pad*1.2)/months.length*0.6, gap = (w-pad*0.4)/months.length;
  const color = ui.chartTab==='income' ? '#2fe6a8' : '#ff5c7a';
  months.forEach((m,idx)=>{
    const bh = (vals[idx]/max)*(h-46);
    const x = pad*0.2 + idx*gap + (gap-bw)/2, y = h-26-bh;
    const g = ctx.createLinearGradient(0,y,0,h-26);
    g.addColorStop(0,color); g.addColorStop(1,color+'33');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(x,y,bw,Math.max(bh,2),[6,6,0,0]); ctx.fill();
    ctx.fillStyle='#8b9ab8'; ctx.font='10px sans-serif'; ctx.textAlign='center';
    ctx.fillText(m.slice(5), x+bw/2, h-10);
    if(vals[idx]) ctx.fillText(Math.round(vals[idx]).toLocaleString(), x+bw/2, y-5);
  });
  if(!vals.some(v=>v)){ ctx.fillStyle='#8b9ab8'; ctx.textAlign='center'; ctx.fillText('ไม่มีข้อมูล', w/2, h/2); }
}
function drawDonut(){
  const cv = $('donutCanvas'); if(!cv) return;
  const {ctx,w,h} = prepCanvas(cv,190);
  const rows = db.items.filter(i=>monthOf(i.date)===ui.sumMonth && i.type===ui.donutTab);
  const byCat = {};
  rows.forEach(i=> byCat[i.category]=(byCat[i.category]||0)+i.amount);
  const data = Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const total = data.reduce((s,d)=>s+d[1],0);
  const cx=w/2, cy=h/2, R=Math.min(w,h)/2-12, r=R*0.6;
  if(!total){
    ctx.fillStyle='#8b9ab8'; ctx.textAlign='center'; ctx.fillText('ไม่มีข้อมูล', cx, cy);
    if($('donutLegend')) $('donutLegend').innerHTML='';
    return;
  }
  let a = -Math.PI/2;
  data.forEach(([,v],idx)=>{
    const ang = v/total*Math.PI*2;
    ctx.beginPath(); ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,R,a,a+ang); ctx.closePath();
    ctx.fillStyle = PALETTE[idx%PALETTE.length]; ctx.fill();
    a += ang;
  });
  ctx.globalCompositeOperation='destination-out';
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
  ctx.globalCompositeOperation='source-over';
  ctx.fillStyle='#e8edf7'; ctx.textAlign='center'; ctx.font='bold 13px sans-serif';
  ctx.fillText(Math.round(total).toLocaleString(), cx, cy+2);
  ctx.fillStyle='#8b9ab8'; ctx.font='10px sans-serif'; ctx.fillText('บาท', cx, cy+16);
  if($('donutLegend')) $('donutLegend').innerHTML = data.map(([k,v],idx)=>
    `<div class="lg-row"><span class="lg-dot" style="background:${PALETTE[idx%PALETTE.length]}"></span>
     <span class="lg-name">${k}</span><span class="lg-val">${money(v)} (${(v/total*100).toFixed(0)}%)</span></div>`).join('');
}

/* ---------- settings / import / export ---------- */
function renderSettings(){
  if($('settingsItemCount'))   $('settingsItemCount').textContent   = db.items.length;
  if($('settingsWalletCount')) $('settingsWalletCount').textContent = db.wallets.length;
}
function downloadXLSX(){
  if(!db.items.length) return toast('ยังไม่มีข้อมูลให้บันทึก','err');
  const rows = db.items.map(i=>({
    วันที่:i.date, รายการ:i.name, ประเภท:i.type==='income'?'รายรับ':'รายจ่าย',
    หมวดหมู่:i.category, บัญชี:walletName(i.wallet), จำนวนเงิน:i.amount, หมายเหตุ:i.note||''
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'รายการ');
  XLSX.writeFile(wb, `cashflow_${todayStr()}.xlsx`);
  toast('ดาวน์โหลดไฟล์แล้ว','ok');
}
function importXLSX(e){
  const f = e.target.files[0]; if(!f) return;
  const rd = new FileReader();
  rd.onload = ev => {
    try{
      const wb = XLSX.read(new Uint8Array(ev.target.result), {type:'array'});
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      let n = 0;
      rows.forEach(r=>{
        const amt = parseFloat(r['จำนวนเงิน']||r.amount||0); if(!amt) return;
        let wid = (db.wallets.find(w=>w.name===(r['บัญชี']||r.wallet))||db.wallets[0]).id;
        let date = r['วันที่']||r.date||todayStr();
        if(typeof date === 'number') date = new Date(Date.UTC(1899,11,30+date)).toISOString().slice(0,10);
        db.items.push({id:uid(), date:String(date).slice(0,10),
          name:r['รายการ']||r.name||'นำเข้า', amount:amt,
          type:(r['ประเภท']||r.type)==='รายรับ'?'income':'expense',
          category:r['หมวดหมู่']||r.category||'อื่นๆ', wallet:wid, note:r['หมายเหตุ']||''});
        n++;
      });
      save(); renderAll(); toast(`นำเข้า ${n} รายการแล้ว`,'ok');
    }catch(err){ console.error(err); toast('ไฟล์ไม่ถูกต้อง','err'); }
    e.target.value='';
  };
  rd.readAsArrayBuffer(f);
}
function exportForChat(){
  const txt = JSON.stringify(db);
  navigator.clipboard?.writeText(txt)
    .then(()=>toast('คัดลอกข้อมูลสำรองแล้ว','ok'))
    .catch(()=>{ prompt('คัดลอกข้อความนี้เก็บไว้:', txt); });
}
function clearAll(){
  askConfirm('ล้างรายการทั้งหมด','ข้อมูลรายรับ-รายจ่ายทั้งหมดจะถูกลบถาวร ยืนยันไหม?',()=>{
    db.items = [];
    save(); renderAll(); toast('ล้างข้อมูลแล้ว','ok');
  });
}

/* ---------- master render ---------- */
function renderAll(){
  renderTotals(); renderWalletBar(); renderList(); renderWallets();
  renderCats(); renderLoan(); renderInstallments(); renderBills();
  renderSearch(); renderSettings(); refreshSelects();
  if($('page-summary')?.classList.contains('active')) renderSummaryPage();
}

/* ---------- init ---------- */
document.addEventListener('DOMContentLoaded', ()=>{
  load();
  if($('CurrentDate')) $('CurrentDate').textContent =
    new Date().toLocaleDateString('th-TH',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  if($('dateInput')) $('dateInput').value = todayStr();
  if($('instDate'))  $('instDate').value  = todayStr();
  if($('billDueDate')) $('billDueDate').value = todayStr();

  document.querySelector('.hamburger-btn')?.addEventListener('click', toggleSidebar);
  document.querySelector('.sidebar-close')?.addEventListener('click', closeSidebar);
  document.querySelector('.sidebar-overlay')?.addEventListener('click', closeSidebar);
  document.querySelector('.btn-settings')?.addEventListener('click', ()=>showPage('page-settings'));

  $('searchInputPage')?.addEventListener('input', renderSearch);
  $('confirmYesBtn')?.addEventListener('click', ()=>{ const cb=ui.confirmCb; closeConfirm(); cb&&cb(); });
  $('confirmNoBtn')?.addEventListener('click', closeConfirm);

  ['modalBg','instPayModalBg','confirmModalBg'].forEach(id=>{
    $(id)?.addEventListener('click', e=>{ if(e.target.id===id) e.target.classList.remove('active'); });
  });
  document.addEventListener('keydown', e=>{
    if(e.key==='Escape'){ closeModal(); closeInstPayModal(); closeConfirm(); closeSidebar(); }
  });
  window.addEventListener('resize', ()=>{ if($('page-summary')?.classList.contains('active')){ drawBar(); drawDonut(); }});

  
  const first = document.querySelector('.page.active') ? null : showPage('page-home');
});

/* expose for inline onclick */
Object.assign(window,{showPage,setMode,addItem,toggleNoteInput,downloadXLSX,importXLSX,clearAll,
  setFilter,setWalletFilter,setSearchWalletFilter,openEdit,deleteItem,closeModal,saveEdit,
  addWallet,deleteWallet,doTransfer,setCatTab,addCategory,deleteCategory,resetCategories,
  setLoanTab,setInstTab,addInstallment,deleteInst,openInstPay,closeInstPayModal,saveInstPay,
  setBillMode,addBill,payBill,deleteBill,setChartTab,setDonutTab,exportForChat,
  toggleSidebar,openSidebar,closeSidebar});
  renderAll();