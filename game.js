/* ====================================================================
   Crew Manager — game.js  (New Game + Saves + Home + modal)
   ==================================================================== */

"use strict";

/* ---- configurable ---- */
const STARTING_BERRIES = 30000000;     // placeholder; tune later with the economy
const MAX_SAVES        = 10;
const PREVIEW_SAVES    = 3;
const CAPTAIN_STATS    = { p:8, d:8, s:8 };  // equal baseline for every captain
const SAVES_KEY   = "cm_saves_v1";
const CURRENT_KEY = "cm_current_v1";

/* ---- safe storage ---- */
const Store = {
  get(k){ try { return JSON.parse(localStorage.getItem(k)); } catch(e){ return null; } },
  set(k,v){ try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch(e){ return false; } }
};

/* ---- helpers ---- */
const AV_COLORS = ["#c0392b","#c9920f","#6c3483","#a93226","#0f766e","#2c2c2a",
                   "#be185d","#1565c0","#db2777","#d35400","#166534","#0e7490",
                   "#9d174d","#7c3aed","#b45309"];
function hash(str){ let h=0; for(let i=0;i<str.length;i++){ h=(h*31 + str.charCodeAt(i))|0; } return Math.abs(h); }
function colorFor(name){ return AV_COLORS[ hash(name) % AV_COLORS.length ]; }
function initial(name){ const m = name.match(/[a-z0-9]/i); return (m ? m[0] : "?").toUpperCase(); }
function fmtBerries(n){ return n.toLocaleString("en-US") + " Berries"; }
function fmtShort(n){ return Math.round(n / 1e6) + "M"; }
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => (
    {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]
  ));
}

/* start bounty: stat sum (3..30) -> 10M..30M, whole millions */
function baseBounty(stats){
  const sum = (stats.p||0) + (stats.d||0) + (stats.s||0);
  const t = Math.max(0, Math.min(1, (sum - 9) / 21));
  return Math.round(10 + t * 20) * 1000000;
}
/* a member's current bounty: stored value if grown (training/battles), else its base */
function memberBounty(m){ return (m && typeof m.bounty === "number") ? m.bounty : baseBounty(m); }
function totalCrewBounty(save){
  let total = baseBounty(CAPTAIN_STATS);
  (save.roster || []).forEach(m => { total += memberBounty(m); });
  return total;
}

/* TODO: true once new characters appear on the market; placeholder for now */
function marketHasNew(save){ return true; }

/* captains you may pick: r==="Captain" OR cap===true; fixed captains first */
function captainPool(){
  if (typeof PIRATES === "undefined") { console.error("data-pirates.js not loaded"); return []; }
  return PIRATES.filter(p => p.r === "Captain" || p.cap === true)
                .sort((a,b) => (a.r === "Captain" ? 0 : 1) - (b.r === "Captain" ? 0 : 1));
}

const state = { captain: null };
const els = {};
function $(id){ return document.getElementById(id); }

/* ====================================================================
   Modal (confirm / info) — replaces window.confirm
   ==================================================================== */
function openModal(opt){
  els.modalTitle.textContent    = opt.title;
  els.modalMsg.textContent      = opt.message;
  els.modalConfirm.textContent  = opt.confirmLabel || "OK";
  els.modalConfirm.className     = opt.danger ? "btn-danger" : "btn-gold-sm";
  els.modalCancel.style.display  = opt.showCancel ? "" : "none";
  els.overlay.classList.add("is-open");
  els.overlay.setAttribute("aria-hidden", "false");
  els.modalConfirm.onclick = () => { closeModal(); if (opt.onConfirm) opt.onConfirm(); };
  els.modalConfirm.focus();
}
function closeModal(){
  els.overlay.classList.remove("is-open");
  els.overlay.setAttribute("aria-hidden", "true");
}
function showConfirm(message, onConfirm){
  openModal({ title:"Confirm", message, confirmLabel:"Delete", danger:true, showCancel:true, onConfirm });
}
function showInfo(message){
  openModal({ title:"Coming soon", message, confirmLabel:"OK", danger:false, showCancel:false });
}

/* ====================================================================
   New Game screen
   ==================================================================== */
function renderCaptains(){
  const wrap = els.carousel;
  wrap.innerHTML = "";
  captainPool().forEach(cap => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "cap-card";
    card.setAttribute("role", "option");
    card.setAttribute("aria-selected", "false");
    card.dataset.name = cap.n;
    card.innerHTML =
      '<div class="cap-card__av" style="background:' + colorFor(cap.n) + '">' + initial(cap.n) + '</div>' +
      '<div class="cap-card__name">' + escapeHtml(cap.n) + '</div>';
    card.addEventListener("click", () => selectCaptain(cap.n, card));
    wrap.appendChild(card);
  });
}

function selectCaptain(name, card){
  state.captain = name;
  els.carousel.querySelectorAll(".cap-card").forEach(c => {
    const on = (c === card);
    c.classList.toggle("is-selected", on);
    c.setAttribute("aria-selected", on ? "true" : "false");
  });
  card.scrollIntoView({ behavior:"smooth", inline:"nearest", block:"nearest" });
  validate();
}

function validate(){
  const nameOk = els.crewName.value.trim().length > 0;
  const capOk  = !!state.captain;
  const ok = nameOk && capOk;

  els.startBtn.disabled = !ok;
  els.hint.classList.remove("is-error");

  if (ok)                    els.hint.textContent = "Ready to set sail!";
  else if (!nameOk && capOk) els.hint.textContent = "Give your crew a name.";
  else if (nameOk && !capOk) els.hint.textContent = "Choose a captain.";
  else                       els.hint.textContent = "Enter a crew name and choose a captain to start.";
}

