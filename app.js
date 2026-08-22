/* ============ CONFIG & CONSTANTS ============ */
const CONFIG_KEY = 'gh-budget-config-v1';
const CAT_PALETTE = ['#4E3868','#1F9968','#BE9A4C','#3B6E91','#A14E42','#7A5A9E','#3D8C7A','#8A6B45','#6B6A63'];
const MEMBER_PALETTE = ['#4E3868','#1F9968','#3B6E91','#BE9A4C','#A14E42'];

const BASE_CATEGORIES = [
  { id:'byvanie',     name:'Bývanie',        color:'#4E3868' },
  { id:'potraviny',   name:'Jedlo',          color:'#BE9A4C' },
  { id:'doprava',     name:'Doprava',        color:'#3B6E91' },
  { id:'nakupovanie', name:'Nakupovanie',    color:'#A14E9E' },
  { id:'zdravie',     name:'Zdravie',        color:'#3D8C7A' },
  { id:'deti',        name:'Deti a škola',   color:'#7A5A9E' },
  { id:'zabava',      name:'Zábava',         color:'#C97A4A' },
  { id:'domacnost',   name:'Domácnosť',      color:'#8A6B45' },
  { id:'ostatne',     name:'Ostatné',        color:'#8B8A82' },
];
const INCOME_CATEGORIES = [
  { id:'vyplata',        name:'Výplata',      color:'#1F9968' },
  { id:'bonus',          name:'Bonus/Odmena', color:'#3DAE84' },
  { id:'ostatny-prijem', name:'Iný príjem',   color:'#6FC29F' },
];
const DEFAULT_RECURRING = [
  { id:'rec-ele',  name:'Elektrina', category:'byvanie', amount:65, dueDay:15, type:'expense' },
  { id:'rec-voda', name:'Voda',      category:'byvanie', amount:22, dueDay:18, type:'expense' },
  { id:'rec-plyn', name:'Plyn',      category:'byvanie', amount:38, dueDay:20, type:'expense' },
];
const DEFAULT_MEMBERS = [
  { id:'m1', name:'Ja', color:'#4E3868' },
  { id:'m2', name:'Partner/ka', color:'#3B6E91' },
];
const MONTHS_SK = ['Január','Február','Marec','Apríl','Máj','Jún','Júl','August','September','Október','November','December'];
const MONTHS_SHORT_SK = ['Jan','Feb','Mar','Apr','Máj','Jún','Júl','Aug','Sep','Okt','Nov','Dec'];
const DAYS_SK = ['Nedeľa','Pondelok','Utorok','Streda','Štvrtok','Piatok','Sobota'];

