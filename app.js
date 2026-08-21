/* ============ CONFIG & CONSTANTS ============ */
const CONFIG_KEY = 'gh-budget-config-v1';
const PALETTE = ['#CC8A5C','#96AF8C','#D8B96A','#7FA5C4','#C6634E','#B98CC7','#6FAEA0','#A98F6B','#8C8C8C','#5C8AA6','#B6784F','#7FA5C4'];
const MEMBER_PALETTE = ['#CC8A5C','#7FA5C4','#96AF8C','#D8B96A','#B98CC7'];

const BASE_CATEGORIES = [
  { id:'byvanie',   name:'Bývanie',        color:'#CC8A5C' },
  { id:'potraviny', name:'Potraviny',      color:'#96AF8C' },
  { id:'doprava',   name:'Doprava',        color:'#D8B96A' },
  { id:'poistenie', name:'Poistenie',      color:'#7FA5C4' },
  { id:'zdravie',   name:'Zdravie',        color:'#C6634E' },
  { id:'deti',      name:'Deti a škola',   color:'#B98CC7' },
  { id:'zabava',    name:'Zábava',         color:'#6FAEA0' },
  { id:'domacnost', name:'Domácnosť',      color:'#A98F6B' },
  { id:'ostatne',   name:'Ostatné',        color:'#8C8C8C' },
];
const DEFAULT_RECURRING = [
  { id:'rec-ele',  name:'Elektrina', category:'byvanie', amount:65, dueDay:15 },
  { id:'rec-voda', name:'Voda',      category:'byvanie', amount:22, dueDay:18 },
  { id:'rec-plyn', name:'Plyn',      category:'byvanie', amount:38, dueDay:20 },
];
const DEFAULT_MEMBERS = [
  { id:'m1', name:'Ja', color:'#CC8A5C' },
  { id:'m2', name:'Partner/ka', color:'#7FA5C4' },
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
  link: '<path d="M6.3 9.7 9.7 6.3M6.8 4.3l1-1a2.6 2.6 0 0 1 3.7 3.7l-1 1M9.2 11.7l-1 1a2.6 2.6 0 0 1-3.7-3.7l1-1"/>',
  logo: '<path d="M8 2v12M4.5 4.5h6.5a2 2 0 0 1 0 4H5a2 2 0 0 0 0 4h6.5" stroke-width="1.6"/>',
};
function icon(name, size){
  size = size || 15;
  return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]||''}</svg>`;
}

/* ============ STATE ============ */
let ghConfig = null;
let sha = null;
let expenses = [], recurringBills = [], customCategories = [], settings = { monthlyBudget:null, categoryBudgets:{}, members: DEFAULT_MEMBERS.slice() };
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
let toastState = null; // {message, actionLabel, action}
let toastTimer = null;

/* ============ HELPERS ============ */
function allCategories(){ return BASE_CATEGORIES.concat(customCategories); }
function catInfo(id){ return allCategories().find(c => c.id === id) || BASE_CATEGORIES[BASE_CATEGORIES.length-1]; }
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

async function loadDataFile(){
  const res = await fetch(apiUrl(), { headers: ghHeaders() });
  if (res.status === 404){
    const defaults = { expenses:[], recurringBills: DEFAULT_RECURRING.slice(), customCategories:[], settings:{ monthlyBudget:null, categoryBudgets:{}, members: DEFAULT_MEMBERS.slice() } };
    await createDataFile(defaults);
    expenses = defaults.expenses; recurringBills = defaults.recurringBills; customCategories = defaults.customCategories; settings = defaults.settings;
    return;
  }
  if (res.status === 401) throw new Error('Token je neplatný alebo expirovaný.');
  if (res.status === 403) throw new Error('Token nemá prístup k tomuto súboru.');
  if (!res.ok) throw new Error(`Nepodarilo sa načítať dáta (${res.status}).`);
  const json = await res.json();
  sha = json.sha;
  const parsed = JSON.parse(decodeB64Utf8(json.content));
  expenses = parsed.expenses || [];
  recurringBills = parsed.recurringBills || DEFAULT_RECURRING.slice();
  customCategories = parsed.customCategories || [];
  settings = parsed.settings || { monthlyBudget:null, categoryBudgets:{}, members: DEFAULT_MEMBERS.slice() };
  if (!settings.members || !settings.members.length) settings.members = DEFAULT_MEMBERS.slice();
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
    const payload = JSON.stringify({ expenses, recurringBills, customCategories, settings });
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
  expenses = []; recurringBills = []; customCategories = []; settings = { monthlyBudget:null, categoryBudgets:{}, members: DEFAULT_MEMBERS.slice() };
  settingsOpen = false;
  render();
}

/* ============ MUTATIONS ============ */
function addExpense(data){
  expenses.push({ id:'e'+Date.now()+Math.random().toString(36).slice(2,7), date:data.date, category:data.category, description:data.description || catInfo(data.category).name, amount:data.amount, paidBy:data.paidBy || (settings.members[0]||{}).id, recurringId:data.recurringId || null });
  scheduleSave(); render();
}
function updateExpense(id, data){
  const e = expenses.find(x => x.id === id);
  if (!e) return;
  e.date=data.date; e.category=data.category; e.description=data.description || catInfo(data.category).name; e.amount=data.amount; e.paidBy=data.paidBy;
  editingId = null; scheduleSave(); render();
}
function deleteExpense(id){
  const idx = expenses.findIndex(e => e.id === id);
  if (idx === -1) return;
  const [removed] = expenses.splice(idx, 1);
  scheduleSave(); render();
  showToast('Záznam odstránený.', 'Vrátiť späť', () => { expenses.splice(idx, 0, removed); scheduleSave(); render(); });
}

function markRecurringPaid(bill){
  const dim = daysInMonth(currentMonth);
  const day = Math.min(bill.dueDay, dim);
  addExpense({ date:`${currentMonth}-${pad2(day)}`, category:bill.category, description:bill.name, amount:bill.amount, paidBy:(settings.members[0]||{}).id, recurringId:bill.id });
}
function unmarkRecurringPaid(bill){
  const match = expenses.find(e => e.recurringId===bill.id && e.date.startsWith(currentMonth));
  if (match) deleteExpense(match.id);
}
function addRecurringBill(data){
  recurringBills.push({ id:'rec'+Date.now()+Math.random().toString(36).slice(2,5), name:data.name, category:data.category, amount:data.amount, dueDay:data.dueDay });
  recurFormOpen = false; scheduleSave(); render();
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
  showToast('Pravidelná platba odstránená.', 'Vrátiť späť', () => { recurringBills.splice(idx,0,removed); scheduleSave(); render(); });
}

function addCustomCategory(name){
  const id = 'cc' + Date.now().toString(36);
  const color = PALETTE[(BASE_CATEGORIES.length + customCategories.length) % PALETTE.length];
  customCategories.push({ id, name, color });
  addCatOpen = false; scheduleSave(); render();
}
function deleteCustomCategory(id){
  const used = expenses.some(e=>e.category===id) || recurringBills.some(b=>b.category===id);
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
  const used = expenses.some(e=>e.paidBy===id);
  if (used){ showToast('Tohto člena nemožno odstrániť — má priradené platby.', null, null); return; }
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
  const header = 'Dátum;Kategória;Popis;Suma (EUR);Platil(a)';
  const lines = rows.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(e => `${e.date};${catInfo(e.category).name};"${(e.description||'').replace(/"/g,'""')}";${e.amount.toFixed(2)};${memberInfo(e.paidBy).name}`);
  const csv = '\uFEFF' + [header, ...lines].join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `rozpocet-${currentMonth}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ============ VISUALS ============ */
function donutSVG(catRows, total){
  const r = 62, cx = 90, cy = 90, sw = 22, circ = 2*Math.PI*r;
  let offset = 0;
  const segs = catRows.filter(c=>c.amount>0).map(c => {
    const frac = c.amount/total;
    const len = frac*circ;
    const dash = `${len} ${circ-len}`;
    const rot = (offset/circ)*360 - 90;
    offset += len;
    return `<circle class="donut-seg" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c.color}" stroke-width="${sw}" stroke-dasharray="${dash}" transform="rotate(${rot} ${cx} ${cy})" stroke-linecap="butt"/>`;
  }).join('');
  const track = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="${sw}"/>`;
  return `<svg viewBox="0 0 180 180" width="180" height="180">${track}${segs || ''}</svg>`;
}
function trendChartHTML(){
  const months = lastNMonths(currentMonth, trendRange);
  const totals = months.map(ym => expenses.filter(e=>e.date.startsWith(ym)).reduce((s,e)=>s+e.amount,0));
  const max = Math.max(1, ...totals);
  return `<div class="trend-wrap">${months.map((ym,i) => {
    const [,m] = ym.split('-').map(Number);
    const h = Math.max(4, (totals[i]/max*100));
    const isCur = ym === currentMonth;
    return `<div class="trend-col ${isCur?'iscur':''}">
      <div class="trend-val">${totals[i] > 0 ? Math.round(totals[i]) : ''}</div>
      <div class="trend-bar ${isCur?'current':'other'}" style="height:${h}%; animation-delay:${i*0.05}s"></div>
      <div class="trend-label">${MONTHS_SHORT_SK[m-1]}</div>
    </div>`;
  }).join('')}</div>`;
}

/* ============ RENDER: TOAST & SYNC STATUS (lightweight, no full re-render) ============ */
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
      <div class="eyebrow" style="justify-content:center;">${icon('logo',13)} Domáci rozpočet</div>
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
          <input type="text" id="cfgRepo" placeholder="napr. domaci-rozpocet" value="${esc(cfg.repo||'')}">
        </div>
        <div class="setup-field">
          <label>Cesta k dátovému súboru</label>
          <input type="text" id="cfgPath" placeholder="budget-data.json" value="${esc(cfg.path||'budget-data.json')}">
          <div class="hint">Tento súbor appka sama vytvorí, ak ešte neexistuje.</div>
        </div>
        <div class="setup-field">
          <label>Personal Access Token</label>
          <input type="password" id="cfgToken" placeholder="github_pat_..." value="">
          <div class="hint">Vytvor si <b>fine-grained token</b> na
            <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com/settings/personal-access-tokens/new</a>,
            obmedzený len na tento jeden repozitár, s právom <b>Contents: Read and write</b>. Token sa uloží len v tomto prehliadači.</div>
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

function renderApp(){
  const monthExpenses = expenses.filter(e => e.date.startsWith(currentMonth));
  let filtered = activeFilter ? monthExpenses.filter(e => e.category === activeFilter) : monthExpenses;
  if (searchQuery.trim()){
    const q = searchQuery.trim().toLowerCase();
    filtered = filtered.filter(e => (e.description||'').toLowerCase().includes(q) || catInfo(e.category).name.toLowerCase().includes(q));
  }

  const total = monthExpenses.reduce((s,e)=> s + e.amount, 0);
  const prevKey = prevMonthKey(currentMonth);
  const prevTotal = expenses.filter(e=>e.date.startsWith(prevKey)).reduce((s,e)=>s+e.amount,0);
  const diff = prevTotal > 0 ? ((total - prevTotal) / prevTotal * 100) : null;

  const now = new Date();
  const [cy,cm] = currentMonth.split('-').map(Number);
  const isCurrentMonth = (now.getFullYear()===cy && now.getMonth()+1===cm);
  const dayDivisor = isCurrentMonth ? now.getDate() : daysInMonth(currentMonth);
  const avgPerDay = total / dayDivisor;

  const byCat = {};
  monthExpenses.forEach(e => { byCat[e.category] = (byCat[e.category]||0) + e.amount; });
  const catRowsAll = allCategories().map(c => ({ ...c, amount: byCat[c.id] || 0, budget: settings.categoryBudgets[c.id] || null, isCustom: customCategories.some(cc=>cc.id===c.id) }));
  const catRows = catRowsAll.filter(c => c.amount > 0 || c.id === activeFilter).sort((a,b) => b.amount - a.amount);
  const maxCat = Math.max(1, ...catRows.map(c=>Math.max(c.amount, c.budget||0)));
  const topCat = catRows[0];

  const byMember = {};
  monthExpenses.forEach(e => { byMember[e.paidBy] = (byMember[e.paidBy]||0) + e.amount; });

  const mb = settings.monthlyBudget;
  const mbPct = mb ? Math.min(100, (total/mb)*100) : 0;
  const mbOver = mb && total > mb;
  const mbColor = mbOver ? 'var(--alert)' : (mb && total/mb > 0.85 ? 'var(--gold)' : 'var(--sage)');

  const grouped = {};
  filtered.slice().sort((a,b)=> b.date.localeCompare(a.date)).forEach(e => { (grouped[e.date] = grouped[e.date] || []).push(e); });

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="eyebrow">Mesačný výkaz &middot; domácnosť</div>
    <div class="title-row">
      <div class="title-left">
        <div class="logo-mark">${icon('logo',19)}</div>
        <h1>Domáci rozpočet</h1>
      </div>
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

    ${mbOver && isCurrentMonth ? `<div class="alert-banner"><span class="d"></span>Prekročili ste mesačný rozpočet o ${fmtEUR(total-mb)}.</div>` : ''}

    <div class="overview">
      <div class="donut-col">
        <div class="donut-wrap">
          ${donutSVG(catRows, total)}
          <div class="donut-center"><div class="donut-amount">${fmtEUR(total)}</div><div class="donut-label">spolu</div></div>
        </div>
        <div class="legend">
          ${catRows.filter(c=>c.amount>0).slice(0,6).map(c => `
            <div class="legend-row"><span class="legend-dot" style="background:${c.color}"></span><span class="legend-name">${esc(c.name)}</span><span class="legend-pct">${total>0?Math.round(c.amount/total*100):0}%</span></div>
          `).join('') || `<div class="legend-row" style="color:var(--ink-faint); font-style:italic;">žiadne výdavky</div>`}
        </div>
      </div>
      <div class="overview-right">
        <div class="stat-row">
          <div><div class="stat-label">Priemer / deň</div><div class="stat-value" style="font-size:19px">${fmtEUR(avgPerDay)}</div></div>
          <div><div class="stat-label">Oproti minulému mesiacu</div><div class="stat-value" style="font-size:19px; color:${diff===null?'var(--ink-dim)':(diff>0?'var(--alert)':'var(--sage)')}">${prevTotal>0 ? (diff>=0?'&#9650;':'&#9660;')+' '+Math.abs(diff).toFixed(0)+'%' : '—'}</div></div>
          <div><div class="stat-label">Najväčšia kategória</div><div class="stat-value" style="font-size:16px; color:${topCat?topCat.color:'var(--ink-dim)'}">${topCat ? topCat.name : '—'}</div></div>
        </div>
        <div class="members-strip">
          ${(settings.members||[]).map(m => `<div class="member-chip"><span class="b" style="background:${m.color}">${initials(m.name)}</span>${esc(m.name)}: <b>${fmtEUR(byMember[m.id]||0)}</b></div>`).join('')}
        </div>
        <div class="budget-block">
          <div class="budget-head">
            <span class="budget-title">Mesačný rozpočet</span>
            <button class="budget-edit-link" id="editMonthlyBudget">${mb ? 'upraviť' : '+ nastaviť limit'}</button>
          </div>
          ${editingMonthlyBudget ? `
            <div class="budget-set-form">
              <input type="number" id="mbInput" min="0" step="1" placeholder="napr. 1200" value="${mb||''}">
              <button id="mbSave">Uložiť</button>
              ${mb ? `<button id="mbClear" style="background:none;border:1px solid var(--line);color:var(--ink-dim)">Zrušiť</button>` : ''}
            </div>
          ` : (mb ? `
            <div class="budget-track"><div class="budget-fill" style="width:${mbPct}%; background:${mbColor}"></div></div>
            <div class="budget-text"><b>${fmtEUR(total)}</b> z ${fmtEUR(mb)} &nbsp;&middot;&nbsp; ${mbOver ? `prekročené o ${fmtEUR(total-mb)}` : `zostáva ${fmtEUR(mb-total)}`}</div>
          ` : `<div class="budget-text">Limit nie je nastavený.</div>`)}
        </div>
      </div>
    </div>

    <div class="section-head">
      <h2>Vývoj výdavkov</h2><div class="rule"></div>
      <div class="trend-toggle"><button data-trend="6" class="${trendRange===6?'active':''}">6M</button><button data-trend="12" class="${trendRange===12?'active':''}">12M</button></div>
    </div>
    ${trendChartHTML()}

    <div class="section-head"><h2>Pravidelné mesačné platby</h2><div class="rule"></div></div>
    <div class="recur-grid">
      ${recurringBills.map((b,i) => {
        const c = catInfo(b.category);
        const paidExpense = expenses.find(e => e.recurringId === b.id && e.date.startsWith(currentMonth));
        const paid = !!paidExpense;
        const overdue = !paid && isCurrentMonth && now.getDate() > b.dueDay;
        let badgeClass = 'wait', badgeText = 'Čaká sa';
        if (paid){ badgeClass='ok'; badgeText='Zaplatené'; } else if (overdue){ badgeClass='late'; badgeText='Po termíne'; }
        if (editingRecurId === b.id){
          return `<div class="recur-card" style="animation-delay:${0.05*i}s">
            <div class="recur-name" style="margin-bottom:8px;"><span class="cat-dot" style="background:${c.color}"></span>${esc(b.name)}</div>
            <div class="recur-edit-form">
              <input type="text" id="erName" value="${esc(b.name)}" placeholder="Názov">
              <select id="erCat">${allCategories().map(cc=>`<option value="${cc.id}" ${cc.id===b.category?'selected':''}>${esc(cc.name)}</option>`).join('')}</select>
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
          <div class="recur-amount">${fmtEUR(b.amount)}</div>
          <div class="recur-due">splatnosť ${b.dueDay}. dňa v mesiaci</div>
          <div class="recur-status">
            <span class="recur-badge ${badgeClass}"><span class="d"></span>${badgeText}</span>
            ${paid ? `<button class="recur-btn undo" data-unmark="${b.id}">vrátiť späť</button>` : `<button class="recur-btn" data-mark="${b.id}">Označiť ako zaplatené</button>`}
          </div>
        </div>`;
      }).join('')}
      <div class="add-recur-card" id="toggleRecurForm">${icon('plus',13)} pridať pravidelnú platbu</div>
    </div>
    <div class="recur-form ${recurFormOpen?'open':''}" id="recurForm">
      <div class="field"><label>Názov</label><input type="text" id="rName" placeholder="napr. Internet"></div>
      <div class="field"><label>Kategória</label><select id="rCat">${allCategories().map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Suma (€)</label><input type="number" id="rAmount" step="0.01" min="0" placeholder="0.00"></div>
      <div class="field"><label>Deň splatnosti</label><input type="number" id="rDay" min="1" max="28" placeholder="15"></div>
      <button class="add-btn" id="rAddBtn">Uložiť</button>
    </div>

    <div class="section-head">
      <h2>Podľa kategórií</h2><div class="rule"></div>
      ${activeFilter ? `<button class="hint" id="clearFilter">zrušiť filter</button>` : ''}
      <button class="hint" id="toggleAddCat">${icon('plus',11)} ${addCatOpen ? 'zavrieť' : 'kategória'}</button>
    </div>
    ${addCatOpen ? `<div class="add-cat-row"><input type="text" id="newCatName" placeholder="Názov novej kategórie" maxlength="24"><button id="saveCatBtn">Pridať</button></div>` : ''}
    <div class="cat-list">
      ${catRows.length ? catRows.map((c,i) => {
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
      }).join('') : `<div class="cat-empty">V tomto mesiaci zatiaľ nie sú žiadne náklady.</div>`}
    </div>

    <div class="section-head"><h2>Nový záznam</h2><div class="rule"></div></div>
    <div class="form-card">
      <div class="form-grid">
        <div class="field"><label>Dátum</label><input type="date" id="fDate" value="${todayISO()}"></div>
        <div class="field"><label>Kategória</label><select id="fCat">${allCategories().map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Popis</label><input type="text" id="fDesc" placeholder="napr. nájom za august"></div>
        <div class="field"><label>Suma (€)</label><input type="number" id="fAmount" step="0.01" min="0" placeholder="0.00"></div>
        <div class="field"><label>Platil(a)</label><select id="fPayer">${(settings.members||[]).map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></div>
        <button class="add-btn" id="addBtn">Pridať</button>
      </div>
    </div>

    <div class="section-head"><h2>Prehľad platieb</h2><div class="rule"></div></div>
    <div class="tx-toolbar">
      <div class="search-input-wrap">${icon('search',14)}<input type="text" class="search-input" id="searchInput" placeholder="Hľadať v popise alebo kategórii&hellip;" value="${esc(searchQuery)}"></div>
      <button class="export-btn" id="exportBtn">${icon('download',13)} export CSV</button>
    </div>
    <div id="txList">
      ${Object.keys(grouped).length ? Object.keys(grouped).sort().reverse().map(date => {
        const d = new Date(date + 'T00:00:00');
        const label = DAYS_SK[d.getDay()] + ', ' + d.getDate() + '. ' + MONTHS_SK[d.getMonth()].toLowerCase() + ' ' + d.getFullYear();
        return `<div class="day-group">
          <div class="day-header">${label}</div>
          ${grouped[date].map(e => {
            const c = catInfo(e.category);
            const p = memberInfo(e.paidBy);
            if (editingId === e.id){
              return `<div class="tx-edit-form">
                <input type="date" id="eDate_${e.id}" value="${e.date}">
                <select id="eCat_${e.id}">${allCategories().map(cc=>`<option value="${cc.id}" ${cc.id===e.category?'selected':''}>${esc(cc.name)}</option>`).join('')}</select>
                <input type="text" id="eDesc_${e.id}" value="${esc(e.description)}">
                <input type="number" step="0.01" min="0" id="eAmt_${e.id}" value="${e.amount}">
                <select id="ePayer_${e.id}">${(settings.members||[]).map(m=>`<option value="${m.id}" ${m.id===e.paidBy?'selected':''}>${esc(m.name)}</option>`).join('')}</select>
                <button class="save" data-save-edit="${e.id}">Uložiť</button>
                <button class="cancel" data-cancel-edit>Zrušiť</button>
              </div>`;
            }
            return `<div class="tx-row">
              <div class="tx-payer" style="background:${p.color}" title="${esc(p.name)}">${initials(p.name)}</div>
              <div class="tx-dot" style="background:${c.color}"></div>
              <div class="tx-desc">${esc(e.description)}${e.recurringId ? ' <span style="color:var(--ink-faint); font-size:11px;">(pravidelná)</span>' : ''}</div>
              <div class="tx-cat">${esc(c.name)}</div>
              <div class="tx-amount">${fmtEUR(e.amount)}</div>
              <button class="tx-edit" data-edit="${e.id}" title="Upraviť">${icon('edit',13)}</button>
              <button class="tx-del" data-id="${e.id}" title="Odstrániť">${icon('trash',13)}</button>
            </div>`;
          }).join('')}
        </div>`;
      }).join('') : `<div class="empty-state"><div class="big">${searchQuery || activeFilter ? 'Nič nenájdené.' : 'Zatiaľ prázdna stránka v knihe.'}</div><div>${searchQuery || activeFilter ? 'Skús zmeniť hľadaný výraz alebo filter.' : 'Pridaj prvý záznam vyššie a začni sledovať náklady tohto mesiaca.'}</div></div>`}
    </div>

    <div class="footnote">Dáta sa ukladajú do <a href="https://github.com/${ghConfig.owner}/${ghConfig.repo}" target="_blank" rel="noopener">${esc(ghConfig.owner)}/${esc(ghConfig.repo)}</a> — vidí a upravuje ich ktokoľvek s prístupom k repozitáru.</div>
  `;

  renderSyncStatus();
  bindAppEvents(filtered);
}