function onStart(){
  const crew = els.crewName.value.trim();
  if (!crew || !state.captain){
    els.hint.textContent = "You need a crew name and a captain to start.";
    els.hint.classList.add("is-error");
    return;
  }
  const saves = Store.get(SAVES_KEY) || [];
  if (saves.length >= MAX_SAVES){
    els.hint.textContent = "You've reached the maximum of " + MAX_SAVES + " saved games. Delete one first.";
    els.hint.classList.add("is-error");
    return;
  }
  const save = {
    id: Date.now(),
    crew: crew,
    captain: state.captain,
    berries: STARTING_BERRIES,
    day: 1,
    roster: [],
    created: new Date().toISOString()
  };
  saves.push(save);
  Store.set(SAVES_KEY, saves);
  Store.set(CURRENT_KEY, save.id);
  goHome(save);
}

/* carousel: mouse wheel -> horizontal + edge fade */
function setupCarousel(){
  const wrap = els.carouselWrap;
  const car  = els.carousel;
  car.addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)){ car.scrollLeft += e.deltaY; e.preventDefault(); }
  }, { passive:false });
  function updateFades(){
    const max = car.scrollWidth - car.clientWidth;
    wrap.classList.toggle("can-left",  car.scrollLeft > 4);
    wrap.classList.toggle("can-right", car.scrollLeft < max - 4);
  }
  car.addEventListener("scroll", updateFades);
  window.addEventListener("resize", updateFades);
  updateFades();
}

/* ====================================================================
   Saved games
   ==================================================================== */
function buildSaveRow(save){
  const row = document.createElement("div");
  row.className = "save-row";
  row.innerHTML =
    '<div class="save-row__info">' +
      '<div class="save-row__crew">' + escapeHtml(save.crew) + '</div>' +
      '<div class="save-row__meta">Captain ' + escapeHtml(save.captain) + ' · day ' + (save.day || 1) + '</div>' +
    '</div>';

  const cont = document.createElement("button");
  cont.type = "button";
  cont.className = "btn-gold";
  cont.style.cssText = "width:auto;font-size:16px;padding:8px 16px";
  cont.textContent = "Continue";
  cont.addEventListener("click", () => continueGame(save.id));

  const del = document.createElement("button");
  del.type = "button";
  del.className = "save-row__del";
  del.setAttribute("aria-label", "Delete save");
  del.innerHTML = "&times;";
  del.addEventListener("click", () => deleteSave(save.id, save.crew));

  row.appendChild(cont);
  row.appendChild(del);
  return row;
}

function renderSavedGames(){
  const box = els.savedList;
  box.innerHTML = "";
  const saves = (Store.get(SAVES_KEY) || []).slice().reverse();

  if (saves.length === 0){
    const empty = document.createElement("div");
    empty.className = "saved-empty";
    empty.textContent = "No saved game yet";
    box.appendChild(empty);
    return;
  }
  saves.slice(0, PREVIEW_SAVES).forEach(s => box.appendChild(buildSaveRow(s)));
  if (saves.length > PREVIEW_SAVES){
    const more = document.createElement("button");
    more.type = "button";
    more.className = "btn-see-all";
    more.textContent = "See all saved games (" + saves.length + ")";
    more.addEventListener("click", openAllSaves);
    box.appendChild(more);
  }
}

function openAllSaves(){ renderAllSaves(); showScreen("screen-saves"); }

function renderAllSaves(){
  const box = els.savesAll;
  box.innerHTML = "";
  const saves = (Store.get(SAVES_KEY) || []).slice().reverse();
  els.savesCount.textContent = saves.length + " / " + MAX_SAVES;
  if (saves.length === 0){
    const empty = document.createElement("div");
    empty.className = "saved-empty";
    empty.textContent = "No saved game yet";
    box.appendChild(empty);
    return;
  }
  saves.forEach(s => box.appendChild(buildSaveRow(s)));
}

function continueGame(id){
  const save = (Store.get(SAVES_KEY) || []).find(s => s.id === id);
  if (!save) return;
  Store.set(CURRENT_KEY, id);
  goHome(save);
}

function deleteSave(id, crew){
  showConfirm('Delete save "' + crew + '"? This cannot be undone.', () => {
    let saves = Store.get(SAVES_KEY) || [];
    saves = saves.filter(s => s.id !== id);
    Store.set(SAVES_KEY, saves);
    if (Store.get(CURRENT_KEY) === id) Store.set(CURRENT_KEY, null);
    renderSavedGames();
    if ($("screen-saves").classList.contains("is-active")) renderAllSaves();
  });
}

function persistSave(save){
  const saves = Store.get(SAVES_KEY) || [];
  const i = saves.findIndex(s => s.id === save.id);
  if (i >= 0){ saves[i] = save; Store.set(SAVES_KEY, saves); }
}

/* ====================================================================
   Screen switching + Home / hub
   ==================================================================== */
function showScreen(id){
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("is-active"));
  $(id).classList.add("is-active");
  document.body.dataset.screen = id;
  window.scrollTo(0, 0);
}

function miniStat(label, val){
  return '<div class="mini-stat"><span class="mini-stat__label">' + label + '</span>' +
         '<span class="mini-stat__val">' + val + '</span></div>';
}
function comingSoon(label){ showInfo('"' + label + '" is coming next.'); }