const ICONS = {
  edit: '<path d="M11.3 2.3a1 1 0 0 1 1.4 0l1 1a1 1 0 0 1 0 1.4L5 13.4l-2.7.7.7-2.7z"/>',
  trash: '<path d="M2.5 4.5h11M6 4.5V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M4.5 4.5l.6 8.2a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-8.2"/>',
  gear: '<circle cx="8" cy="8" r="2.1"/><path d="M8 1.6v1.6M8 12.8v1.6M14.4 8h-1.6M3.2 8H1.6M12.5 3.5l-1.1 1.1M4.6 11.4l-1.1 1.1M12.5 12.5l-1.1-1.1M4.6 4.6 3.5 3.5"/>',
  refresh: '<path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3.2h-3.2"/>',
  search: '<circle cx="7" cy="7" r="4.3"/><path d="M13.3 13.3 10.3 10.3"/>',
  download: '<path d="M8 2v8M4.5 7 8 10.5 11.5 7M3 13.5h10"/>',
  plus: '<path d="M8 3v10M3 8h10"/>',
  close: '<path d="M4 4l8 8M12 4l-8 8"/>',
  arrowUp: '<path d="M8 13V3M4 7l4-4 4 4"/>',
  arrowDown: '<path d="M8 3v10M4 9l4 4 4-4"/>',
};
function icon(name, size){
  size = size || 15;
  return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]||''}</svg>`;
}

/* ============ STATE ============ */
let ghConfig = null;
let sha = null;
let transactions = [], recurringBills = [], customCategories = [];
let settings = { monthlyBudget:null, categoryBudgets:{}, members: DEFAULT_MEMBERS.slice() };
let dataLoaded = false;
let loadError = null;
let connecting = false;
let saving = false;
let saveError = false;
let lastSynced = null;
let saveTimer = null;

let currentMonth = new Date().toISOString().slice(0,7);
let activeFilter = null;
let recurFormOpen = false;
let editingRecurId = null;
let addCatOpen = false;
let editingId = null;
let editingBudgetCat = null;
let editingMonthlyBudget = false;
let searchQuery = '';
let trendRange = 6;
let settingsOpen = false;
let addMemberOpen = false;
let formType = 'expense';
let toastState = null;
let toastTimer = null;

/* ============ HELPERS ============ */
function allExpenseCategories(){ return BASE_CATEGORIES.concat(customCategories); }
function allCategoriesForType(type){ return type === 'income' ? INCOME_CATEGORIES : allExpenseCategories(); }
function catInfo(id, type){
  const list = type === 'income' ? INCOME_CATEGORIES : allExpenseCategories();
  return list.find(c => c.id === id) || (type === 'income' ? INCOME_CATEGORIES[INCOME_CATEGORIES.length-1] : BASE_CATEGORIES[BASE_CATEGORIES.length-1]);
}
function memberInfo(id){ return (settings.members||[]).find(m => m.id === id) || (settings.members||[])[0] || DEFAULT_MEMBERS[0]; }
function fmtEUR(n){ return n.toLocaleString('sk-SK', { minimumFractionDigits:2, maximumFractionDigits:2 }) + ' €'; }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function pad2(n){ return String(n).padStart(2,'0'); }
function daysInMonth(ym){ const [y,m]=ym.split('-').map(Number); return new Date(y,m,0).getDate(); }
function esc(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function initials(name){ return (name||'?').trim().slice(0,2).toUpperCase(); }

function encodeB64Utf8(str){
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin);
}
function decodeB64Utf8(b64){
  const bin = atob(b64.replace(/\n/g,''));
  const bytes = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

function showToast(message, actionLabel, action){
  clearTimeout(toastTimer);
  toastState = { message, actionLabel, action };
  renderToast();
  toastTimer = setTimeout(() => { toastState = null; renderToast(); }, 6000);
}

/* ============ GITHUB STORAGE ============ */
function apiUrl(path){
  return `https://api.github.com/repos/${ghConfig.owner}/${ghConfig.repo}/contents/${encodeURIComponent(ghConfig.path).replace(/%2F/g,'/')}`;
}
function ghHeaders(){
  return {
    'Authorization': `Bearer ${ghConfig.token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function verifyRepo(){
  const res = await fetch(`https://api.github.com/repos/${ghConfig.owner}/${ghConfig.repo}`, { headers: ghHeaders() });
  if (res.status === 404) throw new Error('Repozitár sa nenašiel. Skontroluj názov účtu a repozitára.');
  if (res.status === 401) throw new Error('Token je neplatný alebo expirovaný.');
  if (res.status === 403) throw new Error('Token nemá prístup k tomuto repozitáru.');
  if (!res.ok) throw new Error(`Chyba pripojenia (${res.status}).`);
}

function defaultDataset(){
  return {
    transactions: [],
    recurringBills: DEFAULT_RECURRING.slice(),
    customCategories: [],
    settings: { monthlyBudget:null, categoryBudgets:{}, members: DEFAULT_MEMBERS.slice() }
  };
}

async function loadDataFile(){
  const res = await fetch(apiUrl(), { headers: ghHeaders() });
  if (res.status === 404){
    const defaults = defaultDataset();
    await createDataFile(defaults);
    applyDataset(defaults);
    return;
  }
  if (res.status === 401) throw new Error('Token je neplatný alebo expirovaný.');
  if (res.status === 403) throw new Error('Token nemá prístup k tomuto súboru.');
  if (!res.ok) throw new Error(`Nepodarilo sa načítať dáta (${res.status}).`);
  const json = await res.json();
  sha = json.sha;
  const parsed = JSON.parse(decodeB64Utf8(json.content));
  applyDataset(parsed);
}

function applyDataset(parsed){
  // migration: old schema used `expenses` with no `type` field
  const rawTx = parsed.transactions || parsed.expenses || [];
  transactions = rawTx.map(t => ({ ...t, type: t.type || 'expense' }));
  recurringBills = (parsed.recurringBills || DEFAULT_RECURRING.slice()).map(b => ({ ...b, type: b.type || 'expense' }));
  customCategories = parsed.customCategories || [];
  settings = parsed.settings || { monthlyBudget:null, categoryBudgets:{}, members: DEFAULT_MEMBERS.slice() };
  if (!settings.members || !settings.members.length) settings.members = DEFAULT_MEMBERS.slice();
  if (!settings.categoryBudgets) settings.categoryBudgets = {};
}

async function createDataFile(data){
  const res = await fetch(apiUrl(), {
    method:'PUT', headers: { ...ghHeaders(), 'Content-Type':'application/json' },
    body: JSON.stringify({ message: 'Inicializácia domáceho rozpočtu', content: encodeB64Utf8(JSON.stringify(data, null, 2)) })
  });
  if (!res.ok) throw new Error('Nepodarilo sa vytvoriť dátový súbor v repozitári.');
  const json = await res.json();
  sha = json.content.sha;
}

async function commitToGitHub(contentStr, isRetry){
  const body = { message:'Aktualizácia rozpočtu', content: encodeB64Utf8(contentStr) };
  if (sha) body.sha = sha;
  const res = await fetch(apiUrl(), { method:'PUT', headers: { ...ghHeaders(), 'Content-Type':'application/json' }, body: JSON.stringify(body) });
  if (res.status === 409 && !isRetry){
    await loadDataFile();
    return commitToGitHub(contentStr, true);
  }
  if (!res.ok) throw new Error(`Uloženie zlyhalo (${res.status}).`);
  const json = await res.json();
  sha = json.content.sha;
}

function scheduleSave(){
  saving = true; saveError = false;
  renderSyncStatus();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(doSave, 1100);
}
async function doSave(){
  try{
    const payload = JSON.stringify({ transactions, recurringBills, customCategories, settings });
    await commitToGitHub(payload);
    saving = false; saveError = false; lastSynced = new Date();
  }catch(e){
    saving = false; saveError = true;
    showToast('Uloženie zlyhalo — skontroluj pripojenie.', null, null);
  }
  renderSyncStatus();
}
async function manualSync(){
  if (!ghConfig) return;
  connecting = true; render();
  try{ await loadDataFile(); loadError = null; lastSynced = new Date(); }
  catch(e){ showToast(e.message || 'Synchronizácia zlyhala.', null, null); }
  connecting = false; render();
}

function connectAndLoad(){
  loadError = null; dataLoaded = false; connecting = true; render();
  (async () => {
    try{
      await verifyRepo();
      await loadDataFile();
      dataLoaded = true; lastSynced = new Date();
    }catch(e){
      loadError = e.message || 'Nepodarilo sa pripojiť.';
    }
    connecting = false;
    render();
  })();
}

function disconnect(){
  if (!confirm('Odpojiť tento repozitár? Token sa vymaže z tohto prehliadača (dáta v GitHube ostanú zachované).')) return;
  localStorage.removeItem(CONFIG_KEY);
  ghConfig = null; dataLoaded = false; sha = null;
  const d = defaultDataset();
  transactions = d.transactions; recurringBills = d.recurringBills; customCategories = d.customCategories; settings = d.settings;
  settingsOpen = false;
  render();
}

/* ============ MUTATIONS ============ */
function addTransaction(data){
  transactions.push({
    id:'t'+Date.now()+Math.random().toString(36).slice(2,7),
    type: data.type, date:data.date, category:data.category,
    description:data.description || catInfo(data.category, data.type).name,
    amount:data.amount, paidBy:data.paidBy || (settings.members[0]||{}).id,
    recurringId:data.recurringId || null
  });
  scheduleSave(); render();
}
function updateTransaction(id, data){
  const t = transactions.find(x => x.id === id);
  if (!t) return;
  t.date=data.date; t.category=data.category; t.description=data.description || catInfo(data.category, t.type).name; t.amount=data.amount; t.paidBy=data.paidBy;
  editingId = null; scheduleSave(); render();
}
function deleteTransaction(id){
  const idx = transactions.findIndex(t => t.id === id);
  if (idx === -1) return;
  const [removed] = transactions.splice(idx, 1);
  scheduleSave(); render();
  showToast('Záznam odstránený.', 'Vrátiť späť', () => { transactions.splice(idx, 0, removed); scheduleSave(); render(); });
}

function markRecurringPaid(bill){
  const dim = daysInMonth(currentMonth);
  const day = Math.min(bill.dueDay, dim);
  addTransaction({ type: bill.type, date:`${currentMonth}-${pad2(day)}`, category:bill.category, description:bill.name, amount:bill.amount, paidBy:(settings.members[0]||{}).id, recurringId:bill.id });
}
function unmarkRecurringPaid(bill){
  const match = transactions.find(t => t.recurringId===bill.id && t.date.startsWith(currentMonth));
  if (match) deleteTransaction(match.id);
}
function addRecurringBill(data){
  recurringBills.push({ id:'rec'+Date.now()+Math.random().toString(36).slice(2,5), name:data.name, category:data.category, amount:data.amount, dueDay:data.dueDay, type:data.type });
  recurFormOpen = null; scheduleSave(); render();
}
function updateRecurringBill(id, data){
  const b = recurringBills.find(x=>x.id===id); if (!b) return;
  b.name=data.name; b.category=data.category; b.amount=data.amount; b.dueDay=data.dueDay;
  editingRecurId = null; scheduleSave(); render();
}
function deleteRecurringBill(id){
  const idx = recurringBills.findIndex(b=>b.id===id); if (idx===-1) return;
  const [removed] = recurringBills.splice(idx,1);
  scheduleSave(); render();
  showToast('Pravidelná položka odstránená.', 'Vrátiť späť', () => { recurringBills.splice(idx,0,removed); scheduleSave(); render(); });
}

function addCustomCategory(name){
  const id = 'cc' + Date.now().toString(36);
  const color = CAT_PALETTE[(BASE_CATEGORIES.length + customCategories.length) % CAT_PALETTE.length];
  customCategories.push({ id, name, color });
  addCatOpen = false; scheduleSave(); render();
}
function deleteCustomCategory(id){
  const used = transactions.some(t=>t.category===id) || recurringBills.some(b=>b.category===id);
  if (used){ showToast('Túto kategóriu nemožno odstrániť — používajú ju záznamy.', null, null); return; }
  customCategories = customCategories.filter(c => c.id !== id);
  delete settings.categoryBudgets[id];
  scheduleSave(); render();
}

function setCategoryBudget(catId, val){
  if (val === null) delete settings.categoryBudgets[catId];
  else settings.categoryBudgets[catId] = val;
  editingBudgetCat = null; scheduleSave(); render();
}
function setMonthlyBudget(val){ settings.monthlyBudget = val; editingMonthlyBudget = false; scheduleSave(); render(); }

function addMember(name){
  const id = 'mem'+Date.now().toString(36);
  const color = MEMBER_PALETTE[settings.members.length % MEMBER_PALETTE.length];
  settings.members.push({ id, name, color });
  addMemberOpen = false; scheduleSave(); render();
}
function renameMember(id, name){
  const m = settings.members.find(x=>x.id===id); if (!m) return;
  m.name = name; scheduleSave();
}
function deleteMember(id){
  if (settings.members.length <= 1){ showToast('Musí zostať aspoň jeden člen.', null, null); return; }
  const used = transactions.some(t=>t.paidBy===id);
  if (used){ showToast('Tohto člena nemožno odstrániť — má priradené záznamy.', null, null); return; }
  settings.members = settings.members.filter(m=>m.id!==id);
  scheduleSave(); render();
}

function shiftMonth(delta){
  const [y,m] = currentMonth.split('-').map(Number);
  const d = new Date(y, m-1+delta, 1);
  currentMonth = d.getFullYear() + '-' + pad2(d.getMonth()+1);
  render();
}
function monthLabel(ym){ const [y,m]=ym.split('-').map(Number); return MONTHS_SK[m-1]+' '+y; }
function prevMonthKey(ym){ const [y,m]=ym.split('-').map(Number); const d=new Date(y,m-2,1); return d.getFullYear()+'-'+pad2(d.getMonth()+1); }
function lastNMonths(ym, n){
  const [y,m] = ym.split('-').map(Number); const out=[];
  for (let i=n-1;i>=0;i--){ const d=new Date(y,m-1-i,1); out.push(d.getFullYear()+'-'+pad2(d.getMonth()+1)); }
  return out;
}

function exportCSV(rows){
  if (!rows.length){ showToast('Žiadne záznamy na export.', null, null); return; }
  const header = 'Dátum;Typ;Kategória;Popis;Suma (EUR);Osoba';
  const lines = rows.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(t => `${t.date};${t.type==='income'?'Príjem':'Výdavok'};${catInfo(t.category,t.type).name};"${(t.description||'').replace(/"/g,'""')}";${t.amount.toFixed(2)};${memberInfo(t.paidBy).name}`);
  const csv = '\uFEFF' + [header, ...lines].join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `rozpocet-${currentMonth}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ============ VISUALS ============ */
function balanceScaleSVG(income, expense){
  const maxAngle = 20;
  const ref = Math.max(income, expense, 1);
  const angle = Math.max(-maxAngle, Math.min(maxAngle, ((income - expense) / ref) * maxAngle));
  const cx = 31, cy = 8; // fulcrum point
  return `<svg viewBox="0 0 62 46" width="62" height="46">
    <line x1="31" y1="14" x2="31" y2="40" stroke="#D8D4C8" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M25 40h12" stroke="#D8D4C8" stroke-width="2.5" stroke-linecap="round"/>
    <g transform="rotate(${angle.toFixed(1)} ${cx} ${cy})">
      <line x1="4" y1="8" x2="58" y2="8" stroke="#BE9A4C" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="31" cy="8" r="3.4" fill="#BE9A4C"/>
      <line x1="4" y1="8" x2="4" y2="19" stroke="#B9B6AB" stroke-width="1.3"/>
      <line x1="58" y1="8" x2="58" y2="19" stroke="#B9B6AB" stroke-width="1.3"/>
      <ellipse cx="4" cy="21" rx="7.5" ry="4" fill="#A14E42"/>
      <ellipse cx="58" cy="21" rx="7.5" ry="4" fill="#1F9968"/>
    </g>
  </svg>`;
}

function donutSVG(catRows, total){
  const r = 54, cx = 75, cy = 75, sw = 20, circ = 2*Math.PI*r;
  let offset = 0;
  const segs = catRows.filter(c=>c.amount>0).map(c => {
    const frac = c.amount/total;
    const len = frac*circ;
    const dash = `${len} ${circ-len}`;
    const rot = (offset/circ)*360 - 90;
    offset += len;
    return `<circle class="donut-seg" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c.color}" stroke-width="${sw}" stroke-dasharray="${dash}" transform="rotate(${rot} ${cx} ${cy})" stroke-linecap="butt"/>`;
  }).join('');
  const track = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--bg-tint)" stroke-width="${sw}"/>`;
  return `<svg viewBox="0 0 150 150" width="150" height="150">${track}${segs || ''}</svg>`;
}

