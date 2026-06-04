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
function totalCrewBounty(save){
  let total = baseBounty(CAPTAIN_STATS);
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
    b.addEventListener("click", () => comingSoon(labels[b.dataset.act]));
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