function goHome(save){
  const crewCount = save.roster ? save.roster.length : 0;
  const newBadge  = marketHasNew(save) ? '<span class="new-badge">New!</span>' : '';

  els.home.innerHTML =
    '<div class="home-top">' +
      '<div class="home-top__id">' +
        '<div class="home-top__av" style="background:' + colorFor(save.captain) + '">' + initial(save.captain) + '</div>' +
        '<div><div class="home-top__crew">' + escapeHtml(save.crew) + '</div>' +
        '<div class="home-top__cap">Captain ' + escapeHtml(save.captain) + '</div></div>' +
      '</div>' +
      '<div class="home-top__stats">' +
        miniStat("Berries", fmtShort(save.berries)) +
        miniStat("Bounty", fmtShort(totalCrewBounty(save))) +
        miniStat("Crew", crewCount + " / 13") +
        miniStat("Day", String(save.day || 1)) +
      '</div>' +
      '<div class="save-menu">' +
        '<button class="save-btn" id="save-btn" type="button">Save <span class="save-btn__car">&#9662;</span></button>' +
        '<div class="save-dropdown" id="save-dropdown">' +
          '<button class="save-dropdown__item" id="save-exit" type="button">Save &amp; exit</button>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<nav class="home-nav">' +
      '<button class="nav-btn" data-act="crew" type="button">Crew</button>' +
      '<button class="nav-btn" data-act="market" type="button">Transfer market</button>' +
      '<button class="nav-btn" data-act="training" type="button">Training</button>' +
      '<button class="nav-btn" data-act="league" type="button">League</button>' +
    '</nav>' +

    '<div class="home-battle">' +
      '<div class="battle-block">' +
        '<span class="battle-block__label">Next fight</span>' +
        '<span class="battle-block__opp">Not scheduled yet</span>' +
        '<span class="battle-block__note">appears once the League is running</span>' +
      '</div>' +
      '<div class="battle-side">' +
        '<button class="side-box" data-act="crew" type="button">' +
          '<span class="side-box__title">See how your crew is doing</span>' +
          '<span class="side-box__sub">line-up &amp; stats</span>' +
        '</button>' +
        '<button class="side-box" data-act="market" type="button">' + newBadge +
          '<span class="side-box__title">Take a look at the transfer market</span>' +
          '<span class="side-box__sub">recruit new crew</span>' +
        '</button>' +
      '</div>' +
    '</div>';

  const labels = { crew:"Crew & line-up", market:"Transfer market", training:"Training", league:"League" };
  els.home.querySelectorAll("[data-act]").forEach(b => {
    b.addEventListener("click", () => {
      if (b.dataset.act === "market") openMarket(save);
      else if (b.dataset.act === "crew") openCrew(save);
      else if (b.dataset.act === "training") openTraining(save);
      else comingSoon(labels[b.dataset.act]);
    });
  });

  const sBtn = $("save-btn"), sDrop = $("save-dropdown");
  sBtn.addEventListener("click", (e) => { e.stopPropagation(); sDrop.classList.toggle("is-open"); });
  $("save-exit").addEventListener("click", () => {
    persistSave(save);
    showScreen("screen-newgame");
    renderSavedGames();
  });

  showScreen("screen-home");
}

/* ====================================================================
   Transfer market
   ==================================================================== */
const market = { save:null, tab:"buy", role:"All", q:"", sort:"bounty_desc", rendered:[] };
const ROLE_ORDER = ["Right-Hand","Navigator","Sniper","Chef","Doctor",
                    "Archaeologist","Shipwright","Musician","Helmsman","Crewmate"];
const MARKET_SIZE = 12;   // OSM-style: only a handful of listings per day

/* everyone who could ever be bought: not a reserved captain, not your captain, not owned */
function buyableFor(save){
  const owned = new Set((save.roster || []).map(m => m.n));
  return PIRATES.filter(p => p.r !== "Captain" && p.n !== save.captain && !owned.has(p.n));
}
function priceOf(ch){ return memberBounty(ch); }   // buy listing -> base; owned crew -> current bounty
function hasRole(ch, role){ return ch.r === role || (Array.isArray(ch.alt) && ch.alt.indexOf(role) >= 0); }