function divergingTrendHTML(){
  const months = lastNMonths(currentMonth, trendRange);
  const incomeT = months.map(ym => transactions.filter(t=>t.type==='income' && t.date.startsWith(ym)).reduce((s,t)=>s+t.amount,0));
  const expenseT = months.map(ym => transactions.filter(t=>t.type==='expense' && t.date.startsWith(ym)).reduce((s,t)=>s+t.amount,0));
  const max = Math.max(1, ...incomeT, ...expenseT);
  return `<div class="divchart">${months.map((ym,i) => {
    const [,m] = ym.split('-').map(Number);
    const isCur = ym === currentMonth;
    const hUp = Math.max(2, (incomeT[i]/max*100));
    const hDown = Math.max(2, (expenseT[i]/max*100));
    return `<div class="divchart-col ${isCur?'iscur':''}">
      <div class="divchart-up">
        <div class="divchart-val">${incomeT[i]>0?Math.round(incomeT[i]):''}</div>
        <div class="divchart-bar" style="height:${hUp}%; background:var(--income); animation-delay:${i*0.04}s"></div>
      </div>
      <div class="divchart-axis"></div>
      <div class="divchart-down">
        <div class="divchart-bar down" style="height:${hDown}%; background:var(--plum-dim); animation-delay:${i*0.04}s"></div>
        <div class="divchart-val">${expenseT[i]>0?Math.round(expenseT[i]):''}</div>
      </div>
      <div class="divchart-label">${MONTHS_SHORT_SK[m-1]}</div>
    </div>`;
  }).join('')}</div>`;
}

