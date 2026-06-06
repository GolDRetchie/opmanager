/* ====================================================================
   Crew Manager — game.js  (New Game + Saves + Home + modal)
   ==================================================================== */

"use strict";

/* ---- configurable ---- */
const STARTING_BERRIES = 30000000;     // both you and rivals: enough to field a small crew, then build via match income
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
function fmtShort(n){ if (n >= 1e9) return (Math.round(n / 1e7) / 100) + "B"; return Math.round(n / 1e6) + "M"; }
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => (
    {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]
  ));
}

/* start bounty: stat sum (3..30) -> 10M..30M, whole millions */
function baseBounty(stats){
  const sum = (stats.p || 0) + (stats.d || 0) + (stats.s || 0);
  return Math.max(1, sum) * 1000000;   // linear: each stat point = 1M (8-8-8 -> 24M, 2-2-2 -> 6M)
}
/* a member's current bounty: stored value if grown (training/battles), else its base */
function memberBounty(m){ return baseBounty(m); }
/* Members enter play BELOW their data stats (their "potential") and grow into it via training/fights.
   Captains are exempt (always 8-8-8). This keeps recruiting affordable: with 30M you can sign
   ~2 strong members or ~3-4 rookies, instead of one overpriced star. */
const MEMBER_START_SCALE = 0.62;
const MEMBER_STAT_FLOOR  = 2;
function enlistStat(v){ return Math.max(MEMBER_STAT_FLOOR, Math.round((v || 0) * MEMBER_START_SCALE)); }
function enlistStats(b){ return { p:enlistStat(b.p), d:enlistStat(b.d), s:enlistStat(b.s) }; }
function enlistPrice(b){ return baseBounty(enlistStats(b)); }
const CAPTAIN_PREMIUM = 1.6;   // captains are the crew's most-wanted face
function captainBounty(capStats, members){
  const base  = Math.round(baseBounty(capStats) * CAPTAIN_PREMIUM / 1e6) * 1e6;
  let top = 0; (members || []).forEach(m => { const b = baseBounty(m); if (b > top) top = b; });
  const floor = Math.round(top * 1.10 / 1e6) * 1e6;   // always at least 10% above the best crewmate
  return Math.max(base, floor);
}
function totalCrewBounty(save){
  let total = captainBounty(captainStatsOf(save), save.roster || []);
  (save.roster || []).forEach(m => { total += baseBounty(m); });
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
  const m = els.overlay.querySelector(".modal"); if (m) m.classList.remove("wide");
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

function selectDifficulty(level, card){
  state.difficulty = level;
  (els.diffCards || []).forEach(c => {
    const on = (c === card);
    c.classList.toggle("is-selected", on);
    c.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function setupDifficulty(){
  els.diffCards = Array.prototype.slice.call(document.querySelectorAll("#difficulty-list .diff-card"));
  if (!els.diffCards.length){ state.difficulty = "normal"; return; }
  const pre = els.diffCards.filter(c => c.classList.contains("is-selected"))[0] || els.diffCards[0];
  state.difficulty = pre.dataset.diff || "normal";
  els.diffCards.forEach(card => {
    card.addEventListener("click", () => selectDifficulty(card.dataset.diff, card));
  });
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
    captainStats: { p:8, d:8, s:8 },
    captainCond: 100,
    difficulty: state.difficulty || "normal",
    berries: STARTING_BERRIES,
    day: 1,
    roster: [],
    record: { w:0, d:0, l:0, pts:0 },
    created: new Date().toISOString()
  };
  generateLeague(save);
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
  ensureGame(save);
  const crewCount = save.roster ? save.roster.length : 0;
  const isl = islandFor(save.day);
  const trainingCount = trainingNames(save).size;
  const unread = (save.inbox || []).filter(x => !x.read).length;

  let fightInner;
  if (!isl){
    fightInner = '<span class="battle-block__label">Journey complete</span>' +
                 '<span class="battle-block__opp">Laugh Tale reached</span>' +
                 '<span class="battle-block__note">see the final standings in the League</span>';
  } else if (isl.type === "rest"){
    fightInner = '<span class="battle-block__label">Rest day</span>' +
                 '<span class="battle-block__opp">' + escapeHtml(isl.name) + '</span>' +
                 '<span class="battle-block__note">your crew recovers &mdash; no battle today</span>' +
                 '<button class="btn-gold home-go" id="home-fight" data-fight="rest" type="button">Sail on &#9654;</button>';
  } else if (isl.type === "final"){
    const t = save.tournament;
    if (t && t.done){
      fightInner = '<span class="battle-block__label">Laugh Tale</span>' +
                   '<span class="battle-block__opp">' + (t.champion === 0 ? "King of the Pirates!" : escapeHtml(teamName(save, t.champion)) + " won") + '</span>' +
                   '<span class="battle-block__note">' + (t.champion === 0 ? "you conquered the Grand Line &mdash; the journey is complete" : "the Grand Tournament is over") + '</span>' +
                   '<button class="btn-gold home-go" id="home-fight" data-fight="final" type="button">View bracket</button>';
    } else {
      fightInner = '<span class="battle-block__label">Laugh Tale</span>' +
                   '<span class="battle-block__opp">Grand Tournament</span>' +
                   '<span class="battle-block__note">the finale &mdash; top 8 crews, single elimination</span>' +
                   '<button class="btn-gold home-go" id="home-fight" data-fight="final" type="button">Enter</button>';
    }
  } else {
    const played = save.matchday && save.matchday.day === save.day && save.matchday.played;
    let opp = null;
    if (isl.type === "navy") opp = "the Navy";
    else { const pr = fixturesForDay(save, save.day).find(p => p[0] === 0 || p[1] === 0); if (pr) opp = teamName(save, pr[0] === 0 ? pr[1] : pr[0]); }
    if (!opp){
      fightInner = '<span class="battle-block__label">Day ' + save.day + ' &middot; ' + escapeHtml(isl.name) + '</span>' +
                   '<span class="battle-block__opp">No fixture today</span>' +
                   '<span class="battle-block__note">your crew has a bye &mdash; sail on when ready</span>' +
                   '<button class="btn-gold home-go" id="home-fight" data-fight="rest" type="button">Sail on &#9654;</button>';
    } else if (played){
      fightInner = '<span class="battle-block__label">Day ' + save.day + ' &middot; ' + escapeHtml(isl.name) + '</span>' +
                   '<span class="battle-block__opp">Matchday done</span>' +
                   '<span class="battle-block__note">train your crew if you like, then set sail</span>' +
                   '<button class="btn-gold home-go" id="home-fight" data-fight="sail" type="button">Sail to next island &#9654;</button>';
    } else {
      fightInner = '<span class="battle-block__label">Day ' + save.day + ' &middot; ' + escapeHtml(isl.name) + '</span>' +
                   '<span class="battle-block__opp">vs ' + escapeHtml(opp) + '</span>' +
                   '<span class="battle-block__note">' + (isl.type === "navy" ? "Marine base &mdash; full crew vs an Admiral" : "rival crew battle") + '</span>' +
                   '<button class="btn-gold home-go" id="home-fight" data-fight="go" type="button">Start matchday</button>';
    }
  }

  const hasFixture = isl && (isl.type === "navy" ||
                     (isl.type === "normal" && !!fixturesForDay(save, save.day).find(p => p[0] === 0 || p[1] === 0)));
  const matchReady = hasFixture &&
                     !(save.matchday && save.matchday.day === save.day && save.matchday.played);
  const leftBox = matchReady
    ? '<button class="side-box' + (trainingCount > 0 ? " warn" : "") + '" data-act="training" type="button">' +
        '<span class="side-box__title">Did you pull everyone out of training?</span>' +
        '<span class="side-box__sub">' + (trainingCount > 0 ? (trainingCount + " still training &mdash; they will sit out") : "trainees can\u2019t join the fight") + '</span>' +
      '</button>'
    : '<button class="side-box" data-act="crew" type="button">' +
        '<span class="side-box__title">See how your crew is doing</span>' +
        '<span class="side-box__sub">line-up &amp; stats</span>' +
      '</button>';
  const newBadge = marketHasNew(save) ? '<span class="new-badge">New!</span>' : '';

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
        miniStat("Day", (save.day || 1) + " / 30") +
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
      '<button class="nav-btn nav-inbox" data-act="inbox" type="button">Inbox' + (unread > 0 ? ' <span class="nav-badge">' + unread + '</span>' : '') + '</button>' +
    '</nav>' +

    '<div class="home-battle">' +
      '<div class="battle-block">' + fightInner + '</div>' +
      '<div class="battle-side">' + leftBox +
        '<button class="side-box" data-act="market" type="button">' + newBadge +
          '<span class="side-box__title">Take a look at the transfer market</span>' +
          '<span class="side-box__sub">recruit new crew</span>' +
        '</button>' +
      '</div>' +
    '</div>';

  els.home.querySelectorAll("[data-act]").forEach(b => {
    b.addEventListener("click", () => {
      const a = b.dataset.act;
      if (a === "market") openMarket(save);
      else if (a === "crew") openCrew(save);
      else if (a === "training") openTraining(save);
      else if (a === "league") openLeague(save);
      else if (a === "inbox") openInbox(save);
    });
  });
  const fb = $("home-fight");
  if (fb) fb.addEventListener("click", () => {
    const f = fb.dataset.fight;
    if (f === "go") openMatchday(save);
    else if (f === "sail"){ endOfDay(save, false); goHome(save); }
    else if (f === "rest"){ doRestDay(save); }
    else if (f === "final") openTournament(save);
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
const ROLE_ORDER = ["Swordsman","Navigator","Sniper","Chef","Doctor",
                    "Archaeologist","Shipwright","Musician","Helmsman","Crewmate"];
const MARKET_SIZE = 12;   // OSM-style: only a handful of listings on the board at a time
/* Each listing gets its own stat bonus so the board always has a spread:
   plenty of bargains (well below average) plus a few above-average names. Drifts up slowly. */
function rollListingBonus(day){
  const d = day || 1;
  const drift = Math.floor((d - 1) * 0.10);
  const r = Math.random();
  // Days 1-2: narrow spread so 30M reliably lands 2 strong or 2-3 weaker recruits.
  if (d <= 2){
    if (r < 0.55) return -1 + drift;                                 // 55% cheap
    else          return Math.floor(Math.random() * 2) + drift;      // 45% average (0..1)
  }
  // Day 3+: three visible tiers - bargains, average, and already-trained names that cost more.
  if (r < 0.35)      return -1 + drift;                              // 35% cheap
  else if (r < 0.70) return Math.floor(Math.random() * 2) + drift;   // 35% average (0..1)
  else               return 2 + Math.floor(Math.random() * 3) + drift; // 30% trained-up (2..4)
}
function scaledMember(base, bonus){
  const a = bonus || 0;
  const b = enlistStats(base);                                 // start below their data potential
  return { n:base.n, r:base.r, alt:base.alt || null, c:base.c, sp:base.sp || [],
           p:Math.max(MEMBER_STAT_FLOOR, Math.min(STAT_CAP, b.p + a)), d:Math.max(MEMBER_STAT_FLOOR, Math.min(STAT_CAP, b.d + a)), s:Math.max(MEMBER_STAT_FLOOR, Math.min(STAT_CAP, b.s + a)) };
}

/* everyone who could ever be bought: not a reserved captain, not your captain, not owned */
function buyableFor(save){
  const owned = new Set((save.roster || []).map(m => m.n));
  const ai = aiOwnedNames(save);
  return PIRATES.filter(p => p.r !== "Captain" && !p.navy && p.n !== save.captain && !owned.has(p.n) && !ai.has(p.n));
}
function priceOf(ch){ return memberBounty(ch); }   // value = current bounty (the real worth)
/* OSM-style odds: cheaper asking price sells faster; a low bid is more likely refused */
function sellDayChance(ratio){ return Math.max(5, Math.min(95, Math.round(85 - 182.5 * (ratio - 0.8)))); }
function offerSailChance(ratio){ return Math.max(5, Math.min(92, Math.round((ratio - 0.78) / (1.0 - 0.78) * 100))); }
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
/* Persistent board: members stay listed across days, rotate off after 2 unsold days,
   then return 2 days later (stronger + pricier because stats scale with the day). */
function ensureMarket(save){
  if (!save.market || !Array.isArray(save.market.listings)){
    save.market = { listings:[], cooldown:[], day: save.day || 1 };
    refillMarket(save);
  }
  if (!Array.isArray(save.transferList)) save.transferList = [];   // your players put up for sale
  if (!Array.isArray(save.offers))       save.offers = [];         // your pending bids on rival players
}
function refillMarket(save){
  const day = save.day || 1;
  const listed  = new Set(save.market.listings.map(L => L.n));
  const cooling = new Set(save.market.cooldown.filter(cd => cd.returnDay > day).map(cd => cd.n));
  const owned   = allOwnedNames(save);
  const pool = PIRATES.filter(p => p.r !== "Captain" && !p.navy && !owned.has(p.n) && !listed.has(p.n) && !cooling.has(p.n));
  shuffle(pool, Math.random);   // truly random board, different every game
  for (const p of pool){ if (save.market.listings.length >= MARKET_SIZE) break; save.market.listings.push({ n:p.n, since:day, bonus: rollListingBonus(day) }); }
}
function refreshMarket(save){              // called once when the day advances
  ensureMarket(save);
  const day = save.day || 1;
  const owned = allOwnedNames(save);
  const kept = [];
  save.market.listings.forEach(L => {
    if (owned.has(L.n)) return;                                   // bought/claimed -> off the board
    if (day - L.since >= 2) save.market.cooldown.push({ n:L.n, returnDay: day + 2 }); // unsold 2 days -> cooldown
    else kept.push(L);
  });
  save.market.listings = kept;
  const due = save.market.cooldown.filter(cd => cd.returnDay <= day && !owned.has(cd.n));
  save.market.cooldown = save.market.cooldown.filter(cd => cd.returnDay > day);
  due.forEach(cd => { if (save.market.listings.length < MARKET_SIZE && !save.market.listings.some(L => L.n === cd.n)) save.market.listings.push({ n:cd.n, since:day, bonus: rollListingBonus(day) }); });
  refillMarket(save);
  save.market.day = day;
}
/* the listings, as members scaled to the current day (bought/claimed ones drop off) */
function listedBuyable(save){
  ensureMarket(save);
  const day = save.day || 1;
  const owned = allOwnedNames(save);
  return save.market.listings
    .filter(L => !owned.has(L.n))
    .map(L => { const base = PIRATES.find(p => p.n === L.n); return base ? scaledMember(base, (typeof L.bonus === "number" ? L.bonus : rollListingBonus(day))) : null; })
    .filter(Boolean);
}

function openMarket(save){
  market.save = save;
  market.tab = "buy"; market.role = "All"; market.q = ""; market.sort = "bounty_desc";
  renderMarket();
  showScreen("screen-market");
}

function rivalMembers(save){
  const out = [];
  (save.league && save.league.crews ? save.league.crews : []).forEach((c, idx) => {
    (c.roster || []).forEach(m => out.push({ n:m.n, r:m.r, alt:m.alt || null, p:m.p, d:m.d, s:m.s, c:c.name, _ci: idx + 1 }));
  });
  return out;
}
function baseList(){
  const save = market.save;
  if (market.tab === "buy")   return listedBuyable(save);
  if (market.tab === "scout") return rivalMembers(save);
  return (save.roster || []).slice();
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

function marketRow(p, i, mode, save){
  const value = (mode === "buy") ? priceOf(p) : memberBounty(p);
  const full  = (save.roster || []).length >= 13;
  const nameCell = '<span class="mk-name"><span class="mk-av" style="background:' + colorFor(p.n) + '">' + initial(p.n) + '</span>' +
        '<span class="mk-nmcol"><b>' + escapeHtml(p.n) + '</b>' + (mode === "scout" ? '<span class="mk-sub">' + escapeHtml(p.c || "") + '</span>' : '') + '</span></span>';
  let act = "";
  if (mode === "buy"){
    const dis = full || save.berries < value;
    act = '<button class="mk-rowbtn is-buy" data-i="' + i + '"' + (dis ? ' disabled' : '') + '>Buy</button>';
  } else if (mode === "sell"){
    const L = (save.transferList || []).find(x => x.n === p.n);
    if (L){ const c = sellDayChance(L.ask / Math.max(1, value));
      act = '<span class="mk-listed">Listed ' + fmtShort(L.ask) + ' &middot; ' + c + '%/day</span>' +
            '<button class="mk-rowbtn is-unlist" data-i="' + i + '">Unlist</button>'; }
    else act = '<button class="mk-rowbtn is-list" data-i="' + i + '">List</button>';
  } else { // scout
    const pending = (save.offers || []).find(o => o.n === p.n);
    if (pending) act = '<span class="mk-listed">Offer in ' + fmtShort(pending.offer) + '</span>' +
                       '<button class="mk-rowbtn is-cancel" data-i="' + i + '">Cancel</button>';
    else { const dis = full || save.berries < value;
      act = '<button class="mk-rowbtn is-rbuy" data-i="' + i + '"' + (dis ? ' disabled' : '') + '>Buy</button>' +
            '<button class="mk-rowbtn is-offer" data-i="' + i + '">Offer</button>'; }
  }
  return '<tr>' +
      '<td>' + nameCell + '</td>' +
      '<td>' + escapeHtml(p.r) + '</td>' +
      '<td class="mk-pds">' + p.p + '-' + p.d + '-' + p.s + '</td>' +
      '<td class="mk-bounty">' + fmtShort(value) + '</td>' +
      '<td class="mk-actcell">' + act + '</td>' +
    '</tr>';
}

function renderMarket(){
  const save   = market.save;
  const roster = save.roster || [];
  const full   = roster.length >= 13;
  const isHistory = market.tab === "history";
  const base   = isHistory ? [] : baseList();
  const list   = isHistory ? [] : applyFilters(base.slice());
  market.rendered = list;

  // chips: only roles present in the current tab's base list
  const present = isHistory ? [] : ROLE_ORDER.filter(r => base.some(p => hasRole(p, r)));
  const chips = ["All"].concat(present).map(r =>
    '<span class="mk-chip' + (market.role === r ? ' is-on' : '') + '" data-role="' + r + '">' + r + '</span>'
  ).join("");

  let body;
  if (isHistory){
    body = renderMarketHistory(save);
  } else if (list.length === 0){
    body = '<div class="mk-empty">' + (
      market.tab === "buy"   ? "No listings match your filters." :
      market.tab === "scout" ? "No rival players match your filters." :
                               "Your crew is empty &mdash; recruit members on the Buy tab.") + '</div>';
  } else {
    const rows = list.map((p, i) => marketRow(p, i, market.tab, save)).join("");
    body = '<table class="mk-table"><thead><tr>' +
        '<th>Name</th><th>Role</th><th>P-D-S</th><th>Value</th><th class="mk-actcell"></th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>';
  }

  const dayNote =
    market.tab === "buy"   ? '<p class="mk-note">Day ' + (save.day || 1) + ' &middot; new faces arrive on the market each day.' +
        (full ? ' <b>Your crew is full (13 / 13) &mdash; sell someone to recruit.</b>' : '') + '</p>' :
    market.tab === "sell"  ? '<p class="mk-note">List a player around their value. They keep playing until sold &mdash; ask less to sell faster.</p>' :
    market.tab === "scout" ? '<p class="mk-note">Bid on rival players. Pay full value to sign instantly, or offer up to 20% less and wait for their answer.</p>' :
    market.tab === "history" ? '<p class="mk-note">Every signing across the league, newest first.</p>' : '';

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
      '<div class="mk-tab' + (market.tab === "buy"     ? " is-on" : "") + '" data-tab="buy">Buy</div>' +
      '<div class="mk-tab' + (market.tab === "sell"    ? " is-on" : "") + '" data-tab="sell">Sell</div>' +
      '<div class="mk-tab' + (market.tab === "scout"   ? " is-on" : "") + '" data-tab="scout">Scout</div>' +
      '<div class="mk-tab' + (market.tab === "history" ? " is-on" : "") + '" data-tab="history">History</div>' +
    '</div>' +
    (isHistory ? '' :
    '<div class="mk-filters">' +
      '<input class="mk-search" id="mk-search" placeholder="Search by name" value="' + escapeHtml(market.q) + '" />' +
      '<div class="mk-chips">' + chips + '</div>' +
      '<select class="mk-sort" id="mk-sort">' +
        '<option value="bounty_desc"' + (market.sort === "bounty_desc" ? " selected" : "") + '>Bounty: high to low</option>' +
        '<option value="bounty_asc"'  + (market.sort === "bounty_asc"  ? " selected" : "") + '>Bounty: low to high</option>' +
        '<option value="name"'        + (market.sort === "name"        ? " selected" : "") + '>Name (A&ndash;Z)</option>' +
      '</select>' +
    '</div>') +
    dayNote +
    body;

  $("mk-back").addEventListener("click", () => goHome(save));
  els.market.querySelectorAll(".mk-tab").forEach(t =>
    t.addEventListener("click", () => { market.tab = t.dataset.tab; market.role = "All"; renderMarket(); }));
  els.market.querySelectorAll(".mk-chip").forEach(c =>
    c.addEventListener("click", () => { market.role = c.dataset.role; renderMarket(); }));
  const sortSel = $("mk-sort");
  if (sortSel) sortSel.addEventListener("change", () => { market.sort = sortSel.value; renderMarket(); });
  const search = $("mk-search");
  if (search) search.addEventListener("input", () => {
    market.q = search.value;
    renderMarket();
    const s = $("mk-search"); s.focus(); s.setSelectionRange(s.value.length, s.value.length);
  });
  els.market.querySelectorAll(".is-buy").forEach(b =>
    b.addEventListener("click", () => confirmBuy(market.rendered[+b.dataset.i])));
  els.market.querySelectorAll(".is-list").forEach(b =>
    b.addEventListener("click", () => openListModal(market.rendered[+b.dataset.i])));
  els.market.querySelectorAll(".is-unlist").forEach(b =>
    b.addEventListener("click", () => unlistMember(market.rendered[+b.dataset.i].n)));
  els.market.querySelectorAll(".is-rbuy").forEach(b =>
    b.addEventListener("click", () => buyFromRival(market.rendered[+b.dataset.i], 100)));
  els.market.querySelectorAll(".is-offer").forEach(b =>
    b.addEventListener("click", () => openOfferModal(market.rendered[+b.dataset.i])));
  els.market.querySelectorAll(".is-cancel").forEach(b =>
    b.addEventListener("click", () => cancelOffer(market.rendered[+b.dataset.i])));
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
      save.roster.push({ n:ch.n, r:ch.r, alt:ch.alt || null, p:ch.p, d:ch.d, s:ch.s, c:ch.c, sp:ch.sp || [], cond:100, bp:price });
      if (save.market && save.market.listings) save.market.listings = save.market.listings.filter(L => L.n !== ch.n);
      logTransfer(save, save.day, save.crew, "free agent", ch.n, price);
      aiInitialReactiveBuys(save);
      persistSave(save);
      renderMarket();
      openModal({
        title:"Recruited!", danger:false, showCancel:false, confirmLabel:"OK",
        message:ch.n + " has joined your crew and is waiting on the bench. Assign their spot on the Crew page."
      });
    }
  });
}

/* ---- slider modal (asking price / offer) ---- */
function openSliderModal(opt){
  els.modalTitle.textContent = opt.title;
  els.modalMsg.innerHTML =
    '<span style="display:block;margin:2px 0 12px;font-size:14px;color:var(--ink-2,#5a4632)">' + (opt.intro || "") + '</span>' +
    '<span style="display:flex;align-items:center;gap:10px">' +
      '<input id="sl-range" type="range" min="' + opt.minPct + '" max="' + opt.maxPct + '" value="' + opt.startPct + '" step="1" style="flex:1" />' +
      '<b id="sl-price" style="min-width:64px;text-align:right;font-size:18px"></b>' +
    '</span>' +
    '<span id="sl-note" style="display:block;margin-top:10px;font-size:13px;color:var(--ink-2,#5a4632)"></span>';
  els.modalConfirm.textContent = opt.confirmLabel || "Confirm";
  els.modalConfirm.className = "btn-gold-sm";
  els.modalCancel.style.display = "";
  els.overlay.classList.add("is-open");
  els.overlay.setAttribute("aria-hidden", "false");
  const range = $("sl-range");
  const upd = () => { const info = opt.dynamic(+range.value); $("sl-price").innerHTML = info.priceText; $("sl-note").innerHTML = info.noteText; };
  range.addEventListener("input", upd); upd();
  els.modalConfirm.onclick = () => { const pct = +range.value; closeModal(); if (opt.onConfirm) opt.onConfirm(pct); };
  els.modalConfirm.focus();
}

/* ---- sell your own player: list it around its value, sells over time ---- */
function openListModal(m){
  if (!m) return;
  const save = market.save;
  const base = memberBounty(m);
  openSliderModal({
    title:"List " + m.n + " for sale",
    intro: m.n + " &middot; value <b>" + fmtShort(base) + "</b>. Set your asking price (&minus;20% to +20%).",
    minPct:80, maxPct:120, startPct:100, confirmLabel:"List for sale",
    dynamic:(pct) => {
      const price = Math.round(pct / 100 * base / 1e6) * 1e6;
      const c = sellDayChance(pct / 100);
      const lab = c >= 80 ? "fast sale" : c >= 50 ? "fair" : c >= 25 ? "patient" : "ambitious";
      return { priceText: fmtShort(price), noteText: "Sells per day: <b>" + c + "%</b> &middot; " + lab + " &middot; " + pct + "% of value" };
    },
    onConfirm:(pct) => {
      const price = Math.round(pct / 100 * base / 1e6) * 1e6;
      save.transferList = (save.transferList || []).filter(L => L.n !== m.n);
      save.transferList.push({ n:m.n, ask:price });
      persistSave(save); renderMarket();
    }
  });
}
function unlistMember(name){
  const save = market.save;
  save.transferList = (save.transferList || []).filter(L => L.n !== name);
  persistSave(save); renderMarket();
}

/* ---- bid on a rival's player: full price = instant, lower = they decide over days ---- */
function buyFromRival(item, pct){
  if (!item) return;
  const save = market.save;
  const crew = save.league.crews[item._ci - 1];
  if (!crew) return;
  const idx = crew.roster.findIndex(m => m.n === item.n);
  if (idx < 0){ showInfo(item.n + " is no longer with that crew."); renderMarket(); return; }
  const m = crew.roster[idx];
  const value = memberBounty(m);
  const price = Math.round(pct / 100 * value / 1e6) * 1e6;
  if ((save.roster || []).length >= 13){ showInfo("Your crew is full (13 / 13). Sell someone first."); return; }
  if (save.berries < price){ showInfo("Not enough Berries to bid that much for " + m.n + "."); return; }
  if (pct >= 100){
    save.berries -= price; crew.berries = (crew.berries || 0) + price; crew.roster.splice(idx, 1);
    save.roster = save.roster || [];
    save.roster.push({ n:m.n, r:m.r, alt:m.alt || null, p:m.p, d:m.d, s:m.s, c:m.c, sp:m.sp || [], cond:100, bp:price });
    logTransfer(save, save.day, save.crew, crew.name, m.n, price);
    reconcileLineup(save); persistSave(save); renderMarket();
    openModal({ title:"Signed!", confirmLabel:"OK", message: m.n + " joins your crew for " + fmtBerries(price) + ". Assign their spot on the Crew page." });
  } else {
    save.offers = save.offers || [];
    if (save.offers.some(o => o.n === item.n)){ showInfo("You already have an offer in for " + m.n + "."); return; }
    save.offers.push({ ci:item._ci, n:item.n, offer:price, wait:0, max:3 });
    persistSave(save); renderMarket();
    openModal({ title:"Offer submitted", confirmLabel:"OK",
      message:"You offered " + fmtBerries(price) + " for " + m.n + ". " + crew.name + " will think it over &mdash; check back after you sail." });
  }
}
function openOfferModal(item){
  if (!item) return;
  const save = market.save;
  const crew = save.league.crews[item._ci - 1];
  const m = crew && crew.roster.find(x => x.n === item.n);
  if (!m){ showInfo(item.n + " is no longer available."); renderMarket(); return; }
  const base = memberBounty(m);
  openSliderModal({
    title:"Offer for " + m.n,
    intro: m.n + " (" + escapeHtml(crew.name) + ") &middot; value <b>" + fmtShort(base) + "</b>.",
    minPct:80, maxPct:100, startPct:95, confirmLabel:"Submit offer",
    dynamic:(pct) => {
      const price = Math.round(pct / 100 * base / 1e6) * 1e6;
      const note = pct >= 100
        ? "Full price &mdash; the deal goes through <b>immediately</b>."
        : "Accepted each sail: <b>" + offerSailChance(pct / 100) + "%</b> &middot; a low offer may be turned down after a few days.";
      return { priceText: fmtShort(price), noteText: note + " &middot; " + pct + "% of value" };
    },
    onConfirm:(pct) => buyFromRival(item, pct)
  });
}

/* ---- resolved once per day, when you sail ---- */
function resolveTransfers(save){
  if (Array.isArray(save.transferList) && save.transferList.length){
    const kept = [];
    save.transferList.forEach(L => {
      const idx = (save.roster || []).findIndex(m => m.n === L.n);
      if (idx < 0) return;                                            // already gone
      const ratio = L.ask / Math.max(1, memberBounty(save.roster[idx]));
      if (Math.random() * 100 < sellDayChance(ratio)){ save.berries += L.ask; save.roster.splice(idx, 1); pushInbox(save, "sold", L.n + " sold for " + fmtShort(L.ask) + "."); logTransfer(save, save.day, "a rival", save.crew, L.n, L.ask); }
      else kept.push(L);
    });
    save.transferList = kept;
  }
  if (Array.isArray(save.offers) && save.offers.length){
    const kept = [];
    save.offers.forEach(o => {
      const crew = save.league.crews[o.ci - 1]; if (!crew) return;
      const idx = crew.roster.findIndex(m => m.n === o.n); if (idx < 0){ pushInbox(save, "info", "Your offer for " + o.n + " fell through &mdash; they already left."); return; }
      const m = crew.roster[idx];
      const ratio = o.offer / Math.max(1, memberBounty(m));
      if (Math.random() * 100 < offerSailChance(ratio)){
        if ((save.roster || []).length < 13 && save.berries >= o.offer){
          save.berries -= o.offer; crew.berries = (crew.berries || 0) + o.offer; crew.roster.splice(idx, 1);
          (save.roster = save.roster || []).push({ n:m.n, r:m.r, alt:m.alt || null, p:m.p, d:m.d, s:m.s, c:m.c, sp:m.sp || [], cond:100, bp:o.offer });
          pushInbox(save, "accepted", m.n + " accepted your offer of " + fmtShort(o.offer) + " &mdash; signed!");
          logTransfer(save, save.day, save.crew, crew.name, m.n, o.offer);
        } else pushInbox(save, "info", m.n + " accepted, but you couldn't complete the deal (crew full or short on Berries).");
      } else { o.wait++; if (o.wait < o.max) kept.push(o); else pushInbox(save, "rejected", crew.name + " rejected your offer for " + m.n + "."); }
    });
    save.offers = kept;
  }
  maybeAiBidOnYou(save);
  if (save.lineup) reconcileLineup(save);
}
function showNews(save){
  if (!save._news || !save._news.length) return;
  const items = save._news.slice(); save._news = [];
  els.modalMsg.innerHTML = items.map(t => '<span style="display:block;margin:4px 0">&bull; ' + t + '</span>').join("");
  els.modalTitle.textContent = "Transfer news";
  els.modalConfirm.textContent = "OK"; els.modalConfirm.className = "btn-gold-sm";
  els.modalCancel.style.display = "none";
  els.overlay.classList.add("is-open"); els.overlay.setAttribute("aria-hidden", "false");
  els.modalConfirm.onclick = () => closeModal();
  els.modalConfirm.focus();
}

/* ====================================================================
   Crew & line-up  (ship slots + bench, drag & drop)
   ==================================================================== */
const crew = { save:null };
const DECK_ROLES = ["Swordsman","Sniper","Chef","Doctor","Archaeologist",
                    "Shipwright","Musician","Navigator","Helmsman"];
const BENCH_SIZE = 4;
const SLOT_POS = {
  "Swordsman":[27,22], "Sniper":[73,22],
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
  for (const r of DECK_ROLES){ if (!lu.deck[r]){ lu.deck[r] = name; return; } }
  for (let i = 0; i < BENCH_SIZE; i++){ if (!lu.bench[i]){ lu.bench[i] = name; return; } }
}
function reconcileLineup(save){
  const lu = save.lineup;
  const owned = new Set((save.roster || []).map(m => m.n));
  const training = (typeof trainingNames === "function") ? trainingNames(save) : new Set();
  const blocked = (nm) => !owned.has(nm) || training.has(nm);
  DECK_ROLES.forEach(r => { if (lu.deck[r] && blocked(lu.deck[r])) lu.deck[r] = null; });
  for (let i = 0; i < BENCH_SIZE; i++){ if (lu.bench[i] && blocked(lu.bench[i])) lu.bench[i] = null; }
  const placed = new Set([].concat(DECK_ROLES.map(r => lu.deck[r]), lu.bench).filter(Boolean));
  (save.roster || []).forEach(m => { if (!placed.has(m.n) && !training.has(m.n)) placeMember(save, m.n); });
}
function findLineupSlot(save, name){
  const lu = save.lineup; if (!lu) return null;
  for (const r of DECK_ROLES){ if (lu.deck[r] === name) return { type:"deck", key:r }; }
  for (let i = 0; i < BENCH_SIZE; i++){ if (lu.bench[i] === name) return { type:"bench", key:i }; }
  return null;
}
function restoreFromTraining(save, name){
  const lu = save.lineup; if (!lu) return;
  const o = save.training && save.training.origin ? save.training.origin[name] : null;
  if (o && o.type === "deck" && DECK_ROLES.indexOf(o.key) >= 0 && !lu.deck[o.key]) lu.deck[o.key] = name;
  else if (o && o.type === "bench" && o.key < BENCH_SIZE && !lu.bench[o.key]) lu.bench[o.key] = name;
  else placeMember(save, name);
  if (save.training && save.training.origin) delete save.training.origin[name];
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
   League world: schedule, AI crews, condition, matchday, day engine
   ==================================================================== */
const STAT_CAP        = 99;
const AI_COUNT        = 7;
const FIELD_STATS     = ["p", "d", "s"];
const FIELD_LABEL     = { p:"Power", d:"Defense", s:"Speed" };
const FIELD_SLOTS     = 2;             // 2 trainees per field per day -> 6 total
const TRAIN_GAIN      = 3;             // +3 to the field's stat per session
const BATTLE_COND     = 12;            // condition lost by a fighter per battle
const IDLE_RECOVER    = 20;            // condition regained per day when not fighting

const ISLANDS = [
  { d:1,  name:"Windmill Village", type:"normal" },
  { d:2,  name:"Shells Town",      type:"normal" },
  { d:3,  name:"Orange Town",      type:"normal" },
  { d:4,  name:"Syrup Village",    type:"normal" },
  { d:5,  name:"Baratie",          type:"normal" },
  { d:6,  name:"Arlong Park",      type:"rest"   },
  { d:7,  name:"Loguetown",        type:"navy", admiral:"Smoker"   },
  { d:8,  name:"Whisky Peak",      type:"normal" },
  { d:9,  name:"Little Garden",    type:"normal" },
  { d:10, name:"Drum Island",      type:"normal" },
  { d:11, name:"Alabasta",         type:"normal" },
  { d:12, name:"Jaya",             type:"rest"   },
  { d:13, name:"Skypiea",          type:"normal" },
  { d:14, name:"Water Seven",      type:"normal" },
  { d:15, name:"Enies Lobby",      type:"navy", admiral:"Kuzan"    },
  { d:16, name:"Thriller Bark",    type:"normal" },
  { d:17, name:"Sabaody",          type:"normal" },
  { d:18, name:"Amazon Lily",      type:"rest"   },
  { d:19, name:"Impel Down",       type:"normal" },
  { d:20, name:"Marineford",       type:"navy", admiral:"Akainu"   },
  { d:21, name:"Fish-Man Island",  type:"normal" },
  { d:22, name:"Punk Hazard",      type:"normal" },
  { d:23, name:"Dressrosa",        type:"normal" },
  { d:24, name:"Zou",              type:"rest"   },
  { d:25, name:"Whole Cake Island",type:"normal" },
  { d:26, name:"Wano",             type:"normal" },
  { d:27, name:"Egghead",          type:"navy", admiral:"Kizaru"   },
  { d:28, name:"Elbaf",            type:"normal" },
  { d:29, name:"Final Road",       type:"rest"   },
  { d:30, name:"Laugh Tale",       type:"final"  }
];
function islandFor(day){ return (day >= 1 && day <= ISLANDS.length) ? ISLANDS[day - 1] : null; }

/* ---- small utils ---- */
function captainStatsOf(save){ return save.captainStats || CAPTAIN_STATS; }
function condFactor(c){ const v = (typeof c === "number") ? c : 100; return 0.6 + 0.4 * (v / 100); }
function memCond(m){ return (m && typeof m.cond === "number") ? m.cond : 100; }
function growStats(t, dp, dd, ds){
  t.p = Math.min(STAT_CAP, (t.p || 0) + dp);
  t.d = Math.min(STAT_CAP, (t.d || 0) + dd);
  t.s = Math.min(STAT_CAP, (t.s || 0) + ds);
}
function cloneMember(m){ return { n:m.n, r:m.r, alt:m.alt || null, p:m.p, d:m.d, s:m.s, c:m.c, cond:100 }; }
function rngFor(seed){ return seededRng(hash(String(seed))); }
function shuffle(arr, rnd){ for (let i = arr.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }

/* ---- league / AI crews ---- */
function aiOwnedNames(save){
  const s = new Set();
  if (save.league && save.league.crews){
    save.league.crews.forEach(c => { s.add(c.captainName); c.roster.forEach(m => s.add(m.n)); });
  }
  return s;
}
function allOwnedNames(save){
  const s = aiOwnedNames(save);
  s.add(save.captain);
  (save.roster || []).forEach(m => s.add(m.n));
  return s;
}
function aiAffordable(save, crew){
  const owned = allOwnedNames(save);
  return PIRATES.filter(p => p.r !== "Captain" && !p.navy && !owned.has(p.n) &&
                             enlistPrice(p) <= crew.berries && crew.roster.length < 13);
}
function aiBuyOne(save, crew){
  const pool = aiAffordable(save, crew);
  if (!pool.length) return false;
  pool.sort((a, b) => enlistPrice(a) - enlistPrice(b));               // cheapest first: fill the crew, don't blow it on one star
  const idx = Math.floor(Math.pow(Math.random(), 1.3) * pool.length); // bias toward affordable bodies, occasionally reach higher
  const base = pool[Math.min(idx, pool.length - 1)];
  const st   = enlistStats(base);                                     // rivals enlist at the same scaled level you do
  const cost = baseBounty(st);
  crew.berries -= cost;
  crew.roster.push({ n:base.n, r:base.r, alt:base.alt || null, p:st.p, d:st.d, s:st.s, c:base.c, cond:100 });
  crew.bought = true;
  logTransfer(save, save.day, crew.name, "free agent", base.n, cost);
  return true;
}
function aiInitialReactiveBuys(save){
  if (!save.league || save.league.reactiveDone) return;
  save.league.crews.forEach(c => { if (!c.eager && !c.bought) aiBuyOne(save, c); });
  save.league.reactiveDone = true;
}
function aiRecruitGeneric(save, crew){
  // Rivals fill their ranks with their own rank-and-file (generic crewmates), so they never
  // drain the player's transfer market. They start modest and grow through training/battles.
  const rnd = rngFor(save.id + ":air:" + crew.name + ":" + crew.roster.length + ":" + save.day);
  const b   = () => 3 + Math.floor(rnd() * 4);   // 3-6 per stat (sum ~9-18); training/fights take it from there
  crew.roster.push({ n: crew.captainName + "'s crew", r:"Crewmate", alt:null, p:b(), d:b(), s:b(), c:crew.name, cond:100, generic:true });
  crew.bought = true;
}
function aiDailyBuys(save){
  if (!save.league) return;
  const day    = save.day || 1;
  const diff   = aiDifficulty(save);
  const target = Math.min(Math.round(AI_TARGET_SIZE * diff), 2 + Math.floor(day / AI_RAMP));   // slow ramp to a difficulty-scaled size
  save.league.crews.forEach(c => {
    let guard = 0;
    while ((c.roster || []).length < target && guard++ < 3){            // at most +2 members/day
      if (!aiBuyOne(save, c)) break;                                    // real characters from the shared pool; stop if broke / pool empty
    }
  });
}
function generateLeague(save){
  const rnd  = rngFor(save.id + ":league");
  const caps = captainPool().filter(c => c.n !== save.captain);
  shuffle(caps, rnd);
  const crews = [];
  for (let i = 0; i < caps.length; i++){
    const cap = caps[i];
    const name = (cap.c && cap.c !== "Free Agent") ? cap.c : cap.n + "'s Crew";
    crews.push({ name:name, captainName:cap.n, captainStats:{ p:8, d:8, s:8 }, captainCond:100, roster:[],
                 berries: STARTING_BERRIES, eager: rnd() < 0.45, bought:false,
                 growth: 0.85 + rnd() * 0.30, w:0, d:0, l:0, pts:0 });
  }
  save.league = { crews:crews, reactiveDone:false };
  crews.forEach(c => { if (c.eager) aiBuyOne(save, c); });   // eager crews grab one on day 1
}
function aiDifficulty(save){ return DIFFICULTY[(save && save.difficulty) || "normal"] || DIFFICULTY.normal; }
function aiDailyGrowth(save){
  // The AI trains by the same rules as you: each fighter at most once/day (+TRAIN_GAIN to one stat).
  // Captain first, then distinct members, up to 6 sessions/day (your max), scaled by crew form + difficulty.
  const diff = aiDifficulty(save);
  save.league.crews.forEach(c => {
    const cap   = Math.min(FIELD_SLOTS * FIELD_STATS.length, 1 + c.roster.length);   // FIELD_STATS.length=3 -> up to 6
    const slots = Math.max(1, Math.min(cap, Math.round(cap * c.growth * diff)));
    let left = slots;
    const stCap = FIELD_STATS[Math.floor(Math.random() * 3)];                         // captain trains first
    c.captainStats[stCap] = Math.min(STAT_CAP, (c.captainStats[stCap] || 0) + TRAIN_GAIN);
    left--;
    const idx = c.roster.map((_, k) => k); shuffle(idx, Math.random);                 // distinct members, no one twice
    for (let j = 0; j < Math.min(left, idx.length); j++){
      const m = c.roster[idx[j]];
      const stat = FIELD_STATS[Math.floor(Math.random() * 3)];
      m[stat] = Math.min(STAT_CAP, (m[stat] || 0) + TRAIN_GAIN);
    }
  });
}

/* ---- team abstraction (index 0 = you, 1..7 = AI) ---- */
function teamRecord(save, i){ return i === 0 ? save.record : save.league.crews[i - 1]; }
function teamName(save, i){ return i === 0 ? save.crew : save.league.crews[i - 1].name; }
function teamCaptain(save, i){ return i === 0 ? save.captain : save.league.crews[i - 1].captainName; }
function teamMembers(save, i){ return i === 0 ? (save.roster || []) : save.league.crews[i - 1].roster; }
function teamCapStats(save, i){ return i === 0 ? captainStatsOf(save) : save.league.crews[i - 1].captainStats; }
function teamBounty(save, i){
  let t = captainBounty(teamCapStats(save, i), teamMembers(save, i));
  teamMembers(save, i).forEach(m => t += baseBounty(m));
  return t;
}
function condBounty(stats, cond){ return baseBounty(stats) * condFactor(cond); }
function strengthOf(save, i){
  if (i === 0){
    let s = captainBounty(captainStatsOf(save), save.roster || []) * condFactor(save.captainCond);
    DECK_ROLES.forEach(r => { const nm = save.lineup.deck[r]; if (nm){ const m = memberByName(save, nm); if (m) s += condBounty(m, memCond(m)); } });
    return s;
  }
  const c = save.league.crews[i - 1];
  let s = captainBounty(c.captainStats, c.roster) * condFactor(c.captainCond);
  c.roster.forEach(m => s += condBounty(m, memCond(m)));
  return s * AI_STRENGTH;   // rivals punch a little above their bounty so a well-trained player still loses ~1 in 5
}
/* ---- battle resolution (auto for now) ---- */
function invert(res){ return res === "W" ? "L" : res === "L" ? "W" : "D"; }
function applyRecord(rec, res){ if (res === "W"){ rec.w++; rec.pts += 3; } else if (res === "D"){ rec.d++; rec.pts += 1; } else rec.l++; }
function outcome(aStr, bStr){ return (aStr * (0.78 + Math.random() * 0.44)) >= (bStr * (0.78 + Math.random() * 0.44)) ? "W" : "L"; }
function leagueSize(save){ return 1 + (save.league && save.league.crews ? save.league.crews.length : 0); }
function fixturesForDay(save, day){
  let idx = []; for (let i = 0; i < leagueSize(save); i++) idx.push(i);
  if (idx.length % 2) idx.push(-1);                       // odd count -> one crew gets a bye
  const n = idx.length, rot = idx.slice(1), k = (day - 1) % (n - 1);
  const arr = [idx[0]].concat(rot.slice(k)).concat(rot.slice(0, k));
  const pairs = [];
  for (let i = 0; i < n / 2; i++){ const a = arr[i], b = arr[n - 1 - i]; if (a !== -1 && b !== -1) pairs.push([a, b]); }
  return pairs;
}
function growYourFighters(save, won){
  const inc = 1;   // both sides grow equally from a fight; winning earns points + berries, not a stat snowball
  growStats(save.captainStats, inc, inc, inc);
  save.captainCond = Math.max(0, (save.captainCond || 100) - BATTLE_COND);
  DECK_ROLES.forEach(r => { const nm = save.lineup.deck[r]; if (nm){ const m = memberByName(save, nm); if (m){ growStats(m, inc, inc, inc); m.cond = Math.max(0, memCond(m) - BATTLE_COND); } } });
}
function growTeamFighters(save, i, won){
  if (i === 0){ growYourFighters(save, won); return; }
  const c = save.league.crews[i - 1], inc = 1;
  growStats(c.captainStats, inc, inc, inc);
  c.captainCond = Math.max(0, (c.captainCond || 100) - BATTLE_COND);
  c.roster.forEach(m => { growStats(m, inc, inc, inc); m.cond = Math.max(0, memCond(m) - BATTLE_COND); });
}
function navyList(){ return PIRATES.filter(p => p.navy); }
function navyAdmiralsForDay(save){
  const list = navyList().slice();
  shuffle(list, rngFor(save.id + ":navy:" + save.day));
  const out = []; for (let i = 0; i < leagueSize(save); i++) out.push(list[i % list.length]);
  return out;
}
function playerMatchResult(save){
  const md = save.matchday; if (!md || !md.results) return null;
  for (const r of md.results){ if (r.navy){ if (r.team === 0) return r.res; } else { if (r.a === 0) return r.resA; if (r.b === 0) return invert(r.resA); } }
  return null;
}
function resolveMatchday(save){
  const isl = islandFor(save.day);
  const N = leagueSize(save);
  const results = [];
  if (isl.type === "navy"){
    const adms = navyAdmiralsForDay(save);
    let avg = 0; for (let i = 0; i < N; i++) avg += strengthOf(save, i); avg /= N;
    for (let i = 0; i < N; i++){
      const adm = adms[i] || adms[0];
      const wall = avg * ((adm.p + adm.d + adm.s) / 24) * 0.95;   // admirals are real walls; Garp/Akainu the toughest
      const str  = strengthOf(save, i) * (0.85 + Math.random() * 0.3);
      const res  = str > wall ? "W" : "L";
      applyRecord(teamRecord(save, i), res);
      growTeamFighters(save, i, res === "W");
      results.push({ navy:true, team:i, admiral:adm.n, res:res });
    }
  } else {
    fixturesForDay(save, save.day).forEach(([a, b]) => {
      const resA = outcome(strengthOf(save, a), strengthOf(save, b));
      applyRecord(teamRecord(save, a), resA);
      applyRecord(teamRecord(save, b), invert(resA));
      growTeamFighters(save, a, resA === "W");
      growTeamFighters(save, b, invert(resA) === "W");
      results.push({ a:a, b:b, resA:resA });
    });
  }
  save.matchday.results = results;
  save.matchday.played  = true;
  const youRes = playerMatchResult(save);
  save.berries += (youRes === "W") ? MATCH_YOU_WIN : MATCH_YOU_LOSS;   // non-win still pays a small purse; losing hurts in points, not bankruptcy
}

/* ---- day engine ---- */
function recoverConditions(save, full){
  const deck = new Set(DECK_ROLES.map(r => save.lineup.deck[r]).filter(Boolean));
  (save.roster || []).forEach(m => {
    if (full) m.cond = 100;
    else if (!deck.has(m.n)) m.cond = Math.min(100, memCond(m) + IDLE_RECOVER);
  });
  if (full) save.captainCond = 100;
  if (save.league && full) save.league.crews.forEach(c => { c.captainCond = 100; c.roster.forEach(m => m.cond = 100); });
}
const MATCH_INCOME_BASE = 4000000;   // berries every crew earns on a fight day
const MATCH_INCOME_WIN  = 3000000;   // extra for the winner (kept small to avoid market inflation)
const MATCH_YOU_WIN     = 3500000;   // near-flat purse: winning earns points, not a berry snowball
const MATCH_YOU_LOSS    = 3000000;   // loss still pays well -> every crew grows at a similar rate, no body-count runaway
const AI_STRENGTH       = 1.0;       // neutral: difficulty now comes from real AI growth, not a combat fudge
const DIFFICULTY        = { easy:0.7, normal:0.9, hard:1.1 };   // AI development rate (sim-tuned)
const AI_TARGET_SIZE    = 11;        // rivals build toward a near-full crew (members are cheap now); berry-gated in practice
const AI_RAMP           = 2;         // build up quickly toward target
function addBerries(save, i, amt){ if (i === 0) save.berries += amt; else save.league.crews[i - 1].berries += amt; }
function grantMatchIncome(save){
  const md = save.matchday;
  if (!md || !md.results) return;
  const won = new Array(leagueSize(save)).fill(false);
  md.results.forEach(r => { if (r.navy) won[r.team] = r.res === "W"; else { won[r.a] = r.resA === "W"; won[r.b] = invert(r.resA) === "W"; } });
  for (let i = 1; i < leagueSize(save); i++){   // i=0 (you) handled in resolveMatchday; rivals use the same +/-1M rule
    const c = save.league.crews[i - 1];
    c.berries = Math.max(0, (c.berries || 0) + (won[i] ? MATCH_YOU_WIN : MATCH_YOU_LOSS));
  }
}
function endOfDay(save, restful){
  if (!restful) grantMatchIncome(save);
  resolveTraining(save);
  aiDailyGrowth(save);
  aiDailyBuys(save);
  resolveTransfers(save);
  recoverConditions(save, !!restful);
  save.day = (save.day || 1) + 1;
  save.matchday = null;
  refreshMarket(save);
  persistSave(save);
}
function doRestDay(save){
  endOfDay(save, true);
  goHome(save);
}

/* ====================================================================
   Matchday screen (OSM-style fixture blocks)
   ==================================================================== */
const matchday = { save:null };

function openMatchday(save){
  matchday.save = save;
  if (!save.matchday || save.matchday.day !== save.day){
    save.matchday = { day:save.day, played:false, results:null };
    persistSave(save);
  }
  renderMatchday();
  showScreen("screen-matchday");
}
function blockHtml(label, vs, resTxt, you){
  return '<div class="md-block' + (you ? " you" : "") + '">' +
      '<div class="md-side">' + escapeHtml(label) + '</div>' +
      '<div class="md-vs">' + (resTxt || "vs") + '</div>' +
      '<div class="md-side md-side-r">' + escapeHtml(vs) + '</div>' +
    '</div>';
}
function renderMatchday(){
  const save = matchday.save;
  const isl  = islandFor(save.day);
  const md   = save.matchday;
  let blocks = "";

  if (isl.type === "navy"){
    if (!md.played){
      for (let i = 0; i < leagueSize(save); i++) blocks += blockHtml(teamName(save, i), "the Navy", "vs &#9883;", i === 0);
    } else {
      md.results.forEach(rr => blocks += blockHtml(teamName(save, rr.team), rr.admiral, rr.res === "W" ? "WON" : "LOST", rr.team === 0));
    }
  } else {
    const pairs = md.played ? md.results.map(r => [r.a, r.b]) : fixturesForDay(save, save.day);
    pairs.forEach((pr, idx) => {
      const a = pr[0], b = pr[1], you = (a === 0 || b === 0);
      let res = null;
      if (md.played){ const r = md.results[idx]; res = r.resA + " - " + invert(r.resA); }
      blocks += blockHtml(teamName(save, a), teamName(save, b), res, you);
    });
  }

  const action = !md.played
    ? '<button class="btn-gold md-go" id="md-start" type="button">Start battle</button>'
    : '<button class="btn-gold md-go" id="md-hub" type="button">Back to hub &#9654;</button>';

  const warn = (!md.played && trainingNames(save).size > 0)
    ? '<p class="md-warn">Heads up: ' + trainingNames(save).size + ' crew member(s) are still in training and will sit this fight out.</p>'
    : (md.played ? '<p class="md-warn" style="background:rgba(47,143,83,.16);border-color:#2f8f53;color:#cfeede">Matchday done. Train your crew if you like, then sail to the next island from the hub.</p>' : '');

  els.matchday.innerHTML =
    '<div class="md-top">' +
      '<div><div class="md-title">Day ' + save.day + ' &middot; ' + escapeHtml(isl.name) + '</div>' +
      '<div class="md-sub">' + (isl.type === "navy" ? "Marine base &mdash; each crew faces their own Admiral" : "Matchday fixtures") + '</div></div>' +
      '<button class="btn-ghost" id="md-back" type="button">Back</button>' +
    '</div>' +
    warn +
    '<div class="md-grid">' + blocks + '</div>' +
    '<div class="md-action">' + action + '</div>';

  $("md-back").addEventListener("click", () => goHome(save));
  const st = $("md-start");
  if (st) st.addEventListener("click", () => openBattle(save));
  const hb = $("md-hub");
  if (hb) hb.addEventListener("click", () => goHome(save));
}

/* ====================================================================
   League screen (read-only standings + crew inspection)
   ==================================================================== */
const league = { save:null, sort:"pts", view:null };

function openLeague(save){ league.save = save; league.sort = "pts"; league.view = null; renderLeague(); showScreen("screen-league"); }

function standingsRows(save){
  const rows = [];
  for (let i = 0; i < leagueSize(save); i++){
    const rec = teamRecord(save, i);
    rows.push({ i:i, name:teamName(save, i), w:rec.w, d:rec.d, l:rec.l, pts:rec.pts,
                bounty:teamBounty(save, i), count:teamMembers(save, i).length, you:i === 0 });
  }
  if (league.sort === "bounty")      rows.sort((a, b) => b.bounty - a.bounty);
  else if (league.sort === "members") rows.sort((a, b) => b.count - a.count);
  else                                rows.sort((a, b) => b.pts - a.pts || b.bounty - a.bounty);
  return rows;
}
function renderLeague(){
  const save = league.save;
  if (league.view !== null){ renderCrewDetail(save, league.view); return; }
  const rows = standingsRows(save);
  const body = rows.map((r, n) =>
    '<tr class="' + (r.you ? "you" : "") + '" data-crew="' + r.i + '">' +
      '<td class="lg-pos">' + (n + 1) + '</td>' +
      '<td class="l lg-name">' + escapeHtml(r.name) + '</td>' +
      '<td>' + r.w + '</td><td>' + r.l + '</td>' +
      '<td class="lg-pts">' + r.pts + '</td>' +
      '<td>' + r.count + '</td>' +
      '<td>' + fmtShort(r.bounty) + '</td>' +
    '</tr>'
  ).join("");

  const sortBtn = (key, lbl) => '<button class="lg-sort' + (league.sort === key ? " on" : "") + '" data-sort="' + key + '">' + lbl + '</button>';

  els.league.innerHTML =
    '<div class="lg-top">' +
      '<span class="lg-h">League &mdash; Day ' + save.day + ' / 30</span>' +
      '<button class="btn-ghost" id="lg-back" type="button" style="margin-left:auto">Back</button>' +
    '</div>' +
    '<div class="lg-sortbar">Sort: ' + sortBtn("pts", "Points") + sortBtn("bounty", "Bounty") + sortBtn("members", "Crew size") + '</div>' +
    '<table class="lg-table"><thead><tr>' +
      '<th>#</th><th class="l">Crew</th><th>W</th><th>L</th><th>Pts</th><th>Sz</th><th>Bounty</th>' +
    '</tr></thead><tbody>' + body + '</tbody></table>' +
    '<p class="lg-hint">Tap a crew to inspect their full roster.</p>';

  $("lg-back").addEventListener("click", () => goHome(save));
  els.league.querySelectorAll(".lg-sort").forEach(b => b.addEventListener("click", () => { league.sort = b.dataset.sort; renderLeague(); }));
  els.league.querySelectorAll("[data-crew]").forEach(tr => tr.addEventListener("click", () => { league.view = +tr.dataset.crew; renderLeague(); }));
}
function renderCrewDetail(save, i){
  const cap = teamCaptain(save, i), cs = teamCapStats(save, i);
  const rowFor = (nm, role, st, bounty) =>
    '<tr><td class="l"><span class="mk-name"><span class="mk-av" style="background:' + colorFor(nm) + '">' + initial(nm) + '</span><b>' + escapeHtml(nm) + '</b></span></td>' +
    '<td>' + escapeHtml(role) + '</td><td class="mk-pds">' + st.p + '-' + st.d + '-' + st.s + '</td>' +
    '<td class="mk-bounty">' + fmtShort(bounty) + '</td></tr>';
  const rows = [ rowFor(cap, "Captain", cs, captainBounty(cs, teamMembers(save, i))) ]
    .concat(teamMembers(save, i).map(m => rowFor(m.n, m.r, m, baseBounty(m)))).join("");
  els.league.innerHTML =
    '<div class="lg-top">' +
      '<span class="lg-h">' + escapeHtml(teamName(save, i)) + '</span>' +
      '<button class="btn-ghost" id="lg-toback" type="button" style="margin-left:auto">Back to standings</button>' +
    '</div>' +
    '<table class="mk-table"><thead><tr><th class="l">Name</th><th>Role</th><th>P-D-S</th><th>Bounty</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table>';
  $("lg-toback").addEventListener("click", () => { league.view = null; renderLeague(); });
}

/* ====================================================================
   Training grounds  (Power / Defense / Speed fields, day-based)
   ==================================================================== */
const training = { save:null, pending:null };

function trainingNames(save){
  const s = new Set();
  if (save.training){ FIELD_STATS.forEach(f => (save.training[f] || []).forEach(n => { if (n) s.add(n); })); }
  return s;
}
function ensureTraining(save){
  if (!save.training || !Array.isArray(save.training.p)){
    save.training = { p:[null, null], d:[null, null], s:[null, null] };
  }
  if (!save.training.origin) save.training.origin = {};
  const owned = new Set((save.roster || []).map(m => m.n));
  owned.add(save.captain);
  FIELD_STATS.forEach(f => { for (let i = 0; i < FIELD_SLOTS; i++){ const nm = save.training[f][i]; if (nm && !owned.has(nm)) save.training[f][i] = null; } });
}
function availableForTraining(save){
  const busy = trainingNames(save);
  const list = [{ n:save.captain, role:"Captain", stats:captainStatsOf(save), cap:true }];
  (save.roster || []).forEach(m => list.push({ n:m.n, role:m.r, stats:m, cap:false }));
  return list.filter(x => !busy.has(x.n));
}
function resolveTraining(save){
  const done = [];
  FIELD_STATS.forEach(f => {
    for (let i = 0; i < FIELD_SLOTS; i++){
      const nm = save.training[f][i];
      if (!nm) continue;
      const inc = { p:0, d:0, s:0 }; inc[f] = TRAIN_GAIN;
      if (nm === save.captain) growStats(save.captainStats, inc.p, inc.d, inc.s);
      else { const m = memberByName(save, nm); if (m) growStats(m, inc.p, inc.d, inc.s); if (done.indexOf(nm) < 0) done.push(nm); }
      save.training[f][i] = null;
    }
  });
  if (save.lineup){ done.forEach(nm => restoreFromTraining(save, nm)); reconcileLineup(save); }
}

function openTraining(save){ training.save = save; ensureTraining(save); training.pending = null; renderTraining(); showScreen("screen-training"); }

function placeTrainee(f, i, name){
  const save = training.save;
  const slot = findLineupSlot(save, name);
  FIELD_STATS.forEach(ff => { for (let k = 0; k < FIELD_SLOTS; k++) if (save.training[ff][k] === name) save.training[ff][k] = null; });
  save.training[f][i] = name;
  training.pending = null;
  save.training.origin = save.training.origin || {};
  if (slot) save.training.origin[name] = slot;
  if (save.lineup) reconcileLineup(save);
  persistSave(save);
  renderTraining();
}
function removeTrainee(f, i){
  const save = training.save;
  const nm = save.training[f][i];
  save.training[f][i] = null;
  if (save.lineup){ if (nm && nm !== save.captain) restoreFromTraining(save, nm); reconcileLineup(save); }
  persistSave(save);
  renderTraining();
}
function autoFillTraining(save){
  ensureTraining(save);
  const open = {}; FIELD_STATS.forEach(f => { open[f] = 0; for (let i = 0; i < FIELD_SLOTS; i++) if (!save.training[f][i]) open[f]++; });
  let totalOpen = 0; FIELD_STATS.forEach(f => totalOpen += open[f]);
  if (totalOpen === 0) return 0;
  // each available crewmate, with their stats ranked lowest -> highest (ties keep P,D,S order)
  const ranked = availableForTraining(save).map(x => ({
    name: x.n,
    order: FIELD_STATS.slice().sort((a, b) => (x.stats[a] - x.stats[b]) || (FIELD_STATS.indexOf(a) - FIELD_STATS.indexOf(b))),
    done: false
  }));
  save.training.origin = save.training.origin || {};
  let placed = 0;
  const assign = (name, f) => {
    for (let i = 0; i < FIELD_SLOTS; i++){
      if (!save.training[f][i]){
        const slot = findLineupSlot(save, name);
        save.training[f][i] = name;
        if (slot) save.training.origin[name] = slot;
        open[f]--; placed++;
        return true;
      }
    }
    return false;
  };
  // Pass 1: everyone into their single lowest stat (where there's room)
  ranked.forEach(r => { if (!r.done && open[r.order[0]] > 0 && assign(r.name, r.order[0])) r.done = true; });
  // Pass 2: overflow into the next-lowest stat that still has room
  ranked.forEach(r => { if (r.done) return; for (let k = 1; k < r.order.length; k++){ if (open[r.order[k]] > 0 && assign(r.name, r.order[k])){ r.done = true; break; } } });
  if (placed > 0){ if (save.lineup) reconcileLineup(save); persistSave(save); }
  return placed;
}

function trainSlotHtml(f, i){
  const save = training.save;
  const nm = save.training[f][i];
  const p = training.pending;
  const pendSlot = p && p.kind === "slot" && p.f === f && p.i === i;
  const wantSlot = p && p.kind === "trainee";
  if (nm){
    return '<div class="ts filled" data-rm="' + f + ':' + i + '">' +
        '<span class="ts-dot" style="background:' + colorFor(nm) + '"></span><span class="ts-nm">' + escapeHtml(nm) + '</span>' +
        '<span class="ts-x">&times;</span>' +
      '</div>';
  }
  return '<div class="ts empty' + (pendSlot ? " pend" : "") + (wantSlot ? " ready" : "") + '" data-slot="' + f + ':' + i + '">' +
    (pendSlot ? "pick a crewmate &darr;" : wantSlot ? "place here &uarr;" : "+ add") + '</div>';
}
function renderTraining(){
  const save = training.save;
  const avail = availableForTraining(save);
  const cols = FIELD_STATS.map(f =>
    '<div class="tcol"><div class="tcol-h tcol-' + f + '">' + FIELD_LABEL[f] + '</div>' +
      [0, 1].map(i => trainSlotHtml(f, i)).join("") +
    '</div>'
  ).join("");
  const chips = avail.length === 0
    ? '<div class="tg-empty">Everyone is already training.</div>'
    : avail.map(x => {
        const isPend = training.pending && training.pending.kind === "trainee" && training.pending.name === x.n;
        return '<button class="av-chip' + (isPend ? " pend" : "") + '" data-train="' + escapeHtml(x.n) + '">' +
          '<span class="av-dot" style="background:' + colorFor(x.n) + '"></span>' +
          '<span class="av-nm">' + escapeHtml(x.n) + (x.cap ? " (Cpt)" : "") + '</span>' +
          '<span class="av-by">' + x.stats.p + "-" + x.stats.d + "-" + x.stats.s + '</span>' +
        '</button>';
      }).join("");

  els.training.innerHTML =
    '<div class="tg-top">' +
      '<div class="tg-id"><div class="tg-av" style="background:' + colorFor(save.captain) + '">' + initial(save.captain) + '</div>' +
        '<div><div class="tg-crew">' + escapeHtml(save.crew) + '</div><div class="tg-cap">Captain ' + escapeHtml(save.captain) + '</div></div></div>' +
      '<div class="tg-bal">' + miniStat("Bounty", fmtShort(totalCrewBounty(save))) + miniStat("Day", String(save.day || 1)) + '</div>' +
      '<div class="tg-actions"><button class="btn-gold-sm" id="tr-auto" type="button">Auto</button>' +
        '<button class="btn-ghost" id="tr-back" type="button">Back</button></div>' +
    '</div>' +
    '<p class="tg-intro">Tap a field slot then a crewmate &mdash; or a crewmate then a slot. Or hit <b>Auto</b> to put each crewmate in their lowest stat. Each session gives +' + TRAIN_GAIN + '; up to 6 per day. Trainees skip the next fight and finish when you sail on.</p>' +
    '<div class="tcols">' + cols + '</div>' +
    '<div class="tg-avail-t">Available crew</div>' +
    '<div class="tg-avail">' + chips + '</div>';

  $("tr-back").addEventListener("click", () => goHome(save));
  $("tr-auto").addEventListener("click", () => {
    const n = autoFillTraining(save);
    renderTraining();
    if (!n) showInfo(availableForTraining(save).length === 0 ? "Everyone is already training." : "No open training slots &mdash; remove someone first.");
  });
  els.training.querySelectorAll("[data-slot]").forEach(el => el.addEventListener("click", () => {
    const p = el.dataset.slot.split(":"); const f = p[0], i = +p[1];
    if (training.pending && training.pending.kind === "trainee") placeTrainee(f, i, training.pending.name);
    else { training.pending = { kind:"slot", f:f, i:i }; renderTraining(); }
  }));
  els.training.querySelectorAll("[data-rm]").forEach(el => el.addEventListener("click", () => {
    const p = el.dataset.rm.split(":"); removeTrainee(p[0], +p[1]);
  }));
  els.training.querySelectorAll("[data-train]").forEach(el => el.addEventListener("click", () => {
    const name = el.dataset.train;
    if (training.pending && training.pending.kind === "slot") placeTrainee(training.pending.f, training.pending.i, name);
    else { training.pending = { kind:"trainee", name:name }; renderTraining(); }
  }));
}

/* ====================================================================
   Battle broadcast  (cinematic playback, commentary by Big News Morgan)
   ==================================================================== */
const battle = { save:null, timer:null, beats:[], idx:0, clock:0, res:"D" };

function spByName(name){
  const key = String(name).replace(/^Admiral /, "");
  const c = (typeof PIRATES !== "undefined") ? PIRATES.find(p => p.n === key) : null;
  return (c && Array.isArray(c.sp)) ? c.sp : [];
}
function fightersOf(save, i){
  const cap = teamCaptain(save, i), cs = teamCapStats(save, i);
  const list = [{ name: cap, sp: spByName(cap), s: cs ? cs.s : 8 }];
  if (i === 0){ DECK_ROLES.forEach(r => { const nm = save.lineup.deck[r]; if (nm){ const m = memberByName(save, nm); list.push({ name:nm, sp: spByName(nm), s: m ? m.s : 8 }); } }); }
  else teamMembers(save, i).forEach(m => list.push({ name:m.n, sp: spByName(m.n), s: m.s }));
  return list;
}
function pick(arr){ return arr[Math.floor(Math.random() * arr.length)]; }

function buildBattleScript(ctx){
  const openT = [
    "Big News Morgan here, live{ISL} &mdash; and we are underway!",
    "Welcome to the brawl{ISL}! Big News Morgan, calling every blow!",
    "The crews square off{ISL} &mdash; this is Big News Morgan!",
    "Steel is drawn{ISL}! Big News Morgan on the scene!"
  ];
  const strikeT = [" comes out swinging at ", " strikes at ", " lunges straight at ", " sets sights on ",
                   " charges in at ", " barrels into ", " unloads on ", " bears down on ", " swings hard at ",
                   " throws everything at ", " makes a move on ", " closes the distance on "];
  const downT   = [" has defeated ", " takes down ", " puts down ", " overpowers ", " lays out ",
                   " sends crashing down ", " knocks out cold ", " finishes off ", " gets the better of ",
                   " drops ", " hammers down ", " leaves no doubt against "];
  const clashT  = [" clashes with ", " trades a flurry of blows with ", " locks horns with ", " squares off against ",
                   " goes toe to toe with ", " grapples with ", " exchanges blows with ", " weaves around ",
                   " stands firm against ", " duels "];
  const capClashT = [
    "Captain against captain &mdash; {A} and {B} face off!",
    "The captains collide! {A} takes on {B}!",
    "{A} squares up to {B} &mdash; captain against captain!",
    "{A} and {B} lock eyes &mdash; a captain's duel!"
  ];
  const meanwhileT = [
    "Meanwhile, {A} lands an attack on {B}!",
    "Elsewhere on the deck, {A} goes after {B}!",
    "Across the deck, {A} takes the fight to {B}!"
  ];
  const finalT = [
    "{A} stands tall over {B} &mdash; the captain falls, it's over!",
    "{A} defeats Captain {B} &mdash; that is the match!",
    "One last blow &mdash; {A} takes down Captain {B}!",
    "{A} finishes Captain {B} &mdash; their crew is broken!"
  ];
  const spStrikeT = [
    "{A} unleashes <i>{BL}</i> on {B}!",
    "{A} hits {B} with <i>{BL}</i>!",
    "{A} lets it rip &mdash; <i>{BL}</i> slams into {B}!",
    "{A} calls out <i>{BL}</i> and catches {B}!"
  ];
  const spFinalT = [
    "{A} ends it with <i>{BL}</i> &mdash; Captain {B} goes down!",
    "<i>{BL}</i>! {A} takes down Captain {B} for the win!",
    "One final <i>{BL}</i> from {A} &mdash; Captain {B} is finished!"
  ];
  const navyToughT = [
    "{ADM} stands alone against the whole crew &mdash; and doesn't flinch!",
    "{ADM} squares up to the entire crew at once!",
    "One Marine, a whole pirate crew &mdash; and {ADM} isn't backing down!"
  ];
  const navyReelT = [
    "At last {ADM} is reeling &mdash; the crew's numbers tell!",
    "It took the whole crew, but {ADM} staggers!",
    "{ADM} can't hold them all off any longer!"
  ];

  // names are tagged by side: your crew green, the opposition red
  const yourNames = new Set(ctx.you.map(f => f.name));
  const tag    = (n) => (yourNames.has(n) ? '<b class="bt-you">' : '<b class="bt-opp">') + n + "</b>";
  const blowMap = {};
  ctx.you.concat(ctx.opp || []).forEach(f => { if (f && f.sp && f.sp.length) blowMap[f.name] = f.sp; });
  if (ctx.isNavy && ctx.admiral){ const a = spByName("Admiral " + ctx.admiral); if (a.length) blowMap["Admiral " + ctx.admiral] = a; }
  const blowFor = (n) => (blowMap[n] && blowMap[n].length) ? pick(blowMap[n]) : null;
  const strike = (A, B) => {
    const bl = blowFor(A);
    if (bl && Math.random() < 0.45) return pick(spStrikeT).replace("{A}", tag(A)).replace("{B}", tag(B)).replace("{BL}", bl);
    return tag(A) + pick(strikeT) + tag(B) + "!";
  };
  const speedMap = {};
  ctx.you.concat(ctx.opp || []).forEach(f => { if (f) speedMap[f.name] = (typeof f.s === "number" ? f.s : 8); });
  if (ctx.isNavy && ctx.admiral){ const a = (typeof PIRATES !== "undefined") ? PIRATES.find(p => p.n === ctx.admiral) : null; speedMap["Admiral " + ctx.admiral] = a ? a.s : 9; }
  const spd = (n) => (typeof speedMap[n] === "number" ? speedMap[n] : 8);
  const dodgeT = [
    "{B} is too quick &mdash; {A}'s attack whiffs!",
    "{B} slips clean past {A}'s strike!",
    "{B} reads it and dodges {A} completely!",
    "{A} swings &mdash; but {B} is already gone!"
  ];
  // flavor strike: a faster target VERY occasionally dodges
  const fstrike = (A, B) => {
    if (spd(B) > spd(A) && Math.random() < 0.12) return pick(dodgeT).replace("{A}", tag(A)).replace("{B}", tag(B));
    return strike(A, B);
  };
  const clash  = (A, B) => tag(A) + pick(clashT)  + tag(B) + "!";
  const downL  = (A, B) => tag(A) + pick(downT)   + tag(B) + "!";
  const T      = (arr, A, B) => pick(arr).replace("{A}", tag(A)).replace("{B}", tag(B));
  const finalBlow = (A, B) => { const bl = blowFor(A); return bl
    ? pick(spFinalT).replace("{A}", tag(A)).replace("{B}", tag(B)).replace("{BL}", bl)
    : T(finalT, A, B); };

  const isl = ctx.island ? " from " + ctx.island : "";
  const youSide = { cap: ctx.you[0].name, members: ctx.you.slice(1).map(f => f.name) };
  const oppSide = ctx.isNavy ? { cap: "Admiral " + ctx.admiral, members: [] }
                             : { cap: ctx.opp[0].name, members: ctx.opp.slice(1).map(f => f.name) };
  const youWins = ctx.res === "W";
  const winner = youWins ? youSide : oppSide;
  const loser  = youWins ? oppSide : youSide;

  const beats = [{ minute:0, kind:"open", text: pick(openT).replace("{ISL}", isl) }];
  let minute = 4;
  const adv    = () => { minute += 2 + Math.floor(Math.random() * 3); };
  const line   = (t) => { beats.push({ minute, text:t }); adv(); };
  const koPair = (A, B) => { beats.push({ minute, text: strike(A, B) }); minute += 2; beats.push({ minute, down:true, text: downL(A, B) }); adv(); };

  if (ctx.isNavy){
    const adm = oppSide.cap, yc = youSide.cap;
    const admTag = () => tag(adm);
    let mem = youSide.members.slice();
    line(T(capClashT, yc, adm));                                   // your captain opens against the admiral
    line(pick(navyToughT).replace("{ADM}", admTag()));             // the admiral takes on the whole crew at once
    if (youWins){
      let losses = mem.length >= 2 ? (1 + (Math.random() < 0.5 ? 1 : 0)) : 0;
      while (losses-- > 0 && mem.length){ const v = pick(mem); line(fstrike(v, adm)); line(fstrike(adm, v)); koPair(adm, v); mem = mem.filter(x => x !== v); }
      mem.slice(0, 3).forEach(m => line(fstrike(m, adm)));          // it takes several of the crew piling on
      if (mem.length) line(fstrike(adm, pick(mem)));                // the admiral is still swinging
      line(pick(navyReelT).replace("{ADM}", admTag()));
      line(T(capClashT, yc, adm));
      line(fstrike(adm, yc));
      beats.push({ minute, text: strike(yc, adm) }); minute += 2;
      beats.push({ minute, down:true, text: finalBlow(yc, adm) });
    } else {
      mem.slice(0, 3).forEach(m => line(fstrike(m, adm)));          // your crew lands hits first
      while (mem.length){ const v = pick(mem); line(clash(v, adm)); koPair(adm, v); mem = mem.filter(x => x !== v); }
      line(T(capClashT, adm, yc));
      line(fstrike(yc, adm));                                       // captain's defiant blow
      beats.push({ minute, text: strike(adm, yc) }); minute += 2;
      beats.push({ minute, down:true, text: finalBlow(adm, yc) });
    }
  } else {
    const wc = winner.cap, lc = loser.cap;
    let wMem = winner.members.slice(), lMem = loser.members.slice();
    // Phase 1 - the captains open the bout (both throw hands)
    line(T(capClashT, wc, lc));
    line(fstrike(lc, wc));                                  // the loser's captain lands an opener too
    if (Math.random() < 0.6) line(fstrike(wc, lc));
    // Phase 2 - "meanwhile" hands the spotlight to the crews
    if (lMem.length) line(T(meanwhileT, wMem.length ? pick(wMem) : wc, pick(lMem)));
    // Phase 3 - the crew melee: blows fly BOTH ways; every loser member falls, the winner loses a few
    let winnerLossesLeft = wMem.length ? Math.floor(Math.random() * wMem.length) : 0, guard = 0;
    while (lMem.length && guard++ < 140){
      if (Math.random() < 0.34){                            // flavor exchange from a random side
        const wA = wMem.length ? pick(wMem) : wc, lA = lMem.length ? pick(lMem) : lc;
        if (Math.random() < 0.5) line(clash(wA, lA));
        else if (Math.random() < 0.5) line(fstrike(lA, wA));   // loser side attacks
        else line(fstrike(wA, lA));                            // winner side attacks
        continue;
      }
      if (winnerLossesLeft > 0 && wMem.length && Math.random() < 0.4){
        const v = pick(wMem); koPair(pick(lMem), v); wMem = wMem.filter(x => x !== v); winnerLossesLeft--; continue;
      }
      const v = pick(lMem); koPair(wMem.length ? pick(wMem) : wc, v); lMem = lMem.filter(x => x !== v);
    }
    // Phase 4 - the captains return for the finish (loser captain fights back first)
    line(T(capClashT, wc, lc));
    line(fstrike(lc, wc));
    if (Math.random() < 0.5) line(clash(wc, lc));
    beats.push({ minute, text: strike(wc, lc) }); minute += 2;
    beats.push({ minute, down:true, text: finalBlow(wc, lc) });
  }

  const winName = youWins ? '<b class="bt-you">' + ctx.youName + '</b>' : '<b class="bt-opp">' + ctx.oppName + '</b>';
  beats.push({ minute: minute + 3, kind:"close", text: "That's the final bell &mdash; " + winName + " win the day!" });
  beats.sort((a, b) => a.minute - b.minute);
  return beats;
}

/* ---- fight report (shown after each of your matches) ---- */
function capturePlayerFighters(save){
  const cs = captainStatsOf(save);
  const out = [{ name:save.captain, cap:true, p:cs.p, d:cs.d, s:cs.s }];
  DECK_ROLES.forEach(r => { const nm = save.lineup.deck[r]; if (nm){ const m = memberByName(save, nm); if (m) out.push({ name:m.n, cap:false, p:m.p, d:m.d, s:m.s }); } });
  return out;
}
function buildMatchReport(save, pre){
  const res = playerMatchResult(save);
  const berry = res === "W" ? MATCH_YOU_WIN : MATCH_YOU_LOSS;
  const rows = [];
  pre.forEach(f => {
    const now = f.cap ? captainStatsOf(save) : memberByName(save, f.name);
    if (!now) return;
    if (now.p !== f.p || now.d !== f.d || now.s !== f.s)
      rows.push({ name:f.name, cap:f.cap, from:{ p:f.p, d:f.d, s:f.s }, to:{ p:now.p, d:now.d, s:now.s } });
  });
  return { res:res, berry:berry, rows:rows };
}
function showMatchReport(save, rep, after){
  const d = (lbl, a, b) => a === b ? '' : '<span class="fr-d">' + lbl + ' ' + a + '&rarr;<b>' + b + '</b></span>';
  const rows = rep.rows.map(r =>
    '<div class="fr-row"><span class="mk-av" style="background:' + colorFor(r.name) + '">' + initial(r.name) + '</span>' +
    '<span class="fr-nm">' + escapeHtml(r.name) + (r.cap ? ' <span class="fr-cap">(cpt)</span>' : '') + '</span>' +
    '<span class="fr-deltas">' + d('P', r.from.p, r.to.p) + d('D', r.from.d, r.to.d) + d('S', r.from.s, r.to.s) + '</span></div>'
  ).join("");
  const win = rep.res === "W", lose = rep.res === "L";
  const berryTxt = (rep.berry >= 0 ? '+' : '\u2212') + fmtShort(Math.abs(rep.berry)) + ' Berry';
  els.modalTitle.textContent = "Fight report";
  els.modalMsg.innerHTML =
    '<div class="fr-head"><span class="fr-badge ' + (win ? 'win' : lose ? 'lose' : '') + '">' +
      (win ? 'Victory' : lose ? 'Defeat' : 'Draw') + '</span>' +
      '<span class="fr-berry ' + (rep.berry >= 0 ? 'up' : 'down') + '">' + berryTxt + '</span></div>' +
    (rows ? '<div class="fr-sub">Your crew grew</div><div class="fr-list">' + rows + '</div>' : '<div class="fr-sub">No stat changes this fight.</div>');
  els.modalConfirm.textContent = "Continue"; els.modalConfirm.className = "btn-gold-sm";
  els.modalCancel.style.display = "none";
  els.overlay.classList.add("is-open"); els.overlay.setAttribute("aria-hidden", "false");
  const _frm = els.overlay.querySelector(".modal"); if (_frm) _frm.classList.add("wide");
  els.modalConfirm.onclick = () => { closeModal(); if (after) after(); };
  els.modalConfirm.focus();
}

/* ---- inbox / notifications ---- */
function pushInbox(save, type, text, action){
  save.inbox = save.inbox || [];
  save._inboxSeq = (save._inboxSeq || 0) + 1;
  save.inbox.unshift({ id:"m" + save._inboxSeq, day:save.day || 1, type:type, text:text, read:false, action:action || null });
  if (save.inbox.length > 60) save.inbox.length = 60;
}
function logTransfer(save, day, buyer, seller, member, amount){
  save.transfers = save.transfers || [];
  save.transfers.unshift({ day:day || save.day || 1, buyer:buyer, seller:seller, member:member, amount:amount || 0 });
  if (save.transfers.length > 250) save.transfers.length = 250;
}
function renderMarketHistory(save){
  const list = save.transfers || [];
  if (!list.length) return '<div class="mk-empty">No transfers yet. Signings across the league will show up here, newest first.</div>';
  const days = [];
  list.forEach(t => { let g = days.find(d => d.day === t.day); if (!g){ g = { day:t.day, items:[] }; days.push(g); } g.items.push(t); });
  return '<div class="th-wrap">' + days.map(g =>
    '<div class="th-day"><div class="th-dayh">Day ' + g.day + '</div>' +
    g.items.map(t => {
      const you = (t.buyer === save.crew || t.seller === save.crew);
      const fromFree = !t.seller || t.seller === "free agent";
      return '<div class="th-row' + (you ? ' th-you' : '') + '">' +
        '<span class="mk-av" style="background:' + colorFor(t.buyer) + '">' + initial(t.buyer) + '</span>' +
        '<span class="th-txt"><b>' + escapeHtml(t.buyer) + '</b> signed ' + escapeHtml(t.member) +
          (fromFree ? ' <span class="th-free">(free agent)</span>' : ' from ' + escapeHtml(t.seller)) + '</span>' +
        '<span class="th-amt">' + fmtShort(t.amount) + '</span></div>';
    }).join("") + '</div>'
  ).join("") + '</div>';
}
function maybeAiBidOnYou(save){
  const roster = save.roster || [];
  if (roster.length < 2) return;
  if (Math.random() > 0.4) return;
  const crews = (save.league && save.league.crews) || [];
  let best = null;
  crews.forEach((c, idx) => { if ((c.roster || []).length < 13 && (!best || (c.berries || 0) > best.berries)) best = { name:c.name, ci:idx + 1, berries:c.berries || 0 }; });
  if (!best || best.berries < 8000000) return;
  let target = null;
  roster.forEach(m => { const v = memberBounty(m); if (!target || v > target.v) target = { m:m, v:v }; });
  if (!target) return;
  if ((save.inbox || []).some(x => x.type === "bid" && x.action && !x.action.resolved && x.action.member === target.m.n)) return;
  let amount = Math.round(target.v * (0.9 + Math.random() * 0.25) / 1e6) * 1e6;
  amount = Math.min(best.berries, amount);
  if (amount < Math.round(target.v * 0.6)) return;
  pushInbox(save, "bid", escapeHtml(best.name) + " want to sign " + escapeHtml(target.m.n) + " &mdash; they bid " + fmtShort(amount) + ".", { kind:"bid", member:target.m.n, ci:best.ci, amount:amount, resolved:false });
}
function openInbox(save){
  (save.inbox || []).forEach(x => x.read = true);
  renderInbox(save);
  persistSave(save);
}
function inboxTag(t){
  const map = { bid:["Bid","ib-bid"], accepted:["Signed","ib-ok"], rejected:["Rejected","ib-no"], sold:["Sold","ib-sold"], cancelled:["Cancelled","ib-grey"], info:["Note","ib-grey"] };
  const x = map[t] || map.info; return '<span class="ib-tag ' + x[1] + '">' + x[0] + '</span>';
}
function renderInbox(save){
  const list = save.inbox || [];
  let html;
  if (!list.length) html = '<div class="ib-empty">No messages yet. Offers, sales and rival bids show up here.</div>';
  else html = '<div class="ib-list">' + list.map(msg => {
    const open = msg.type === "bid" && msg.action && !msg.action.resolved;
    const act = open
      ? '<div class="ib-act"><button class="btn-gold-sm ib-accept" data-id="' + msg.id + '">Accept</button>' +
        '<button class="ib-decline" data-id="' + msg.id + '">Decline</button></div>' : '';
    return '<div class="ib-row">' + inboxTag(msg.type) +
      '<div class="ib-body"><div class="ib-txt">' + msg.text + '</div>' + act + '</div>' +
      '<span class="ib-day">Day ' + msg.day + '</span></div>';
  }).join("") + '</div>';
  els.modalTitle.textContent = "Inbox";
  els.modalMsg.innerHTML = html;
  els.modalConfirm.textContent = "Close"; els.modalConfirm.className = "btn-gold-sm";
  els.modalCancel.style.display = "none";
  els.overlay.classList.add("is-open"); els.overlay.setAttribute("aria-hidden", "false");
  const _ibm = els.overlay.querySelector(".modal"); if (_ibm) _ibm.classList.add("wide");
  els.modalConfirm.onclick = () => closeModal();
  els.modalMsg.querySelectorAll(".ib-accept").forEach(b => b.addEventListener("click", () => inboxAccept(save, b.dataset.id)));
  els.modalMsg.querySelectorAll(".ib-decline").forEach(b => b.addEventListener("click", () => inboxDecline(save, b.dataset.id)));
  els.modalConfirm.focus();
}
function inboxFind(save, id){ return (save.inbox || []).find(x => x.id === id); }
function inboxAccept(save, id){
  const msg = inboxFind(save, id); if (!msg || !msg.action || msg.action.resolved) return;
  const a = msg.action;
  const idx = (save.roster || []).findIndex(m => m.n === a.member);
  if (idx < 0){ a.resolved = true; msg.type = "info"; msg.text = a.member + " already left your crew."; renderInbox(save); persistSave(save); return; }
  const crew = save.league.crews[a.ci - 1];
  const m = save.roster[idx];
  save.berries += a.amount;
  save.roster.splice(idx, 1);
  if (crew){ crew.berries = Math.max(0, (crew.berries || 0) - a.amount); crew.roster.push({ n:m.n, r:m.r, alt:m.alt || null, p:m.p, d:m.d, s:m.s, c:crew.name, sp:m.sp || [], cond:100 }); }
  if (save.lineup) reconcileLineup(save);
  a.resolved = true; msg.type = "sold";
  msg.text = "You sold " + m.n + " to " + (crew ? crew.name : "a rival") + " for " + fmtShort(a.amount) + ".";
  logTransfer(save, save.day, crew ? crew.name : "a rival", save.crew, m.n, a.amount);
  renderInbox(save); persistSave(save);
}
function inboxDecline(save, id){
  const msg = inboxFind(save, id); if (!msg || !msg.action || msg.action.resolved) return;
  msg.action.resolved = true; msg.type = "info";
  msg.text = "You turned down the bid for " + msg.action.member + ".";
  renderInbox(save); persistSave(save);
}
function cancelOffer(item){
  if (!item) return;
  const save = market.save;
  const i = (save.offers || []).findIndex(o => o.n === item.n);
  if (i < 0){ renderMarket(); return; }
  const o = save.offers[i]; save.offers.splice(i, 1);
  pushInbox(save, "cancelled", "You cancelled your offer for " + escapeHtml(item.n) + " (" + fmtShort(o.offer) + ").");
  persistSave(save); renderMarket();
}

/* ---- tournament victory celebration ---- */
function showVictory(save){
  els.modalTitle.textContent = "Champion";
  els.modalMsg.innerHTML =
    '<div class="vc-wrap">' +
      '<svg class="vc-crown" width="54" height="46" viewBox="0 0 24 24" fill="#e0a52a" aria-hidden="true"><path d="M2 7l4 3.2L12 3l6 7.2L22 7l-2 12H4L2 7z"/></svg>' +
      '<div class="vc-title">King of the Pirates!</div>' +
      '<div class="vc-sub">' + escapeHtml(save.crew) + ' conquered the Grand Tournament.</div>' +
      '<div class="vc-chips"><span class="vc-chip">30 days sailed</span><span class="vc-chip">Tournament won</span></div>' +
    '</div>';
  els.modalConfirm.textContent = "Glorious!"; els.modalConfirm.className = "btn-gold-sm";
  els.modalCancel.style.display = "none";
  els.overlay.classList.add("is-open"); els.overlay.setAttribute("aria-hidden", "false");
  els.modalConfirm.onclick = () => closeModal();
  els.modalConfirm.focus();
}

function openBattle(save){
  const isl = islandFor(save.day);
  if (!save.matchday || save.matchday.day !== save.day){ save.matchday = { day:save.day, played:false, results:null }; }
  let _report = null;
  if (!save.matchday.played){ const _pre = capturePlayerFighters(save); resolveMatchday(save); _report = buildMatchReport(save, _pre); persistSave(save); }
  battle.report = _report;

  let res = "D", oppIndex = null, admiral = null;
  if (isl.type === "navy"){ const mine = save.matchday.results.find(r => r.team === 0); res = mine.res; admiral = mine.admiral; }
  else {
    const idx = fixturesForDay(save, save.day).findIndex(p => p[0] === 0 || p[1] === 0);
    const pr = fixturesForDay(save, save.day)[idx]; oppIndex = pr[0] === 0 ? pr[1] : pr[0];
    const r = save.matchday.results[idx]; res = pr[0] === 0 ? r.resA : invert(r.resA);
  }
  battle.save = save; battle.res = res; battle.onContinue = null;
  battle.beats = buildBattleScript({
    you: fightersOf(save, 0),
    opp: oppIndex !== null ? fightersOf(save, oppIndex) : [],
    isNavy: isl.type === "navy", admiral: admiral, island: isl.name,
    youName: save.crew, oppName: isl.type === "navy" ? ("Admiral " + admiral) : teamName(save, oppIndex), res: res
  });
  battle.idx = 0; battle.clock = 0;
  battle.lastMin = battle.beats[battle.beats.length - 1].minute || 90;
  battle.baseTick = Math.max(45, Math.min(420, Math.round(26000 / battle.lastMin)));  // ~26s playback regardless of length

  renderBattleFrame(isl, oppIndex, admiral);
  showScreen("screen-battle");
  battle.speed = 1;
  startBattleTimer();
}
function startBattleTimer(){
  if (battle.timer) clearInterval(battle.timer);
  battle.timer = setInterval(battleTick, Math.round(battle.baseTick / battle.speed));
}
function renderBattleFrame(isl, oppIndex, admiral){
  const save = battle.save;
  const oppName = isl.type === "navy" ? ("Admiral " + admiral) : teamName(save, oppIndex);
  const oppColor = isl.type === "navy" ? "#1565c0" : colorFor(oppName);
  els.battle.innerHTML =
    '<div class="bt-top">' +
      '<div class="bt-team"><span class="bt-av" style="background:' + colorFor(save.crew) + '">' + initial(save.crew) + '</span>' +
        '<span class="bt-nm">' + escapeHtml(save.crew) + '</span></div>' +
      '<div class="bt-clock"><span id="bt-min">0</span><span class="bt-min-mark">\u2032</span></div>' +
      '<div class="bt-team bt-team-r"><span class="bt-nm">' + escapeHtml(oppName) + '</span>' +
        '<span class="bt-av" style="background:' + oppColor + '">' + initial(oppName) + '</span></div>' +
    '</div>' +
    '<div class="bt-stage">' +
      '<div class="bt-morgan">' +
        '<div class="bt-morgan-av" id="morgan-av">M</div>' +
        '<div class="bt-morgan-nm">Big News Morgan</div>' +
      '</div>' +
      '<div class="bt-line" id="bt-line">&hellip;</div>' +
    '</div>' +
    '<div class="bt-feed" id="bt-feed"></div>' +
    '<div class="bt-result" id="bt-result" style="display:none"></div>' +
    '<div class="bt-action">' +
      '<button class="btn-ghost" id="bt-speed" type="button">x2</button>' +
      '<button class="btn-ghost" id="bt-skip" type="button">Skip &raquo;</button>' +
      '<button class="btn-gold bt-cont" id="bt-cont" type="button" style="display:none">Continue &#9654;</button>' +
    '</div>';
  $("bt-speed").addEventListener("click", () => {
    battle.speed = battle.speed === 1 ? 2 : 1;
    $("bt-speed").textContent = battle.speed === 1 ? "x2" : "x1";
    $("bt-speed").classList.toggle("on", battle.speed === 2);
    if (battle.timer) startBattleTimer();
  });
  $("bt-skip").addEventListener("click", battleSkip);
  $("bt-cont").addEventListener("click", () => {
    if (battle.onContinue){ const cb = battle.onContinue; battle.onContinue = null; cb(); }
    else {
      const rep = battle.report; battle.report = null;
      const go = () => { matchday.save = save; renderMatchday(); showScreen("screen-matchday"); };
      if (rep) showMatchReport(save, rep, go); else go();
    }
  });
}
function emitBeat(b){
  const line = $("bt-line"); const feed = $("bt-feed");
  if (line.dataset.has === "1"){ const old = document.createElement("div"); old.className = "bt-feed-line"; old.innerHTML = line.innerHTML; feed.insertBefore(old, feed.firstChild); }
  line.innerHTML = b.text; line.dataset.has = "1";
  line.classList.toggle("bt-down", !!b.down);
}
function battleTick(){
  battle.clock += 1;
  const m = $("bt-min"); if (m) m.textContent = battle.clock;
  while (battle.idx < battle.beats.length && battle.beats[battle.idx].minute <= battle.clock){ emitBeat(battle.beats[battle.idx]); battle.idx++; }
  if (battle.idx >= battle.beats.length){ clearInterval(battle.timer); battle.timer = null; battleFinish(); }
}
function battleSkip(){
  if (battle.timer){ clearInterval(battle.timer); battle.timer = null; }
  battle.clock = battle.lastMin; const m = $("bt-min"); if (m) m.textContent = battle.lastMin;
  while (battle.idx < battle.beats.length){ emitBeat(battle.beats[battle.idx]); battle.idx++; }
  battleFinish();
}
function battleFinish(){
  const r = $("bt-result");
  const label = battle.res === "W" ? "Victory!" : battle.res === "L" ? "Defeat" : "Draw";
  r.className = "bt-result " + (battle.res === "W" ? "win" : battle.res === "L" ? "loss" : "draw");
  r.textContent = label; r.style.display = "block";
  $("bt-skip").style.display = "none";
  $("bt-speed").style.display = "none";
  $("bt-cont").style.display = "inline-block";
}

/* ====================================================================
   Laugh Tale Grand Tournament (day 30) — single-elimination, top 8 by points
   ==================================================================== */
function seedTournament(save){
  const N = leagueSize(save);
  const order = []; for (let i = 0; i < N; i++) order.push(i);
  order.sort((a, b) => { const ra = teamRecord(save, a), rb = teamRecord(save, b); return (rb.pts - ra.pts) || (teamBounty(save, b) - teamBounty(save, a)); });
  const seeds = order.slice(0, Math.min(8, N));
  if (seeds.indexOf(0) < 0) seeds[seeds.length - 1] = 0;   // you always make the cut
  while (seeds.length < 8) seeds.push(-1);
  const S = seeds;
  const r0 = [ { a:S[0], b:S[7], w:null }, { a:S[3], b:S[4], w:null }, { a:S[2], b:S[5], w:null }, { a:S[1], b:S[6], w:null } ];
  r0.forEach(m => { if (m.b === -1) m.w = m.a; else if (m.a === -1) m.w = m.b; });
  save.tournament = { rounds:[r0], round:0, done:false, champion:null, playerOut:false, outRound:null };
}
function tourResolveAi(save){
  save.tournament.rounds[save.tournament.round].forEach(m => {
    if (m.w == null && m.a !== 0 && m.b !== 0) m.w = (outcome(strengthOf(save, m.a), strengthOf(save, m.b)) === "W") ? m.a : m.b;
  });
}
function tourBuildNext(save){
  const t = save.tournament, rd = t.rounds[t.round];
  if (rd.length === 1){ t.done = true; t.champion = rd[0].w; return; }
  const next = []; for (let i = 0; i < rd.length; i += 2) next.push({ a:rd[i].w, b:rd[i + 1].w, w:null });
  t.rounds.push(next); t.round++; tourResolveAi(save);
}
const TOUR_ROUND_NAMES = ["Quarter-final", "Semi-final", "Final"];
function openTournament(save){
  if (!save.tournament){ seedTournament(save); tourResolveAi(save); persistSave(save); }
  renderTournament(save);
}
function startTournamentMatch(save, oppIndex){
  const res = outcome(strengthOf(save, 0), strengthOf(save, oppIndex));
  battle.save = save; battle.res = res;
  battle.beats = buildBattleScript({
    you: fightersOf(save, 0), opp: fightersOf(save, oppIndex), isNavy:false,
    island:"Laugh Tale", youName: save.crew, oppName: teamName(save, oppIndex), res: res
  });
  battle.idx = 0; battle.clock = 0;
  battle.lastMin = battle.beats[battle.beats.length - 1].minute || 90;
  battle.baseTick = Math.max(45, Math.min(420, Math.round(26000 / battle.lastMin)));
  battle.onContinue = () => advanceTournamentAfterPlayer(save, res);
  renderBattleFrame(islandFor(save.day), oppIndex, null);
  showScreen("screen-battle"); battle.speed = 1; startBattleTimer();
}
function advanceTournamentAfterPlayer(save, res){
  const t = save.tournament, rd = t.rounds[t.round];
  const m = rd.find(x => x.a === 0 || x.b === 0);
  if (m && m.w == null) m.w = (res === "W") ? 0 : (m.a === 0 ? m.b : m.a);
  if (res !== "W"){ t.playerOut = true; t.outRound = TOUR_ROUND_NAMES[Math.min(t.round, 2)]; }
  tourBuildNext(save);
  if (t.playerOut) while (!t.done) tourBuildNext(save);   // no player left: play out to a champion
  persistSave(save);
  renderTournament(save);
  if (t.done && t.champion === 0 && !t._celebrated){ t._celebrated = true; persistSave(save); showVictory(save); }
}
function renderTournament(save){
  const t = save.tournament;
  const youName = save.crew;
  const matchHtml = (m, isPlayerMatch, hide) => {
    const row = (idx) => {
      const decided = m.w != null && !hide;
      const win = decided && m.w === idx;
      const lose = decided && m.w !== idx && idx >= 0;
      const you = idx === 0;
      const cls = "tn-row" + (win ? " tn-win" : "") + (lose ? " tn-lose" : "") + (you ? " tn-you" : "");
      const label = idx < 0 ? "&mdash;" : escapeHtml(teamName(save, idx));
      const av = idx < 0 ? "" : '<span class="mk-av" style="background:' + colorFor(teamName(save, idx)) + '">' + initial(teamName(save, idx)) + '</span>';
      return '<div class="' + cls + '">' + av + '<span>' + label + '</span>' + (win ? '<span class="tn-tick">&#10003;</span>' : (lose ? '<span class="tn-cross">&#10007;</span>' : '')) + '</div>';
    };
    return '<div class="tn-match' + (isPlayerMatch ? ' tn-match-you' : '') + '">' + row(m.a) + row(m.b) + '</div>';
  };
  let cols = "";
  for (let r = 0; r <= t.round; r++){
    const rd = t.rounds[r];
    const isCurrent = (r === t.round) && !t.done;
    const youPending = isCurrent && rd.some(m => (m.a === 0 || m.b === 0) && m.w == null);   // you haven't fought this round yet
    const rows = rd.map(m => {
      const isPlayerMatch = isCurrent && (m.a === 0 || m.b === 0);
      const hide = youPending && !isPlayerMatch;   // keep rival results secret until you've played your own
      return matchHtml(m, isPlayerMatch, hide);
    }).join("");
    cols += '<div class="tn-col"><div class="tn-col-h">' + TOUR_ROUND_NAMES[Math.min(r, 2)] + '</div>' + rows + '</div>';
  }
  if (t.done) cols += '<div class="tn-col"><div class="tn-col-h">Champion</div>' +
      '<div class="tn-champ"><span class="mk-av" style="background:' + colorFor(teamName(save, t.champion)) + '">' + initial(teamName(save, t.champion)) + '</span>' + escapeHtml(teamName(save, t.champion)) + '</div></div>';

  let banner;
  if (t.done){
    banner = (t.champion === 0)
      ? '<div class="tn-banner tn-banner-win">You are the King of the Pirates!</div>'
      : '<div class="tn-banner">' + escapeHtml(teamName(save, t.champion)) + ' win the Grand Tournament.' + (t.playerOut ? ' You went out in the ' + t.outRound + '.' : '') + '</div>';
  } else {
    const rd = t.rounds[t.round];
    const pm = rd.find(x => (x.a === 0 || x.b === 0) && x.w == null);
    banner = '<div class="tn-banner">' + TOUR_ROUND_NAMES[Math.min(t.round, 2)] + ' &mdash; ' + (pm ? 'your match is up!' : 'rivals are battling it out.') + '</div>';
  }

  let action;
  if (t.done) action = '<button class="btn-gold" id="tn-home" type="button">Back to hub</button>';
  else {
    const rd = t.rounds[t.round];
    const pm = rd.find(x => (x.a === 0 || x.b === 0) && x.w == null);
    if (pm) action = '<button class="btn-gold" id="tn-fight" type="button">Fight your ' + TOUR_ROUND_NAMES[Math.min(t.round, 2)].toLowerCase() + ' &#9654;</button>';
    else    action = '<button class="btn-gold" id="tn-next" type="button">Advance to the ' + TOUR_ROUND_NAMES[Math.min(t.round + 1, 2)].toLowerCase() + ' &#9654;</button>';
  }

  els.matchday.innerHTML =
    '<div class="md-top"><span class="md-title">Laugh Tale &mdash; Grand Tournament</span>' +
      '<button class="btn-ghost" id="tn-back" type="button" style="margin-left:auto">Back</button></div>' +
    banner +
    '<div class="tn-bracket">' + cols + '</div>' +
    '<div class="tn-actions">' + action + '</div>';

  $("tn-back").addEventListener("click", () => goHome(save));
  const fb = $("tn-fight");
  if (fb) fb.addEventListener("click", () => {
    const rd = t.rounds[t.round]; const pm = rd.find(x => (x.a === 0 || x.b === 0) && x.w == null);
    startTournamentMatch(save, pm.a === 0 ? pm.b : pm.a);
  });
  const nb = $("tn-next");
  if (nb) nb.addEventListener("click", () => { tourBuildNext(save); persistSave(save); renderTournament(save); });
  const hb = $("tn-home");
  if (hb) hb.addEventListener("click", () => goHome(save));
  showScreen("screen-matchday");
}

/* ---- game setup / migration ---- */
function ensureGame(save){
  if (!save.captainStats) save.captainStats = { p:8, d:8, s:8 };
  if (typeof save.captainCond !== "number") save.captainCond = 100;
  if (!save.record) save.record = { w:0, d:0, l:0, pts:0 };
  const oldFormat = save.league && save.league.crews && save.league.crews[0] &&
                    typeof save.league.crews[0].berries !== "number";
  if (!save.league || !save.league.crews || oldFormat) generateLeague(save);
  ensureTraining(save);
  ensureLineup(save);
  if (!save.market || !Array.isArray(save.market.listings)){ save.market = null; }
  ensureMarket(save);
  persistSave(save);
}


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
  els.league       = $("league-content");
  els.matchday     = $("matchday-content");
  els.battle       = $("battle-content");
  els.berries      = $("start-berries");

  els.overlay      = $("modal-overlay");
  els.modalTitle   = $("modal-title");
  els.modalMsg     = $("modal-msg");
  els.modalConfirm = $("modal-confirm");
  els.modalCancel  = $("modal-cancel");

  els.berries.textContent = fmtBerries(STARTING_BERRIES);

  renderCaptains();
  setupCarousel();
  setupDifficulty();
  renderSavedGames();

  els.crewName.addEventListener("input", validate);
  els.startBtn.addEventListener("click", onStart);
  $("new-game-btn").addEventListener("click", () => showScreen("screen-create"));
  $("create-back").addEventListener("click", () => { showScreen("screen-newgame"); renderSavedGames(); });
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