/* seeded RNG so a day's listings are stable, but change when the day advances */
function seededRng(seed){
  let a = seed >>> 0;
  return function(){
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* (re)roll the day's listings whenever the day changes */
function ensureMarket(save){
  const day = save.day || 1;
  if (save.market && save.market.day === day) return;
  const pool = buyableFor(save).map(p => p.n);
  const rnd = seededRng(hash(String(save.id) + ":" + day));
  for (let i = pool.length - 1; i > 0; i--){
    const j = Math.floor(rnd() * (i + 1));
    const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
  }
  save.market = { day: day, names: pool.slice(0, MARKET_SIZE) };
  persistSave(save);
}
/* today's buyable listings (bought members drop off the list straight away) */
function listedBuyable(save){
  ensureMarket(save);
  const owned  = new Set((save.roster || []).map(m => m.n));
  const listed = new Set(save.market.names);
  return PIRATES.filter(p =>
    listed.has(p.n) && !owned.has(p.n) && p.n !== save.captain && p.r !== "Captain");
}

function openMarket(save){
  market.save = save;
  market.tab = "buy"; market.role = "All"; market.q = ""; market.sort = "bounty_desc";
  renderMarket();
  showScreen("screen-market");
}

function baseList(){
  const save = market.save;
  return (market.tab === "buy") ? listedBuyable(save) : (save.roster || []).slice();
}
function applyFilters(list){
  if (market.role !== "All") list = list.filter(p => hasRole(p, market.role));
  if (market.q){
    const q = market.q.toLowerCase();
    list = list.filter(p => p.n.toLowerCase().indexOf(q) >= 0);
  }
  if (market.sort === "name")            list.sort((a,b) => a.n.localeCompare(b.n));
  else if (market.sort === "bounty_asc") list.sort((a,b) => priceOf(a) - priceOf(b));
  else                                   list.sort((a,b) => priceOf(b) - priceOf(a));
  return list;
}

function marketRow(p, i, mode, disabled){
  const price = priceOf(p);
  const btn = (mode === "buy")
    ? '<button class="mk-rowbtn is-buy" data-i="' + i + '"' + (disabled ? ' disabled' : '') + '>Buy</button>'
    : '<button class="mk-rowbtn is-sell" data-i="' + i + '">Sell</button>';
  return '<tr>' +
      '<td><span class="mk-name"><span class="mk-av" style="background:' + colorFor(p.n) + '">' + initial(p.n) + '</span>' +
        '<b>' + escapeHtml(p.n) + '</b></span></td>' +
      '<td>' + escapeHtml(p.r) + '</td>' +
      '<td class="mk-pds">' + p.p + '-' + p.d + '-' + p.s + '</td>' +
      '<td class="mk-bounty">' + fmtShort(price) + '</td>' +
      '<td class="mk-actcell">' + btn + '</td>' +
    '</tr>';
}

function renderMarket(){
  const save   = market.save;
  const roster = save.roster || [];
  const full   = roster.length >= 13;
  const base   = baseList();
  const list   = applyFilters(base.slice());
  market.rendered = list;

  // chips: only roles present in the current tab's base list
  const present = ROLE_ORDER.filter(r => base.some(p => hasRole(p, r)));
  const chips = ["All"].concat(present).map(r =>
    '<span class="mk-chip' + (market.role === r ? ' is-on' : '') + '" data-role="' + r + '">' + r + '</span>'
  ).join("");

  let body;
  if (list.length === 0){
    body = '<div class="mk-empty">' + (market.tab === "buy"
      ? "No listings match your filters."
      : "Your crew is empty &mdash; recruit members on the Buy tab.") + '</div>';
  } else {
    const rows = list.map((p, i) => marketRow(p, i, market.tab, full || save.berries < priceOf(p))).join("");
    body = '<table class="mk-table"><thead><tr>' +
        '<th>Name</th><th>Role</th><th>P-D-S</th><th>Bounty</th><th class="mk-actcell"></th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>';
  }

  const dayNote = (market.tab === "buy")
    ? '<p class="mk-note">Day ' + (save.day || 1) + ' &middot; new faces arrive on the market each day.' +
      (full ? ' <b>Your crew is full (13 / 13) &mdash; sell someone to recruit.</b>' : '') + '</p>'
    : '';

  els.market.innerHTML =
    '<div class="mk-top">' +
      '<span class="mk-title">Transfer market</span>' +
      '<div class="mk-bal">' +
        miniStat("Berries", fmtShort(save.berries)) +
        miniStat("Crew", roster.length + " / 13") +
      '</div>' +
      '<button class="btn-ghost mk-back" id="mk-back" type="button">Back</button>' +
    '</div>' +
    '<div class="mk-tabs">' +
      '<div class="mk-tab' + (market.tab === "buy"  ? " is-on" : "") + '" data-tab="buy">Buy</div>' +
      '<div class="mk-tab' + (market.tab === "sell" ? " is-on" : "") + '" data-tab="sell">Sell</div>' +
    '</div>' +
    '<div class="mk-filters">' +
      '<input class="mk-search" id="mk-search" placeholder="Search by name" value="' + escapeHtml(market.q) + '" />' +
      '<div class="mk-chips">' + chips + '</div>' +
      '<select class="mk-sort" id="mk-sort">' +
        '<option value="bounty_desc"' + (market.sort === "bounty_desc" ? " selected" : "") + '>Bounty: high to low</option>' +
        '<option value="bounty_asc"'  + (market.sort === "bounty_asc"  ? " selected" : "") + '>Bounty: low to high</option>' +
        '<option value="name"'        + (market.sort === "name"        ? " selected" : "") + '>Name (A&ndash;Z)</option>' +
      '</select>' +
    '</div>' +
    dayNote +
    body;

  $("mk-back").addEventListener("click", () => goHome(save));
  els.market.querySelectorAll(".mk-tab").forEach(t =>
    t.addEventListener("click", () => { market.tab = t.dataset.tab; market.role = "All"; renderMarket(); }));
  els.market.querySelectorAll(".mk-chip").forEach(c =>
    c.addEventListener("click", () => { market.role = c.dataset.role; renderMarket(); }));
  const sortSel = $("mk-sort");
  sortSel.addEventListener("change", () => { market.sort = sortSel.value; renderMarket(); });
  const search = $("mk-search");
  search.addEventListener("input", () => {
    market.q = search.value;
    renderMarket();
    const s = $("mk-search"); s.focus(); s.setSelectionRange(s.value.length, s.value.length);
  });
  els.market.querySelectorAll(".is-buy").forEach(b =>
    b.addEventListener("click", () => confirmBuy(market.rendered[+b.dataset.i])));
  els.market.querySelectorAll(".is-sell").forEach(b =>
    b.addEventListener("click", () => confirmSell(+b.dataset.i)));
}

function confirmBuy(ch){
  if (!ch) return;
  const save = market.save;
  const price = priceOf(ch);
  if ((save.roster || []).length >= 13){ showInfo("Your crew is full (13 / 13). Sell someone first."); return; }
  if (save.berries < price){ showInfo("Not enough Berries to recruit " + ch.n + "."); return; }
  openModal({
    title:"Confirm recruit", danger:false, showCancel:true, confirmLabel:"Recruit",
    message:"Are you sure you want to recruit " + ch.n + " (" + ch.r + ") for " + fmtBerries(price) + "?",
    onConfirm: () => {
      save.berries -= price;
      save.roster = save.roster || [];
      save.roster.push({ n:ch.n, r:ch.r, alt:ch.alt || null, p:ch.p, d:ch.d, s:ch.s, c:ch.c, sp:ch.sp || [], bounty: baseBounty(ch) });
      persistSave(save);
      renderMarket();
      openModal({
        title:"Recruited!", danger:false, showCancel:false, confirmLabel:"OK",
        message:ch.n + " has joined your crew and is waiting on the bench. Assign their spot on the Crew page."
      });
    }
  });
}

function confirmSell(i){
  const save = market.save;
  const m = (save.roster || [])[i];
  if (!m) return;
  const price = priceOf(m);
  openModal({
    title:"Confirm sale", danger:false, showCancel:true, confirmLabel:"Sell",
    message:"Are you sure you want to sell " + m.n + " for " + fmtBerries(price) + "? They leave your crew.",
    onConfirm: () => {
      save.berries += price;
      save.roster.splice(i, 1);
      persistSave(save);
      renderMarket();
    }
  });
}

/* ====================================================================
   Crew & line-up  (ship slots + bench, drag & drop)
   ==================================================================== */
const crew = { save:null };
const DECK_ROLES = ["Right-Hand","Sniper","Chef","Doctor","Archaeologist",
                    "Shipwright","Musician","Navigator","Helmsman"];
const BENCH_SIZE = 4;
const SLOT_POS = {
  "Right-Hand":[27,22], "Sniper":[73,22],
  "Chef":[27,37], "Doctor":[73,37],
  "Archaeologist":[27,52], "Shipwright":[73,52],
  "Musician":[50,66],
  "Navigator":[30,84], "Helmsman":[70,84]
};
const SHIP_SVG =
  '<svg viewBox="0 0 360 500" preserveAspectRatio="none">' +
    '<defs>' +
      '<linearGradient id="wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9c6a36"/><stop offset="1" stop-color="#74481f"/></linearGradient>' +
      '<linearGradient id="deck" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d2ad72"/><stop offset="1" stop-color="#bd965f"/></linearGradient>' +
    '</defs>' +
    '<path d="M180,2 L171,22 L189,22 Z" fill="#e7b94a" stroke="#9a6b1e" stroke-width="1.5"/>' +
    '<path d="M180,18 C116,38 64,86 56,176 L56,402 C56,462 110,490 180,490 C250,490 304,462 304,402 L304,176 C296,86 244,38 180,18 Z" fill="url(#wood)" stroke="#5e3c1c" stroke-width="6"/>' +
    '<path d="M180,30 C124,48 80,90 72,180 L72,398 C72,452 120,476 180,476 C240,476 288,452 288,398 L288,180 C280,90 236,48 180,30 Z" fill="url(#deck)" stroke="#8a5a2b" stroke-width="2"/>' +
    '<path d="M180,40 C130,56 90,96 83,182 L83,396 C83,446 126,468 180,468 C234,468 277,446 277,396 L277,182 C270,96 230,56 180,40 Z" fill="none" stroke="#a9824f" stroke-width="1.2" opacity="0.7"/>' +
    '<g stroke="#a9824f" stroke-width="1.3" opacity="0.55">' +
      '<line x1="110" y1="60" x2="110" y2="455"/><line x1="145" y1="48" x2="145" y2="466"/><line x1="180" y1="42" x2="180" y2="470"/><line x1="215" y1="48" x2="215" y2="466"/><line x1="250" y1="60" x2="250" y2="455"/>' +
    '</g>' +
    '<g stroke="#9a7038" stroke-width="1" opacity="0.32">' +
      '<line x1="80" y1="130" x2="280" y2="130"/><line x1="74" y1="210" x2="286" y2="210"/><line x1="74" y1="290" x2="286" y2="290"/><line x1="78" y1="378" x2="282" y2="378"/>' +
    '</g>' +
    '<g fill="#2e241a">' +
      '<rect x="42" y="198" width="20" height="9" rx="2"/><rect x="42" y="300" width="20" height="9" rx="2"/>' +
      '<rect x="298" y="198" width="20" height="9" rx="2"/><rect x="298" y="300" width="20" height="9" rx="2"/>' +
    '</g>' +
    '<g fill="#8a5a2b" opacity="0.7">' +
      '<circle cx="74" cy="225" r="3"/><circle cx="74" cy="285" r="3"/><circle cx="74" cy="345" r="3"/>' +
      '<circle cx="286" cy="225" r="3"/><circle cx="286" cy="285" r="3"/><circle cx="286" cy="345" r="3"/>' +
    '</g>' +
    '<g fill="none" stroke="#b88b54" stroke-width="2" opacity="0.7">' +
      '<circle cx="96" cy="432" r="9"/><circle cx="96" cy="432" r="4.5"/>' +
      '<circle cx="264" cy="432" r="9"/><circle cx="264" cy="432" r="4.5"/>' +
    '</g>' +
    '<g stroke="#6e451f" stroke-width="3" fill="none">' +
      '<circle cx="180" cy="450" r="19"/>' +
      '<line x1="161" y1="450" x2="199" y2="450"/><line x1="180" y1="431" x2="180" y2="469"/><line x1="167" y1="437" x2="193" y2="463"/><line x1="193" y1="437" x2="167" y2="463"/>' +
    '</g>' +
    '<circle cx="180" cy="450" r="6" fill="#6e451f"/>' +
  '</svg>';

function memberByName(save, name){ return (save.roster || []).find(m => m.n === name); }

function getPlace(save, type, key){ return type === "deck" ? save.lineup.deck[key] : save.lineup.bench[key]; }
function setPlace(save, type, key, name){ if (type === "deck") save.lineup.deck[key] = name; else save.lineup.bench[key] = name; }

function placeMember(save, name){
  const lu = save.lineup;
  for (let i = 0; i < BENCH_SIZE; i++){ if (!lu.bench[i]){ lu.bench[i] = name; return; } }
  for (const r of DECK_ROLES){ if (!lu.deck[r]){ lu.deck[r] = name; return; } }
}
function reconcileLineup(save){
  const lu = save.lineup;
  const owned = new Set((save.roster || []).map(m => m.n));
  DECK_ROLES.forEach(r => { if (lu.deck[r] && !owned.has(lu.deck[r])) lu.deck[r] = null; });
  for (let i = 0; i < BENCH_SIZE; i++){ if (lu.bench[i] && !owned.has(lu.bench[i])) lu.bench[i] = null; }
  const placed = new Set([].concat(DECK_ROLES.map(r => lu.deck[r]), lu.bench).filter(Boolean));
  (save.roster || []).forEach(m => { if (!placed.has(m.n)) placeMember(save, m.n); });
}
function ensureLineup(save){
  if (!save.lineup || !save.lineup.deck || !Array.isArray(save.lineup.bench)){
    const lu = { deck:{}, bench:[] };
    DECK_ROLES.forEach(r => lu.deck[r] = null);
    for (let i = 0; i < BENCH_SIZE; i++) lu.bench[i] = null;
    save.lineup = lu;
  }
  reconcileLineup(save);
  persistSave(save);
}

/* specialist in own slot -> bonus; Crewmate -> neutral; otherwise off-role */
function fitFor(member, role){
  if (!member) return null;
  if (member.r === role || (Array.isArray(member.alt) && member.alt.indexOf(role) >= 0)) return "bonus";
  if (member.r === "Crewmate") return "neutral";
  return "off";
}
function fitBadge(fit){
  if (fit === "bonus") return '<span class="fit fit-bonus" title="In their role">&#10003;</span>';
  if (fit === "off")   return '<span class="fit fit-off" title="Off-role (small malus)">&ndash;</span>';
  return "";
}

function openCrew(save){
  crew.save = save;
  ensureLineup(save);
  renderCrew();
  showScreen("screen-crew");
}

function deckSlotHtml(role){
  const save = crew.save;
  const pos  = SLOT_POS[role];
  const style = "left:" + pos[0] + "%; top:" + pos[1] + "%";
  const name = save.lineup.deck[role];
  if (name){
    const m = memberByName(save, name);
    return '<div class="slot filled" style="' + style + '" data-drop="deck:' + role + '" data-drag="deck:' + role + '">' +
        fitBadge(fitFor(m, role)) +
        '<div class="slot-nm"><span class="dot" style="background:' + colorFor(name) + '"></span>' + escapeHtml(name) + '</div>' +
        '<div class="slot-role">' + role + '</div>' +
      '</div>';
  }
  return '<div class="slot empty" style="' + style + '" data-drop="deck:' + role + '">' +
      '<div class="slot-plus">+</div><div class="slot-role">' + role + '</div>' +
    '</div>';
}
function benchSlotHtml(i){
  const save = crew.save;
  const name = save.lineup.bench[i];
  if (name){
    const m = memberByName(save, name);
    return '<div class="b-slot" data-drop="bench:' + i + '" data-drag="bench:' + i + '">' +
        '<div class="b-av" style="background:' + colorFor(name) + '">' + initial(name) + '</div>' +
        '<div><div class="b-nm">' + escapeHtml(name) + '</div><div class="b-role">' + escapeHtml(m ? m.r : "") + '</div></div>' +
      '</div>';
  }
  return '<div class="b-slot empty" data-drop="bench:' + i + '">Empty bench slot</div>';
}

function renderCrew(){
  const save = crew.save;
  const roster = save.roster || [];

  const captainSlot =
    '<div class="slot cap filled" style="left:50%; top:8%">' +
      '<div class="slot-av" style="background:' + colorFor(save.captain) + '">' + initial(save.captain) + '</div>' +
      '<div class="slot-nm">' + escapeHtml(save.captain) + '</div><div class="slot-role">Captain</div>' +
    '</div>';

  const note = roster.length === 0
    ? "Your crew is empty &mdash; recruit members on the transfer market, then drag them onto a post."
    : "Drag a crew member onto a post on the ship. Drop them on a filled post to swap.";

  els.crew.innerHTML =
    '<div class="cw-top">' +
      '<div class="cw-id">' +
        '<div class="cw-av" style="background:' + colorFor(save.captain) + '">' + initial(save.captain) + '</div>' +
        '<div><div class="cw-crew">' + escapeHtml(save.crew) + '</div>' +
        '<div class="cw-cap">Captain ' + escapeHtml(save.captain) + '</div></div>' +
      '</div>' +
      '<div class="cw-bal">' +
        miniStat("Bounty", fmtShort(totalCrewBounty(save))) +
        miniStat("Crew", roster.length + " / 13") +
      '</div>' +
      '<button class="btn-ghost cw-back" id="cw-back" type="button">Back</button>' +
    '</div>' +
    '<div class="cw-main">' +
      '<div class="ship-col">' + SHIP_SVG +
        '<span class="dir" style="top:-2px">&#9650; Bow</span>' +
        '<span class="dir" style="bottom:-4px">Stern / Wheel</span>' +
        captainSlot + DECK_ROLES.map(deckSlotHtml).join("") +
      '</div>' +
      '<div class="bench-col">' +
        '<div class="bench"><div class="bench-title">Bench</div>' +
          [0,1,2,3].map(benchSlotHtml).join("") +
        '</div>' +
        '<div class="bench-note">' + note + '</div>' +
      '</div>' +
    '</div>';

  $("cw-back").addEventListener("click", () => goHome(save));
  els.crew.querySelectorAll("[data-drag]").forEach(el => {
    el.addEventListener("pointerdown", onDragStart);
  });
}

/* ---- drag & drop (Pointer Events: works with mouse and touch) ---- */
let drag = null;

function dropTargetAt(x, y){
  const el = document.elementFromPoint(x, y);
  return el ? el.closest("[data-drop]") : null;
}
function moveGhost(x, y){ if (drag && drag.ghost){ drag.ghost.style.left = x + "px"; drag.ghost.style.top = y + "px"; } }

function onDragStart(e){
  if (e.button && e.button !== 0) return;
  const parts = e.currentTarget.dataset.drag.split(":");
  const type = parts[0];
  const key  = (type === "deck") ? parts[1] : parseInt(parts[1], 10);
  const name = getPlace(crew.save, type, key);
  if (!name) return;
  e.preventDefault();

  drag = { type:type, key:key, name:name, srcEl:e.currentTarget, ghost:null };
  e.currentTarget.classList.add("is-source");

  const g = document.createElement("div");
  g.className = "drag-ghost";
  g.innerHTML = '<div class="slot-nm"><span class="dot" style="background:' + colorFor(name) + '"></span>' + escapeHtml(name) + '</div>';
  document.body.appendChild(g);
  drag.ghost = g;
  moveGhost(e.clientX, e.clientY);

  document.body.classList.add("is-dragging");
  els.crew.querySelectorAll("[data-drop]").forEach(d => d.classList.add("droppable"));

  window.addEventListener("pointermove", onDragMove);
  window.addEventListener("pointerup", onDragUp);
  window.addEventListener("pointercancel", onDragCancel);
}
function onDragMove(e){
  if (!drag) return;
  e.preventDefault();
  moveGhost(e.clientX, e.clientY);
  const t = dropTargetAt(e.clientX, e.clientY);
  els.crew.querySelectorAll("[data-drop]").forEach(d => d.classList.toggle("drop-hover", d === t));
}
function onDragUp(e){ endDrag(true, e.clientX, e.clientY); }
function onDragCancel(){ endDrag(false, 0, 0); }

function applyDrop(tType, tKey){
  const save = crew.save;
  const occupant = getPlace(save, tType, tKey);
  if (occupant === drag.name) return;             // dropped on own post
  setPlace(save, tType, tKey, drag.name);
  setPlace(save, drag.type, drag.key, occupant);  // occupant (or null) goes to old spot = move/swap
  persistSave(save);
}
function endDrag(apply, x, y){
  window.removeEventListener("pointermove", onDragMove);
  window.removeEventListener("pointerup", onDragUp);
  window.removeEventListener("pointercancel", onDragCancel);
  if (apply && drag){
    const t = dropTargetAt(x, y);
    if (t){
      const parts = t.dataset.drop.split(":");
      applyDrop(parts[0], parts[0] === "deck" ? parts[1] : parseInt(parts[1], 10));
    }
  }
  if (drag){
    if (drag.srcEl) drag.srcEl.classList.remove("is-source");
    if (drag.ghost) drag.ghost.remove();
  }
  document.body.classList.remove("is-dragging");
  drag = null;
  renderCrew();
}

/* ====================================================================
   Training grounds  (3 fields, real-time, grows bounty)
   ==================================================================== */
const training = { save:null };
const TRAIN_FIELDS = 3;
const TRAIN_MS = 3 * 60 * 60 * 1000;   // 3 hours (lower this to test, e.g. 10 * 1000)
let trainTick = null;

function trainDurationLabel(){
  if (TRAIN_MS >= 3600000) return (TRAIN_MS / 3600000) + (TRAIN_MS === 3600000 ? " hour" : " hours");
  if (TRAIN_MS >= 60000)   return Math.round(TRAIN_MS / 60000) + " min";
  return Math.round(TRAIN_MS / 1000) + " sec";
}
function fmtRemaining(ms){
  if (ms <= 0) return "Ready!";
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return h + "h " + String(m).padStart(2, "0") + "m";
  if (m > 0) return m + "m " + String(sec).padStart(2, "0") + "s";
  return sec + "s";
}

function ensureTraining(save){
  if (!Array.isArray(save.training)) save.training = [];
  while (save.training.length < TRAIN_FIELDS) save.training.push(null);
  const owned = new Set((save.roster || []).map(m => m.n));
  let changed = false;
  for (let i = 0; i < save.training.length; i++){
    const t = save.training[i];
    if (t && !owned.has(t.name)){ save.training[i] = null; changed = true; }   // sold while training
  }
  if (changed) persistSave(save);
}
function idleMembers(save){
  const busy = new Set(save.training.filter(Boolean).map(t => t.name));
  return (save.roster || []).filter(m => !busy.has(m.n));
}

function openTraining(save){
  training.save = save;
  ensureTraining(save);
  renderTraining();
  showScreen("screen-training");
  startTrainTick();
}

function fieldHtml(i){
  const save = training.save;
  const t = save.training[i];
  if (!t){
    return '<div class="tf empty">' +
        '<div class="tf-ring tf-ring-empty"></div>' +
        '<div class="tf-empty-label">Empty field</div>' +
        '<div class="tf-empty-sub">tap a crewmate below</div>' +
      '</div>';
  }
  const ring = '<div class="tf-ring"><div class="tf-dot" style="background:' + colorFor(t.name) + '">' + initial(t.name) + '</div></div>';
  const m = memberByName(save, t.name);
  const role = m ? m.r : "";
  const rem = t.finish - Date.now();
  if (rem <= 0){
    return '<div class="tf tf-ready">' +
        '<span class="tf-badge">Done!</span>' + ring +
        '<div class="tf-name">' + escapeHtml(t.name) + '</div><div class="tf-role">' + escapeHtml(role) + '</div>' +
        '<button class="tf-collect" data-collect="' + i + '">Collect +' + fmtShort(t.gain) + '</button>' +
      '</div>';
  }
  const pct = Math.max(0, Math.min(100, ((Date.now() - t.start) / (t.finish - t.start)) * 100));
  return '<div class="tf">' + ring +
      '<div class="tf-name">' + escapeHtml(t.name) + '</div><div class="tf-role">' + escapeHtml(role) + '</div>' +
      '<div class="tf-bar"><div class="tf-fill" style="width:' + pct.toFixed(1) + '%"></div></div>' +
      '<div class="tf-time">' + fmtRemaining(rem) + ' left</div>' +
      '<button class="tf-cancel" data-cancel="' + i + '">Cancel</button>' +
    '</div>';
}

function renderTraining(){
  const save = training.save;
  const idle = idleMembers(save);

  const fields = [0,1,2].map(fieldHtml).join("");
  const chips = idle.length === 0
    ? '<div class="tg-empty">No idle crew. Recruit more on the transfer market, or wait for a field to finish.</div>'
    : idle.map(m =>
        '<button class="av-chip" data-train="' + escapeHtml(m.n) + '">' +
          '<span class="av-dot" style="background:' + colorFor(m.n) + '"></span>' +
          '<span class="av-nm">' + escapeHtml(m.n) + '</span>' +
          '<span class="av-by">' + fmtShort(memberBounty(m)) + '</span>' +
        '</button>'
      ).join("");

  els.training.innerHTML =
    '<div class="tg-top">' +
      '<div class="tg-id">' +
        '<div class="tg-av" style="background:' + colorFor(save.captain) + '">' + initial(save.captain) + '</div>' +
        '<div><div class="tg-crew">' + escapeHtml(save.crew) + '</div>' +
        '<div class="tg-cap">Captain ' + escapeHtml(save.captain) + '</div></div>' +
      '</div>' +
      '<div class="tg-bal">' +
        miniStat("Bounty", fmtShort(totalCrewBounty(save))) +
        miniStat("Crew", (save.roster || []).length + " / 13") +
      '</div>' +
      '<button class="btn-ghost" id="tr-back" type="button">Back</button>' +
    '</div>' +
    '<p class="tg-intro">Train up to 3 crew at once. Each session takes ' + trainDurationLabel() + ' and raises that member\'s bounty.</p>' +
    '<div class="tg-fields">' + fields + '</div>' +
    '<div class="tg-avail-t">Available crew</div>' +
    '<div class="tg-avail">' + chips + '</div>';

  $("tr-back").addEventListener("click", () => { stopTrainTick(); goHome(save); });
  els.training.querySelectorAll("[data-train]").forEach(b =>
    b.addEventListener("click", () => startTraining(b.dataset.train)));
  els.training.querySelectorAll("[data-collect]").forEach(b =>
    b.addEventListener("click", () => collectField(+b.dataset.collect)));
  els.training.querySelectorAll("[data-cancel]").forEach(b =>
    b.addEventListener("click", () => cancelField(+b.dataset.cancel)));
}

function startTraining(name){
  const save = training.save;
  const free = save.training.findIndex(t => !t);
  if (free < 0){ showInfo("All 3 training fields are busy. Collect or cancel one first."); return; }
  const m = memberByName(save, name);
  if (!m) return;
  const cur = memberBounty(m);
  const gain = Math.max(1000000, Math.round(cur * (0.20 + Math.random() * 0.10) / 1e6) * 1e6);
  openModal({
    title:"Start training", danger:false, showCancel:true, confirmLabel:"Train",
    message:"Send " + name + " to train for " + trainDurationLabel() + "? Their bounty will grow by " + fmtShort(gain) + ".",
    onConfirm: () => {
      const now = Date.now();
      save.training[free] = { name:name, start:now, finish:now + TRAIN_MS, gain:gain };
      persistSave(save);
      renderTraining();
    }
  });
}

function collectField(i){
  const save = training.save;
  const t = save.training[i];
  if (!t || Date.now() < t.finish) return;
  const m = memberByName(save, t.name);
  save.training[i] = null;
  if (m){
    const before = memberBounty(m);
    m.bounty = before + t.gain;
    persistSave(save);
    renderTraining();
    openModal({
      title:"Training complete!", danger:false, showCancel:false, confirmLabel:"Nice",
      message: t.name + " trained hard. Bounty " + fmtShort(before) + " \u2192 " + fmtShort(m.bounty) + " (+" + fmtShort(t.gain) + ")."
    });
  } else {
    persistSave(save);
    renderTraining();
  }
}

function cancelField(i){
  const save = training.save;
  const t = save.training[i];
  if (!t) return;
  openModal({
    title:"Cancel training", danger:true, showCancel:true, confirmLabel:"Stop",
    message:"Stop " + t.name + "'s training? No bounty gain.",
    onConfirm: () => { save.training[i] = null; persistSave(save); renderTraining(); }
  });
}

function startTrainTick(){
  stopTrainTick();
  trainTick = setInterval(() => {
    const scr = document.getElementById("screen-training");
    if (!scr || !scr.classList.contains("is-active")){ stopTrainTick(); return; }
    renderTraining();
  }, 1000);
}
function stopTrainTick(){ if (trainTick){ clearInterval(trainTick); trainTick = null; } }

/* ====================================================================
   Init
   ==================================================================== */
function init(){
  els.carousel     = $("captain-carousel");
  els.carouselWrap = $("carousel-wrap");
  els.crewName     = $("crew-name");
  els.startBtn     = $("start-btn");
  els.hint         = $("form-hint");
  els.savedList    = $("saved-list");
  els.savesAll     = $("saves-all");
  els.savesCount   = $("saves-count");
  els.home         = $("home-content");
  els.market       = $("market-content");
  els.crew         = $("crew-content");
  els.training     = $("training-content");
  els.berries      = $("start-berries");

  els.overlay      = $("modal-overlay");
  els.modalTitle   = $("modal-title");
  els.modalMsg     = $("modal-msg");
  els.modalConfirm = $("modal-confirm");
  els.modalCancel  = $("modal-cancel");

  els.berries.textContent = fmtBerries(STARTING_BERRIES);

  renderCaptains();
  setupCarousel();
  renderSavedGames();

  els.crewName.addEventListener("input", validate);
  els.startBtn.addEventListener("click", onStart);
  $("saves-back").addEventListener("click", () => { showScreen("screen-newgame"); renderSavedGames(); });

  els.modalCancel.addEventListener("click", closeModal);
  els.overlay.addEventListener("click", (e) => { if (e.target === els.overlay) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  // close the save-dropdown when clicking anywhere else
  document.addEventListener("click", () => {
    const d = $("save-dropdown");
    if (d) d.classList.remove("is-open");
  });

  validate();
}

document.addEventListener("DOMContentLoaded", init);