/* ============ TOAST & SYNC STATUS (lightweight DOM patch) ============ */
function renderToast(){
  const existing = document.getElementById('toastEl');
  if (existing) existing.remove();
  if (!toastState) return;
  const el = document.createElement('div');
  el.className = 'toast'; el.id = 'toastEl';
  el.innerHTML = `<span>${esc(toastState.message)}</span>${toastState.actionLabel ? `<button id="toastActionBtn">${esc(toastState.actionLabel)}</button>` : ''}`;
  document.body.appendChild(el);
  if (toastState.action){
    document.getElementById('toastActionBtn').onclick = () => { toastState.action(); toastState = null; renderToast(); };
  }
}
function renderSyncStatus(){
  const pill = document.getElementById('connPill');
  const syncBtn = document.getElementById('syncBtn');
  if (!pill) return;
  let dotClass = 'ok', text = 'pripojené';
  if (saving) { dotClass = 'saving'; text = 'ukladá sa…'; }
  else if (saveError) { dotClass = 'err'; text = 'chyba ukladania'; }
  else if (lastSynced) { text = 'uložené ' + lastSynced.toLocaleTimeString('sk-SK', {hour:'2-digit', minute:'2-digit'}); }
  pill.innerHTML = `<span class="conn-dot ${dotClass}"></span><a href="https://github.com/${ghConfig.owner}/${ghConfig.repo}" target="_blank" rel="noopener">${esc(ghConfig.owner)}/${esc(ghConfig.repo)}</a> &middot; ${text}`;
  if (syncBtn) syncBtn.classList.toggle('spinning', connecting);
}

/* ============ MAIN RENDER DISPATCH ============ */
function render(){
  if (!ghConfig){ renderSetup(); return; }
  if (connecting && !dataLoaded){ renderConnecting(); return; }
  if (loadError){ renderSetup(loadError); return; }
  renderApp();
}

function renderConnecting(){
  document.getElementById('app').innerHTML = `<div class="setup-wrap"><div class="setup-card" style="text-align:center;"><div class="spinner"></div><p class="desc" style="margin:0;">Pripájam sa na ${esc(ghConfig.owner)}/${esc(ghConfig.repo)}&hellip;</p></div></div>`;
}

function renderSetup(errorMsg){
  const app = document.getElementById('app');
  const cfg = ghConfig || {};
  app.innerHTML = `
    <div class="setup-wrap">
      <div class="eyebrow" style="text-align:center;">Domáci rozpočet</div>
      <div class="setup-card">
        <h2>Pripojiť GitHub repozitár</h2>
        <p class="desc">Dáta rozpočtu sa budú ukladať priamo do vášho GitHub repozitára ako JSON súbor — každá zmena je commit, takže máte aj históriu úprav zadarmo.</p>
        ${errorMsg ? `<div class="setup-error">${esc(errorMsg)}</div>` : ''}
        <div class="setup-field">
          <label>Vlastník repozitára (username)</label>
          <input type="text" id="cfgOwner" placeholder="napr. Radoslav-PM" value="${esc(cfg.owner||'')}">
        </div>
        <div class="setup-field">
          <label>Názov repozitára</label>
          <input type="text" id="cfgRepo" placeholder="napr. home-budget-data" value="${esc(cfg.repo||'')}">
        </div>
        <div class="setup-field">
          <label>Cesta k dátovému súboru</label>
          <input type="text" id="cfgPath" placeholder="budget-data.json" value="${esc(cfg.path||'budget-data.json')}">
          <div class="hint">Tento súbor appka sama vytvorí, ak ešte neexistuje.</div>
        </div>
        <div class="setup-field">
          <label>Personal Access Token</label>
          <input type="password" id="cfgToken" placeholder="ghp_... alebo github_pat_..." value="">
          <div class="hint">Vlastník repozitára použije <b>fine-grained token</b> obmedzený na tento repozitár (Contents: Read and write). Ak si len collaborator na cudzom repozitári, GitHub aktuálne vyžaduje <b>classic token</b> so scope <b>repo</b> — vytvoríš ho na <a href="https://github.com/settings/tokens" target="_blank" rel="noopener">github.com/settings/tokens</a>. Token sa uloží len v tomto prehliadači.</div>
        </div>
        <button class="setup-submit" id="cfgSubmit" ${connecting?'disabled':''}>${connecting ? 'Pripájam sa…' : 'Pripojiť'}</button>
      </div>
    </div>
  `;
  document.getElementById('cfgSubmit').onclick = () => {
    const owner = document.getElementById('cfgOwner').value.trim();
    const repo = document.getElementById('cfgRepo').value.trim();
    const path = document.getElementById('cfgPath').value.trim() || 'budget-data.json';
    const token = document.getElementById('cfgToken').value.trim();
    if (!owner || !repo || !token){ alert('Vyplň prosím účet, repozitár a token.'); return; }
    ghConfig = { owner, repo, path, token };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(ghConfig));
    connectAndLoad();
  };
}