function renderSettingsPanel(){
  return `<div class="settings-panel">
    <div class="settings-grid">
      <div class="settings-col">
        <h3>GitHub pripojenie</h3>
        <div class="settings-row"><span class="settings-label">Repozitár</span><span class="settings-val"><a href="https://github.com/${ghConfig.owner}/${ghConfig.repo}" target="_blank" rel="noopener" style="color:var(--gold)">${esc(ghConfig.owner)}/${esc(ghConfig.repo)}</a></span></div>
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

  document.getElementById('addBtn').onclick = () => {
    const date = document.getElementById('fDate').value;
    const category = document.getElementById('fCat').value;
    const description = document.getElementById('fDesc').value.trim();
    const amount = parseFloat(document.getElementById('fAmount').value);
    const paidBy = document.getElementById('fPayer').value;
    if (!date || !amount || amount <= 0){ alert('Zadaj prosím platný dátum a sumu väčšiu ako 0.'); return; }
    addExpense({ date, category, description, amount, paidBy });
  };

  document.querySelectorAll('.tx-del').forEach(btn => { btn.onclick = () => deleteExpense(btn.getAttribute('data-id')); });
  document.querySelectorAll('[data-edit]').forEach(btn => { btn.onclick = () => { editingId = btn.getAttribute('data-edit'); render(); }; });
  document.querySelectorAll('[data-cancel-edit]').forEach(btn => { btn.onclick = () => { editingId = null; render(); }; });
  document.querySelectorAll('[data-save-edit]').forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-save-edit');
      const date = document.getElementById('eDate_'+id).value;
      const category = document.getElementById('eCat_'+id).value;
      const description = document.getElementById('eDesc_'+id).value.trim();
      const amount = parseFloat(document.getElementById('eAmt_'+id).value);
      const paidBy = document.getElementById('ePayer_'+id).value;
      if (!date || !amount || amount <= 0){ alert('Zadaj prosím platný dátum a sumu väčšiu ako 0.'); return; }
      updateExpense(id, { date, category, description, amount, paidBy });
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
  document.getElementById('toggleRecurForm').onclick = () => { recurFormOpen = !recurFormOpen; render(); };
  const rAddBtn = document.getElementById('rAddBtn');
  if (rAddBtn){
    rAddBtn.onclick = () => {
      const name = document.getElementById('rName').value.trim();
      const category = document.getElementById('rCat').value;
      const amount = parseFloat(document.getElementById('rAmount').value);
      const dueDay = parseInt(document.getElementById('rDay').value, 10);
      if (!name || !amount || amount <= 0 || !dueDay || dueDay < 1 || dueDay > 28){ alert('Vyplň prosím názov, sumu a deň splatnosti (1–28).'); return; }
      addRecurringBill({ name, category, amount, dueDay });
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