/* ============ MAIN APP RENDER ============ */
function renderApp(){
  const monthTx = transactions.filter(t => t.date.startsWith(currentMonth));
  let filtered = activeFilter ? monthTx.filter(t => t.type==='expense' && t.category === activeFilter) : monthTx;
  if (searchQuery.trim()){
    const q = searchQuery.trim().toLowerCase();
    filtered = filtered.filter(t => (t.description||'').toLowerCase().includes(q) || catInfo(t.category,t.type).name.toLowerCase().includes(q));
  }

  const totalExpense = monthTx.filter(t=>t.type==='expense').reduce((s,t)=> s + t.amount, 0);
  const totalIncome = monthTx.filter(t=>t.type==='income').reduce((s,t)=> s + t.amount, 0);
  const balance = totalIncome - totalExpense;

  const prevKey = prevMonthKey(currentMonth);
  const prevExpense = transactions.filter(t=>t.type==='expense' && t.date.startsWith(prevKey)).reduce((s,t)=>s+t.amount,0);
  const expenseDiff = prevExpense > 0 ? ((totalExpense - prevExpense) / prevExpense * 100) : null;

  const now = new Date();
  const [cy,cm] = currentMonth.split('-').map(Number);
  const isCurrentMonth = (now.getFullYear()===cy && now.getMonth()+1===cm);
  const dayDivisor = isCurrentMonth ? now.getDate() : daysInMonth(currentMonth);
  const avgPerDay = totalExpense / dayDivisor;

  const byCat = {};
  monthTx.filter(t=>t.type==='expense').forEach(t => { byCat[t.category] = (byCat[t.category]||0) + t.amount; });
  const catRowsAll = allExpenseCategories().map(c => ({ ...c, amount: byCat[c.id] || 0, budget: settings.categoryBudgets[c.id] || null, isCustom: customCategories.some(cc=>cc.id===c.id) }));
  const catRows = catRowsAll.filter(c => c.amount > 0 || c.id === activeFilter).sort((a,b) => b.amount - a.amount);
  const maxCat = Math.max(1, ...catRows.map(c=>Math.max(c.amount, c.budget||0)));

  const byMember = {};
  monthTx.filter(t=>t.type==='expense').forEach(t => { byMember[t.paidBy] = (byMember[t.paidBy]||0) + t.amount; });

  const mb = settings.monthlyBudget;
  const mbPct = mb ? Math.min(100, (totalExpense/mb)*100) : 0;
  const mbOver = mb && totalExpense > mb;
  const mbColor = mbOver ? 'var(--alert)' : (mb && totalExpense/mb > 0.85 ? 'var(--gold)' : 'var(--income)');

  const grouped = {};
  filtered.slice().sort((a,b)=> b.date.localeCompare(a.date)).forEach(t => { (grouped[t.date] = grouped[t.date] || []).push(t); });

  const expenseBills = recurringBills.filter(b => b.type === 'expense');
  const incomeBills = recurringBills.filter(b => b.type === 'income');

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="eyebrow">Mesačný výkaz &middot; domácnosť</div>
    <div class="title-row">
      <div class="title-left"><h1>Domáci rozpočet</h1></div>
      <div class="header-right">
        <div class="conn-pill" id="connPill"></div>
        <button class="icon-btn" id="syncBtn" title="Synchronizovať">${icon('refresh',15)}</button>
        <button class="icon-btn" id="settingsBtn" title="Nastavenia">${icon('gear',15)}</button>
        <div class="month-nav">
          <button id="prevM">&#8249;</button>
          <span class="month-label">${monthLabel(currentMonth)}</span>
          <button id="nextM">&#8250;</button>
        </div>
      </div>
    </div>

    ${settingsOpen ? renderSettingsPanel() : ''}
    ${mbOver && isCurrentMonth ? `<div class="alert-banner"><span class="d"></span>Prekročili ste mesačný rozpočet o ${fmtEUR(totalExpense-mb)}.</div>` : ''}

    <div class="kpi-row">
      <div class="kpi-card"><div class="kpi-label">Príjmy</div><div class="kpi-value income">${fmtEUR(totalIncome)}</div></div>
      <div class="kpi-card">
        <div class="kpi-label">Výdavky</div><div class="kpi-value">${fmtEUR(totalExpense)}</div>
        <div class="kpi-delta ${expenseDiff===null?'':(expenseDiff>0?'up':'down')}">${prevExpense>0 ? (expenseDiff>=0?'&#9650;':'&#9660;')+' '+Math.abs(expenseDiff).toFixed(0)+'% oproti min. mes.' : '—'}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-balance">
          <div><div class="kpi-label">Bilancia</div><div class="kpi-value ${balance>=0?'income':'alert'}">${balance>=0?'+':''}${fmtEUR(balance)}</div></div>
          <div class="scale-wrap">${balanceScaleSVG(totalIncome, totalExpense)}</div>
        </div>
      </div>
      <div class="kpi-card"><div class="kpi-label">Priemer výdavkov / deň</div><div class="kpi-value" style="font-size:21px">${fmtEUR(avgPerDay)}</div></div>
    </div>

    <div class="budget-card">
      <div class="budget-head">
        <span class="budget-title">Mesačný rozpočet výdavkov</span>
        <button class="budget-edit-link" id="editMonthlyBudget">${mb ? 'upraviť' : '+ nastaviť limit'}</button>
      </div>
      ${editingMonthlyBudget ? `
        <div class="budget-set-form">
          <input type="number" id="mbInput" min="0" step="1" placeholder="napr. 1200" value="${mb||''}">
          <button id="mbSave">Uložiť</button>
          ${mb ? `<button id="mbClear" style="background:none;border:1px solid var(--border);color:var(--ink-dim)">Zrušiť</button>` : ''}
        </div>
      ` : (mb ? `
        <div class="budget-track"><div class="budget-fill" style="width:${mbPct}%; background:${mbColor}"></div></div>
        <div class="budget-text"><b>${fmtEUR(totalExpense)}</b> z ${fmtEUR(mb)} &nbsp;&middot;&nbsp; ${mbOver ? `prekročené o ${fmtEUR(totalExpense-mb)}` : `zostáva ${fmtEUR(mb-totalExpense)}`}</div>
      ` : `<div class="budget-text">Limit nie je nastavený.</div>`)}
    </div>

    <div class="charts-row">
      <div class="chart-card">
        <h3>Výdavky podľa kategórií</h3>
        <div class="donut-body">
          <div class="donut-wrap">
            ${donutSVG(catRows, totalExpense)}
            <div class="donut-center"><div class="donut-amount">${fmtEUR(totalExpense)}</div><div class="donut-label">spolu</div></div>
          </div>
          <div class="legend">
            ${catRows.filter(c=>c.amount>0).slice(0,6).map(c => `
              <div class="legend-row"><span class="legend-dot" style="background:${c.color}"></span><span class="legend-name">${esc(c.name)}</span><span class="legend-pct">${totalExpense>0?Math.round(c.amount/totalExpense*100):0}%</span></div>
            `).join('') || `<div class="legend-empty">žiadne výdavky</div>`}
          </div>
        </div>
      </div>
      <div class="chart-card">
        <div class="trend-head">
          <h3>Príjmy vs. výdavky</h3>
          <div class="trend-toggle"><button data-trend="6" class="${trendRange===6?'active':''}">6M</button><button data-trend="12" class="${trendRange===12?'active':''}">12M</button></div>
        </div>
        <div class="trend-legend"><span><i style="background:var(--income)"></i>Príjmy</span><span><i style="background:var(--plum-dim)"></i>Výdavky</span></div>
        ${divergingTrendHTML()}
      </div>
    </div>

    <div class="members-card">
      <span class="members-card-label">Podľa osôb</span>
      ${(settings.members||[]).map(m => `<div class="member-chip"><span class="b" style="background:${m.color}">${initials(m.name)}</span>${esc(m.name)}: <b>${fmtEUR(byMember[m.id]||0)}</b></div>`).join('')}
    </div>

    <div class="section-head"><h2>Pravidelné platby a príjmy</h2><div class="rule"></div></div>
    <div class="subsection-label">Výdavky</div>
    <div class="recur-grid">
      ${expenseBills.map((b,i) => renderRecurCard(b, i, isCurrentMonth, now)).join('')}
      <div class="add-recur-card" data-add-recur="expense">${icon('plus',13)} pridať pravidelný výdavok</div>
    </div>
    <div class="subsection-label">Príjem</div>
    <div class="recur-grid">
      ${incomeBills.map((b,i) => renderRecurCard(b, i, isCurrentMonth, now)).join('')}
      <div class="add-recur-card" data-add-recur="income">${icon('plus',13)} pridať pravidelný príjem</div>
    </div>
    <div class="recur-form ${recurFormOpen?'open':''}" id="recurForm">
      <div class="field"><label>Názov</label><input type="text" id="rName" placeholder="${recurFormOpen==='income'?'napr. Výplata':'napr. Internet'}"></div>
      <div class="field"><label>Kategória</label><select id="rCat">${allCategoriesForType(recurFormOpen||'expense').map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Suma (€)</label><input type="number" id="rAmount" step="0.01" min="0" placeholder="0.00"></div>
      <div class="field"><label>Deň v mesiaci</label><input type="number" id="rDay" min="1" max="28" placeholder="15"></div>
      <button class="add-btn ${recurFormOpen==='income'?'income':''}" id="rAddBtn">Uložiť</button>
    </div>

    <div class="section-head">
      <h2>Kategórie výdavkov</h2><div class="rule"></div>
      ${activeFilter ? `<button class="hint" id="clearFilter">zrušiť filter</button>` : ''}
      <button class="hint" id="toggleAddCat">${icon('plus',11)} ${addCatOpen ? 'zavrieť' : 'kategória'}</button>
    </div>
    ${addCatOpen ? `<div class="add-cat-row"><input type="text" id="newCatName" placeholder="Názov novej kategórie" maxlength="24"><button id="saveCatBtn">Pridať</button></div>` : ''}
    <div class="cat-list">
      ${catRows.length ? catRows.map((c,i) => renderCatRow(c, i, maxCat)).join('') : `<div class="cat-empty">V tomto mesiaci zatiaľ nie sú žiadne výdavky.</div>`}
    </div>

    <div class="section-head"><h2>Nový záznam</h2><div class="rule"></div></div>
    <div class="type-toggle">
      <button class="expense ${formType==='expense'?'active':''}" data-formtype="expense">Výdavok</button>
      <button class="income ${formType==='income'?'active':''}" data-formtype="income">Príjem</button>
    </div>
    <div class="form-card">
      <div class="form-grid">
        <div class="field"><label>Dátum</label><input type="date" id="fDate" value="${todayISO()}"></div>
        <div class="field"><label>Kategória</label><select id="fCat">${allCategoriesForType(formType).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Popis</label><input type="text" id="fDesc" placeholder="${formType==='income'?'napr. výplata august':'napr. nájom za august'}"></div>
        <div class="field"><label>Suma (€)</label><input type="number" id="fAmount" step="0.01" min="0" placeholder="0.00"></div>
        <div class="field"><label>${formType==='income'?'Prijal(a)':'Platil(a)'}</label><select id="fPayer">${(settings.members||[]).map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></div>
        <button class="add-btn ${formType==='income'?'income':''}" id="addBtn">Pridať</button>
      </div>
    </div>

    <div class="section-head"><h2>Transakcie</h2><div class="rule"></div></div>
    <div class="tx-toolbar">
      <div class="search-input-wrap">${icon('search',14)}<input type="text" class="search-input" id="searchInput" placeholder="Hľadať v popise alebo kategórii&hellip;" value="${esc(searchQuery)}"></div>
      <button class="export-btn" id="exportBtn">${icon('download',13)} export CSV</button>
    </div>
    <div id="txList">
      ${Object.keys(grouped).length ? Object.keys(grouped).sort().reverse().map(date => renderDayGroup(date, grouped[date])).join('') : `<div class="empty-state"><div class="big">${searchQuery || activeFilter ? 'Nič nenájdené.' : 'Zatiaľ žiadne záznamy.'}</div><div>${searchQuery || activeFilter ? 'Skús zmeniť hľadaný výraz alebo filter.' : 'Pridaj prvý záznam vyššie a začni sledovať rozpočet tohto mesiaca.'}</div></div>`}
    </div>

    <div class="footnote">Dáta sa ukladajú do <a href="https://github.com/${ghConfig.owner}/${ghConfig.repo}" target="_blank" rel="noopener">${esc(ghConfig.owner)}/${esc(ghConfig.repo)}</a> — vidí a upravuje ich ktokoľvek s prístupom k repozitáru.</div>
  `;

  renderSyncStatus();
  bindAppEvents(filtered);
}

function renderRecurCard(b, i, isCurrentMonth, now){
  const c = catInfo(b.category, b.type);
  const isIncome = b.type === 'income';
  const paidExpense = transactions.find(t => t.recurringId === b.id && t.date.startsWith(currentMonth));
  const paid = !!paidExpense;
  const overdue = !paid && isCurrentMonth && now.getDate() > b.dueDay;
  let badgeClass = 'wait', badgeText = 'Čaká sa';
  if (paid){ badgeClass='ok'; badgeText = isIncome ? 'Prijaté' : 'Zaplatené'; } else if (overdue){ badgeClass='late'; badgeText='Po termíne'; }
  if (editingRecurId === b.id){
    return `<div class="recur-card" style="animation-delay:${0.05*i}s">
      <div class="recur-name" style="margin-bottom:8px;"><span class="cat-dot" style="background:${c.color}"></span>${esc(b.name)}</div>
      <div class="recur-edit-form">
        <input type="text" id="erName" value="${esc(b.name)}" placeholder="Názov">
        <select id="erCat">${allCategoriesForType(b.type).map(cc=>`<option value="${cc.id}" ${cc.id===b.category?'selected':''}>${esc(cc.name)}</option>`).join('')}</select>
        <input type="number" id="erAmount" value="${b.amount}" step="0.01" placeholder="Suma">
        <input type="number" id="erDay" value="${b.dueDay}" min="1" max="28" placeholder="Deň">
        <div class="btns"><button class="save" data-save-recur="${b.id}">Uložiť</button><button class="cancel" data-cancel-recur>Zrušiť</button></div>
      </div>
    </div>`;
  }
  return `<div class="recur-card ${paid?'paid':''} ${overdue?'overdue':''}" style="animation-delay:${0.05*i}s">
    <div class="recur-top">
      <div class="recur-name"><span class="cat-dot" style="background:${c.color}"></span>${esc(b.name)}</div>
      <div class="recur-actions"><button data-edit-recur="${b.id}" title="Upraviť">${icon('edit',13)}</button><button class="del" data-recur-del="${b.id}" title="Odstrániť">${icon('trash',13)}</button></div>
    </div>
    <div class="recur-amount ${isIncome?'income':''}">${isIncome?'+':''}${fmtEUR(b.amount)}</div>
    <div class="recur-due">${isIncome?'príjem':'splatnosť'} ${b.dueDay}. dňa v mesiaci</div>
    <div class="recur-status">
      <span class="recur-badge ${badgeClass}"><span class="d"></span>${badgeText}</span>
      ${paid ? `<button class="recur-btn undo" data-unmark="${b.id}">vrátiť späť</button>` : `<button class="recur-btn" data-mark="${b.id}">${isIncome?'Označiť ako prijaté':'Označiť ako zaplatené'}</button>`}
    </div>
  </div>`;
}

function renderCatRow(c, i, maxCat){
  const overBudget = c.budget && c.amount > c.budget;
  const fillColor = overBudget ? 'var(--alert)' : c.color;
  const markerPct = c.budget ? Math.min(100, (c.budget/maxCat*100)) : null;
  return `
  <div class="cat-row ${activeFilter===c.id?'active':''}" style="animation-delay:${0.03*i}s">
    <div class="cat-main" data-cat="${c.id}">
      <div class="cat-name"><span class="cat-dot" style="background:${c.color}"></span>${esc(c.name)}</div>
      <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${(c.amount/maxCat*100).toFixed(1)}%; background:${fillColor}"></div>${markerPct!==null ? `<div class="cat-bar-marker" style="left:${markerPct}%"></div>` : ''}</div>
      <div class="cat-amount">${overBudget ? `<span class="over">${fmtEUR(c.amount)}</span>` : fmtEUR(c.amount)}${c.budget ? `<span class="sub">${overBudget?'prekroč. ':'z '} ${fmtEUR(c.budget)}</span>` : ''}</div>
    </div>
    <button class="cat-budget-pencil" data-editbudget="${c.id}" title="Nastaviť rozpočet kategórie">${icon('edit',13)}</button>
    ${editingBudgetCat === c.id ? `
      <div class="cat-budget-input-row">
        <input type="number" id="catBudgetInput" min="0" step="1" placeholder="limit €" value="${c.budget||''}">
        <button data-savebudget="${c.id}">Uložiť</button>
        ${c.budget ? `<button data-clearbudget="${c.id}" class="cancel">zrušiť limit</button>` : ''}
        <button data-cancelbudget class="cancel">zavrieť</button>
        ${c.isCustom ? `<button data-delcat="${c.id}" class="cancel" style="color:var(--alert)">odstrániť kategóriu</button>` : ''}
      </div>` : ''}
  </div>`;
}

function renderDayGroup(date, items){
  const d = new Date(date + 'T00:00:00');
  const label = DAYS_SK[d.getDay()] + ', ' + d.getDate() + '. ' + MONTHS_SK[d.getMonth()].toLowerCase() + ' ' + d.getFullYear();
  return `<div class="day-group">
    <div class="day-header">${label}</div>
    ${items.map(t => renderTxRow(t)).join('')}
  </div>`;
}

function renderTxRow(t){
  const c = catInfo(t.category, t.type);
  const p = memberInfo(t.paidBy);
  const isIncome = t.type === 'income';
  if (editingId === t.id){
    return `<div class="tx-edit-form">
      <select id="eType_${t.id}" data-etype="${t.id}">
        <option value="expense" ${t.type==='expense'?'selected':''}>Výdavok</option>
        <option value="income" ${t.type==='income'?'selected':''}>Príjem</option>
      </select>
      <input type="date" id="eDate_${t.id}" value="${t.date}">
      <select id="eCat_${t.id}">${allCategoriesForType(t.type).map(cc=>`<option value="${cc.id}" ${cc.id===t.category?'selected':''}>${esc(cc.name)}</option>`).join('')}</select>
      <input type="text" id="eDesc_${t.id}" value="${esc(t.description)}">
      <input type="number" step="0.01" min="0" id="eAmt_${t.id}" value="${t.amount}">
      <select id="ePayer_${t.id}">${(settings.members||[]).map(m=>`<option value="${m.id}" ${m.id===t.paidBy?'selected':''}>${esc(m.name)}</option>`).join('')}</select>
      <button class="save" data-save-edit="${t.id}">Uložiť</button>
      <button class="cancel" data-cancel-edit>Zrušiť</button>
    </div>`;
  }
  return `<div class="tx-row">
    <div class="tx-payer" style="background:${p.color}" title="${esc(p.name)}">${initials(p.name)}</div>
    <div class="tx-dir ${isIncome?'income':''}" title="${isIncome?'Príjem':'Výdavok'}">${icon(isIncome?'arrowUp':'arrowDown',14)}</div>
    <div class="tx-desc">${esc(t.description)}${t.recurringId ? ' <span style="color:var(--ink-faint); font-size:11px;">(pravidelné)</span>' : ''}</div>
    <div class="tx-cat">${esc(c.name)}</div>
    <div class="tx-amount ${isIncome?'income':''}">${isIncome?'+':'−'}${fmtEUR(t.amount)}</div>
    <button class="tx-edit" data-edit="${t.id}" title="Upraviť">${icon('edit',13)}</button>
    <button class="tx-del" data-id="${t.id}" title="Odstrániť">${icon('trash',13)}</button>
  </div>`;
}

function renderSettingsPanel(){
  return `<div class="settings-panel">
    <div class="settings-grid">
      <div class="settings-col">
        <h3>GitHub pripojenie</h3>
        <div class="settings-row"><span class="settings-label">Repozitár</span><span class="settings-val"><a href="https://github.com/${ghConfig.owner}/${ghConfig.repo}" target="_blank" rel="noopener" style="color:var(--plum)">${esc(ghConfig.owner)}/${esc(ghConfig.repo)}</a></span></div>
        <div class="settings-row"><span class="settings-label">Súbor</span><span class="settings-val">${esc(ghConfig.path)}</span></div>
        <div class="settings-row"><span class="settings-label">Posledná synchronizácia</span><span class="settings-val">${lastSynced ? lastSynced.toLocaleString('sk-SK') : '—'}</span></div>
        <button class="sync-now-btn" id="settingsSyncBtn">${icon('refresh',13)} Synchronizovať teraz</button>
        <div style="margin-top:14px;"><button class="danger-link" id="disconnectBtn">Odpojiť repozitár</button></div>
      </div>
      <div class="settings-col">
        <h3>Členovia domácnosti</h3>
        ${(settings.members||[]).map(m => `
          <div class="member-row">
            <span class="member-badge" style="background:${m.color}">${initials(m.name)}</span>
            <input type="text" value="${esc(m.name)}" data-member-name="${m.id}">
            <button class="member-del" data-member-del="${m.id}" title="Odstrániť">${icon('close',13)}</button>
          </div>
        `).join('')}
        ${addMemberOpen ? `
          <div class="add-member-row"><input type="text" id="newMemberName" placeholder="Meno člena"><button id="saveMemberBtn">Pridať</button></div>
        ` : `<div class="add-member-row"><button id="toggleAddMember" style="width:100%">${icon('plus',12)} pridať člena</button></div>`}
      </div>
    </div>
  </div>`;
}

/* ============ EVENT BINDING ============ */
function bindAppEvents(filtered){
  document.getElementById('prevM').onclick = () => shiftMonth(-1);
  document.getElementById('nextM').onclick = () => shiftMonth(1);
  document.getElementById('syncBtn').onclick = () => manualSync();
  document.getElementById('settingsBtn').onclick = () => { settingsOpen = !settingsOpen; render(); };

  if (settingsOpen){
    const syncBtn2 = document.getElementById('settingsSyncBtn');
    if (syncBtn2) syncBtn2.onclick = () => manualSync();
    const discBtn = document.getElementById('disconnectBtn');
    if (discBtn) discBtn.onclick = () => disconnect();
    document.querySelectorAll('[data-member-name]').forEach(inp => {
      inp.onblur = () => { const v = inp.value.trim(); if (v) renameMember(inp.getAttribute('data-member-name'), v); render(); };
      inp.onkeydown = (ev) => { if (ev.key==='Enter') inp.blur(); };
    });
    document.querySelectorAll('[data-member-del]').forEach(btn => { btn.onclick = () => deleteMember(btn.getAttribute('data-member-del')); });
    const toggleAddMember = document.getElementById('toggleAddMember');
    if (toggleAddMember) toggleAddMember.onclick = () => { addMemberOpen = true; render(); };
    const saveMemberBtn = document.getElementById('saveMemberBtn');
    if (saveMemberBtn) saveMemberBtn.onclick = () => {
      const name = document.getElementById('newMemberName').value.trim();
      if (!name){ alert('Zadaj meno.'); return; }
      addMember(name);
    };
  }

  document.querySelectorAll('.cat-main').forEach(row => {
    row.onclick = () => { const cat = row.getAttribute('data-cat'); activeFilter = (activeFilter === cat) ? null : cat; editingBudgetCat=null; render(); };
  });
  const clearBtn = document.getElementById('clearFilter');
  if (clearBtn) clearBtn.onclick = () => { activeFilter = null; render(); };

  document.querySelectorAll('[data-trend]').forEach(btn => { btn.onclick = () => { trendRange = parseInt(btn.getAttribute('data-trend'),10); render(); }; });

  document.querySelectorAll('[data-formtype]').forEach(btn => {
    btn.onclick = () => { formType = btn.getAttribute('data-formtype'); render(); };
  });

  document.getElementById('addBtn').onclick = () => {
    const date = document.getElementById('fDate').value;
    const category = document.getElementById('fCat').value;
    const description = document.getElementById('fDesc').value.trim();
    const amount = parseFloat(document.getElementById('fAmount').value);
    const paidBy = document.getElementById('fPayer').value;
    if (!date || !amount || amount <= 0){ alert('Zadaj prosím platný dátum a sumu väčšiu ako 0.'); return; }
    addTransaction({ type: formType, date, category, description, amount, paidBy });
  };

  document.querySelectorAll('.tx-del').forEach(btn => { btn.onclick = () => deleteTransaction(btn.getAttribute('data-id')); });
  document.querySelectorAll('[data-edit]').forEach(btn => { btn.onclick = () => { editingId = btn.getAttribute('data-edit'); render(); }; });
  document.querySelectorAll('[data-cancel-edit]').forEach(btn => { btn.onclick = () => { editingId = null; render(); }; });
  document.querySelectorAll('[data-etype]').forEach(sel => {
    sel.onchange = () => {
      const id = sel.getAttribute('data-etype');
      const t = transactions.find(x=>x.id===id);
      if (t){ t.type = sel.value; render(); editingId = id; }
    };
  });
  document.querySelectorAll('[data-save-edit]').forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-save-edit');
      const type = document.getElementById('eType_'+id).value;
      const date = document.getElementById('eDate_'+id).value;
      const category = document.getElementById('eCat_'+id).value;
      const description = document.getElementById('eDesc_'+id).value.trim();
      const amount = parseFloat(document.getElementById('eAmt_'+id).value);
      const paidBy = document.getElementById('ePayer_'+id).value;
      if (!date || !amount || amount <= 0){ alert('Zadaj prosím platný dátum a sumu väčšiu ako 0.'); return; }
      const t = transactions.find(x=>x.id===id); if (t) t.type = type;
      updateTransaction(id, { date, category, description, amount, paidBy });
    };
  });

  document.querySelectorAll('[data-mark]').forEach(btn => { btn.onclick = () => markRecurringPaid(recurringBills.find(b => b.id === btn.getAttribute('data-mark'))); });
  document.querySelectorAll('[data-unmark]').forEach(btn => { btn.onclick = () => unmarkRecurringPaid(recurringBills.find(b => b.id === btn.getAttribute('data-unmark'))); });
  document.querySelectorAll('[data-recur-del]').forEach(btn => { btn.onclick = () => deleteRecurringBill(btn.getAttribute('data-recur-del')); });
  document.querySelectorAll('[data-edit-recur]').forEach(btn => { btn.onclick = () => { editingRecurId = btn.getAttribute('data-edit-recur'); render(); }; });
  document.querySelectorAll('[data-cancel-recur]').forEach(btn => { btn.onclick = () => { editingRecurId = null; render(); }; });
  document.querySelectorAll('[data-save-recur]').forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-save-recur');
      const name = document.getElementById('erName').value.trim();
      const category = document.getElementById('erCat').value;
      const amount = parseFloat(document.getElementById('erAmount').value);
      const dueDay = parseInt(document.getElementById('erDay').value, 10);
      if (!name || !amount || amount<=0 || !dueDay || dueDay<1 || dueDay>28){ alert('Skontroluj údaje.'); return; }
      updateRecurringBill(id, { name, category, amount, dueDay });
    };
  });
  document.querySelectorAll('[data-add-recur]').forEach(btn => {
    btn.onclick = () => { recurFormOpen = btn.getAttribute('data-add-recur'); render(); document.getElementById('recurForm').scrollIntoView({behavior:'smooth', block:'center'}); };
  });
  const rAddBtn = document.getElementById('rAddBtn');
  if (rAddBtn){
    rAddBtn.onclick = () => {
      const name = document.getElementById('rName').value.trim();
      const category = document.getElementById('rCat').value;
      const amount = parseFloat(document.getElementById('rAmount').value);
      const dueDay = parseInt(document.getElementById('rDay').value, 10);
      if (!name || !amount || amount <= 0 || !dueDay || dueDay < 1 || dueDay > 28){ alert('Vyplň prosím názov, sumu a deň v mesiaci (1–28).'); return; }
      addRecurringBill({ name, category, amount, dueDay, type: recurFormOpen });
    };
  }

  document.getElementById('toggleAddCat').onclick = () => { addCatOpen = !addCatOpen; render(); };
  const saveCatBtn = document.getElementById('saveCatBtn');
  if (saveCatBtn){
    saveCatBtn.onclick = () => {
      const name = document.getElementById('newCatName').value.trim();
      if (!name){ alert('Zadaj názov kategórie.'); return; }
      addCustomCategory(name);
    };
  }

  document.querySelectorAll('[data-editbudget]').forEach(btn => { btn.onclick = (ev) => { ev.stopPropagation(); editingBudgetCat = btn.getAttribute('data-editbudget'); render(); }; });
  const cancelBudgetBtn = document.querySelector('[data-cancelbudget]');
  if (cancelBudgetBtn) cancelBudgetBtn.onclick = () => { editingBudgetCat = null; render(); };
  document.querySelectorAll('[data-savebudget]').forEach(btn => {
    btn.onclick = () => { const v = parseFloat(document.getElementById('catBudgetInput').value); if (!v || v<=0){ alert('Zadaj platnú sumu.'); return; } setCategoryBudget(btn.getAttribute('data-savebudget'), v); };
  });
  document.querySelectorAll('[data-clearbudget]').forEach(btn => { btn.onclick = () => setCategoryBudget(btn.getAttribute('data-clearbudget'), null); });
  document.querySelectorAll('[data-delcat]').forEach(btn => { btn.onclick = () => deleteCustomCategory(btn.getAttribute('data-delcat')); });

  document.getElementById('editMonthlyBudget').onclick = () => { editingMonthlyBudget = !editingMonthlyBudget; render(); };
  const mbSave = document.getElementById('mbSave');
  if (mbSave){ mbSave.onclick = () => { const v = parseFloat(document.getElementById('mbInput').value); if(!v||v<=0){ alert('Zadaj platnú sumu.'); return;} setMonthlyBudget(v); }; }
  const mbClear = document.getElementById('mbClear');
  if (mbClear){ mbClear.onclick = () => setMonthlyBudget(null); }

  const searchInput = document.getElementById('searchInput');
  searchInput.oninput = () => {
    searchQuery = searchInput.value;
    const pos = searchInput.selectionStart;
    render();
    const el = document.getElementById('searchInput');
    if (el){ el.focus(); el.selectionStart = el.selectionEnd = pos; }
  };
  document.getElementById('exportBtn').onclick = () => exportCSV(filtered);
}

/* ============ INIT ============ */
(function init(){
  try{
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) ghConfig = JSON.parse(raw);
  }catch(e){ ghConfig = null; }
  render();
  if (ghConfig) connectAndLoad();
})();
