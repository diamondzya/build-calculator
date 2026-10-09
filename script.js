/* =========================================================
   BuildCalc — Construction Material Calculator
   Vanilla JS · all calculations + localStorage
   Formulas are industry-typical estimates for PH construction.
   ========================================================= */

"use strict";

/* ---------- constants: unit weights (kg/m) for rebar ---------- */
var BAR_WEIGHT = { "10": 0.617, "12": 0.888, "16": 1.580, "20": 2.470 };

/* ---------- paint coverage rates (sqm per liter per coat) ---------- */
var PAINT_COVERAGE = {
  interior:    12,
  exterior:    10,
  primer:       8,
  waterproofing: 6,
  enamel:      11
};
var PAINT_LABEL = {
  interior: "Interior Wall Paint",
  exterior: "Exterior Paint",
  primer: "Primer",
  waterproofing: "Waterproofing Paint",
  enamel: "Enamel Paint"
};
var LITER_PER_GALLON = 3.785;

/* ---------- tile data: cm sizes + pcs per box ---------- */
var TILE_DATA = {
  "30x30": { w: 0.30, h: 0.30, pcsPerBox: 11 },
  "40x40": { w: 0.40, h: 0.40, pcsPerBox: 6 },
  "60x60": { w: 0.60, h: 0.60, pcsPerBox: 4 },
  "30x60": { w: 0.30, h: 0.60, pcsPerBox: 8 }
};

/* ---------- concrete: per-cubic-meter material factors ---------- */
/* mix ratios (cement:sand:gravel by volume) per structural element */
var CONCRETE_MIX = {
  footing: { cement: 0.44, sand: 0.88, gravel: 0.88 }, /* volume fractions of solid per 1 m3, pre-waste */
  column:  { cement: 0.44, sand: 0.88, gravel: 0.88 },
  beam:    { cement: 0.42, sand: 0.84, gravel: 0.84 },
  slab:    { cement: 0.40, sand: 0.80, gravel: 0.80 }
};
var CEMENT_BAG_VOL = 0.035;     /* one 40kg bag ≈ 0.035 m3 */
var WATER_PER_M3   = 165;       /* liters per cubic meter of concrete */

/* ---------- nail: count per meter of run + per board ---------- */
var NAIL_DATA = {
  roofing:  { size: '2-inch', sizeIn: 2, perMeter: 6,  perBoard: 8,  label: "Roofing" },
  framing:  { size: '3-inch', sizeIn: 3, perMeter: 4,  perBoard: 10, label: "Wood Framing" },
  formwork: { size: '2-inch', sizeIn: 2, perMeter: 3,  perBoard: 6,  label: "Concrete Formwork" },
  fence:    { size: '4-inch', sizeIn: 4, perMeter: 2,  perBoard: 5,  label: "Fence" }
};
var KG_PER_NAIL = 0.004; /* ~4 g per common nail, rough average */

/* ---------- module metadata (nav + cards) ---------- */
var MODULES = [
  { id: "steel",     title: "Anilyo / Steel",   fil: "Rebar",       icon: "fa-ruler-combined", desc: "Bars, length & weight for footing, column, beam, slab, stairs, fence." },
  { id: "paint",     title: "Pintura",          fil: "Paint",       icon: "fa-paint-roller",   desc: "Liters, gallons & primer for interior, exterior, waterproofing." },
  { id: "tile",      title: "Tiles",            fil: "Tiles",       icon: "fa-border-all",     desc: "Tile count, boxes, adhesive & grout for your floor area." },
  { id: "nail",      title: "Pako",             fil: "Nails",       icon: "fa-hammer",         desc: "Nail quantity & recommended size for roofing, framing, forms." },
  { id: "concrete",  title: "Semento/Graba",    fil: "Concrete",    icon: "fa-trowel-bricks",  desc: "Cement bags, buhangin, graba & water for your concrete pour." },
  { id: "cost",      title: "Cost",             fil: "Presyo",      icon: "fa-peso-sign",      desc: "Total estimated cost from current prices and saved quantities." },
  { id: "converter", title: "Converter",        fil: "Sukat",       icon: "fa-ruler",          desc: "Meters↔feet, inches↔cm, sqm↔sqft." }
];

var STORE_KEY = "buildcalc.saved.v1";
var PRICE_KEY = "buildcalc.prices.v1";
var QUANT_KEY = "buildcalc.quantities.v1";

/* =========================================================
   Small helpers
   ========================================================= */
function $(sel, root) { return (root || document).querySelector(sel); }
function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
function fmt(n, dec) {
  if (dec === undefined) dec = 2;
  var v = Math.round(n * Math.pow(10, dec)) / Math.pow(10, dec);
  return v.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: dec });
}
function money(n) {
  return "₱" + fmt(n, 2);
}
function ceilInt(n) { return Math.ceil(n); }

/* =========================================================
   Toast
   ========================================================= */
var toastTimer = null;
function toast(msg, icon) {
  var el = $("#toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.innerHTML = (icon ? '<i class="fa-solid ' + icon + '"></i>' : "") + msg;
  el.classList.add("is-show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.classList.remove("is-show"); }, 2600);
}

/* =========================================================
   Storage
   ========================================================= */
function loadJSON(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    if (!raw) return fallback;
    var parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch (e) { return fallback; }
}
function saveJSON(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { toast("Storage full — could not save.", "fa-triangle-exclamation"); }
}

/* =========================================================
   Validation
   ========================================================= */
function readPositive(input, label) {
  var v = num(input.value);
  var bad = input.value.trim() === "" || v < 0;
  if (label && bad) {
    input.classList.add("is-invalid");
    input.setAttribute("aria-invalid", "true");
  } else {
    input.classList.remove("is-invalid");
    input.removeAttribute("aria-invalid");
  }
  return bad ? null : v;
}
function validateForm(form) {
  var firstBad = null;
  $all("input[type='number']", form).forEach(function (inp) {
    var label = inp.closest(".field") ? inp.closest(".field").querySelector("label") : null;
    var v = readPositive(inp, true);
    if (v === null && !firstBad) firstBad = inp;
  });
  return firstBad;
}

/* =========================================================
   View switching
   ========================================================= */
function showView(name) {
  $all(".nav-btn").forEach(function (b) { b.classList.toggle("is-active", b.dataset.view === name); });
  $all(".view").forEach(function (v) { v.classList.toggle("is-active", v.id === "view-" + name); });
  if (name === "saved") renderSaved();
}

/* =========================================================
   Module switching (calculator tabs)
   ========================================================= */
var currentModule = null;

function selectModule(id, silent) {
  currentModule = id;
  $all(".module-btn").forEach(function (b) { b.classList.toggle("is-active", b.dataset.module === id); });
  $all(".calc-form").forEach(function (f) { f.hidden = f.dataset.module !== id; });
  hideResult();
  var form = $('.calc-form[data-module="' + id + '"]');
  if (form && !silent) {
    /* instant recalculation on switching, using current field values */
    if (id === "converter") { updateConverter(); return; }
    if (id === "cost") { runCost(); return; }
    runCalc(form);
  }
}

function buildModuleBar() {
  var bar = $("#module-bar");
  MODULES.forEach(function (m) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "module-btn";
    b.dataset.module = m.id;
    b.setAttribute("role", "tab");
    b.innerHTML = '<i class="fa-solid ' + m.icon + '"></i><span>' + m.title + '</span>';
    b.addEventListener("click", function () { selectModule(m.id); });
    bar.appendChild(b);
  });
}

function buildHomeCards() {
  var grid = $("#home-calc-grid");
  MODULES.filter(function (m) { return m.id !== "cost" && m.id !== "converter"; }).forEach(function (m) {
    var c = document.createElement("button");
    c.type = "button";
    c.className = "calc-card";
    c.innerHTML =
      '<div class="cc-icon"><i class="fa-solid ' + m.icon + '"></i></div>' +
      '<span class="cc-fil">' + m.fil + '</span>' +
      "<h3>" + m.title + "</h3>" +
      "<p>" + m.desc + "</p>";
    c.addEventListener("click", function () {
      showView("calculators");
      selectModule(m.id);
    });
    grid.appendChild(c);
  });
}

/* =========================================================
   RESULTS
   ========================================================= */
var currentResult = null; /* {module, title, sub, rows, totals} */

function showResult(title, sub, rows, totals) {
  currentResult = { title: title, sub: sub, rows: rows, totals: totals };
  $("#result-title").textContent = title;
  $("#result-sub").textContent = sub;
  var body = $("#result-body");
  body.innerHTML = "";

  rows.forEach(function (r) {
    body.appendChild(rowEl(r.label, r.fil, r.value, r.hero));
  });
  if (totals && totals.length) {
    totals.forEach(function (r) { body.appendChild(rowEl(r.label, r.fil, r.value, false, true)); });
  }

  var panel = $("#result-panel");
  panel.hidden = false;
  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function rowEl(label, fil, value, hero, total) {
  var div = document.createElement("div");
  div.className = "result-row" + (hero ? " is-hero" : "") + (total ? " is-total" : "");
  var l = document.createElement("div");
  l.className = "rr-label";
  l.textContent = label;
  if (fil) {
    var f = document.createElement("span");
    f.className = "rr-fil";
    f.textContent = fil;
    l.appendChild(f);
  }
  var v = document.createElement("div");
  v.className = "rr-value";
  v.textContent = value;
  div.appendChild(l);
  div.appendChild(v);
  return div;
}

function hideResult() {
  var p = $("#result-panel");
  if (p) p.hidden = true;
  currentResult = null;
}

/* =========================================================
   CALCULATORS
   ========================================================= */

/* -------- 1. Steel / Anilyo -------- */
function runSteel() {
  var form = $("#form-steel");
  if (validateForm(form)) { toast("Please fill in all measurements.", "fa-triangle-exclamation"); return; }

  var project = $("#steel-project").value;
  var L = num($("#steel-length").value);
  var W = num($("#steel-width").value);
  var H = num($("#steel-height").value);
  var spacingM = num($("#steel-spacing").value) / 100;
  var size = $(".chip.is-active", form) ? $(".chip.is-active", form).dataset.value : "12";

  if (L <= 0 || W <= 0 || H <= 0) { toast("Measurements must be greater than zero.", "fa-triangle-exclamation"); return; }

  /* number of bars across the section, plus 1 for the edge bar */
  var barsAcross = Math.floor(W / spacingM) + 1;
  var barsVertical = Math.floor(H / spacingM) + 1;
  var bars = barsAcross + barsVertical;

  var unitLen = L; /* bar length along the structural length */
  var totalLen = bars * unitLen;
  var weight = totalLen * BAR_WEIGHT[size];
  var stdBar = 12; /* standard commercial bar length, meters */
  var pieces = ceilInt(totalLen / stdBar);

  var projectLabel = $("#steel-project").selectedOptions[0].text.split(" (")[0];

  /* store quantities for the cost calculator */
  storeQuantities("steel", { pieces: pieces, weight: weight });

  showResult(
    "Anilyo / Steel Requirement",
    size + "mm rebar · " + projectLabel + " · spacing " + $("#steel-spacing").value + "cm",
    [
      { label: "Steel Bars Needed", fil: "piraso", value: fmt(bars, 0) + " pcs" },
      { label: "Total Length", fil: "kabuuang haba", value: fmt(totalLen, 1) + " m" },
      { label: "Estimated Weight", fil: "timbang", value: fmt(weight, 1) + " kg", hero: true },
      { label: "Pieces to Buy", fil: "12m bars", value: fmt(pieces, 0) + " pcs" },
      { label: "Unit Weight", fil: size + "mm rebar", value: BAR_WEIGHT[size] + " kg/m" }
    ]
  );
}

/* -------- 2. Paint / Pintura -------- */
function runPaint() {
  var form = $("#form-paint");
  if (validateForm(form)) { toast("Please fill in all measurements.", "fa-triangle-exclamation"); return; }

  var type = $("#paint-type").value;
  var L = num($("#paint-length").value);
  var H = num($("#paint-height").value);
  var walls = num($("#paint-walls").value);
  var coats = num($("#paint-coats").value);

  if (L <= 0 || H <= 0 || walls < 1) { toast("Measurements must be greater than zero.", "fa-triangle-exclamation"); return; }

  var area = L * H * walls;              /* total sqm to paint */
  var coatArea = area * coats;           /* sqm across all coats */
  var coverage = PAINT_COVERAGE[type];   /* sqm per liter */
  var liters = coatArea / coverage;
  var gallons = liters / LITER_PER_GALLON;

  /* primer is one coat at primer coverage, separate from finish */
  var primerLiters = area / PAINT_COVERAGE.primer;
  var primerGallons = primerLiters / LITER_PER_GALLON;

  storeQuantities("paint", { gallons: gallons, liters: liters });

  var message = "Your wall requires approximately " + fmt(liters, 1) + " liters of paint or " +
                fmt(gallons, 1) + " gallon" + (gallons === 1 ? "" : "s") + ".";

  showResult(
    "Painting Area",
    PAINT_LABEL[type] + " · " + fmt(coats, 0) + " coat" + (coats === 1 ? "" : "s"),
    [
      { label: "Total Area to Paint", fil: "kabuuang sukat", value: fmt(area, 1) + " sqm" },
      { label: "Required Paint", fil: "kailangang pintura", value: fmt(liters, 1) + " L", hero: true },
      { label: "Equivalent Gallons", fil: "galon", value: fmt(gallons, 1) + " gal" },
      { label: "Primer Requirement", fil: "primer", value: fmt(primerLiters, 1) + " L / " + fmt(primerGallons, 1) + " gal" }
    ]
  );

  toast(message, "fa-paint-roller");
}

/* -------- 3. Tile -------- */
function runTile() {
  var form = $("#form-tile");
  if (validateForm(form)) { toast("Please fill in all measurements.", "fa-triangle-exclamation"); return; }

  var L = num($("#tile-length").value);
  var W = num($("#tile-width").value);
  var size = $("#tile-size").value;
  var allow = num($("#tile-allowance").value);

  if (L <= 0 || W <= 0) { toast("Measurements must be greater than zero.", "fa-triangle-exclamation"); return; }

  var t = TILE_DATA[size];
  var tileArea = t.w * t.h;
  var area = L * W;
  var baseTiles = area / tileArea;
  var withWaste = baseTiles * (1 + allow);
  var tiles = ceilInt(withWaste);
  var boxes = ceilInt(tiles / t.pcsPerBox);

  /* adhesive: ~1 kg per sqm + 10% wasteage, in 25kg bags */
  var adhesiveKg = area * 1.1;
  var adhesiveBags = ceilInt(adhesiveKg / 25);
  /* grout: ~0.4 kg per sqm */
  var groutKg = area * 0.4;

  storeQuantities("tile", { boxes: boxes, tiles: tiles });

  showResult(
    "Tile Requirement",
    size.replace("x", " × ") + " cm tiles · " + fmt(allow * 100, 0) + "% allowance",
    [
      { label: "Total Floor Area", fil: "kabuuang sukat", value: fmt(area, 1) + " sqm" },
      { label: "Tiles Needed", fil: "kailangang tiles", value: fmt(tiles, 0) + " pcs", hero: true },
      { label: "Boxes Needed", fil: "kahon", value: fmt(boxes, 0) + " boxes" },
      { label: "Tile Adhesive", fil: "pang- dikit", value: adhesiveBags + " bags (25kg)" },
      { label: "Grout", fil: "pang-kulay ng bitak", value: fmt(groutKg, 1) + " kg" }
    ]
  );
}

/* -------- 4. Nail / Pako -------- */
function runNail() {
  var form = $("#form-nail");
  if (validateForm(form)) { toast("Please fill in all measurements.", "fa-triangle-exclamation"); return; }

  var type = $("#nail-material").value;
  var L = num($("#nail-length").value);
  var boards = num($("#nail-boards").value);

  if (L < 0 || boards < 0) { toast("Values cannot be negative.", "fa-triangle-exclamation"); return; }

  var d = NAIL_DATA[type];
  /* nails: per meter of run + per board + spacing adjustment (denser spacing = more nails) */
  var runNails = Math.ceil(L * d.perMeter);
  var boardNails = Math.ceil(boards * d.perBoard);
  var count = runNails + boardNails;
  var kg = count * KG_PER_NAIL;

  storeQuantities("nail", { kg: kg, count: count });

  showResult(
    "Nail Requirement",
    d.label + " · " + d.size + " recommended",
    [
      { label: "Recommended Nail", fil: "rekomendadong pako", value: d.size + " common nail", hero: true },
      { label: "Estimated Nail Count", fil: "bilang ng pako", value: fmt(count, 0) + " pcs" },
      { label: "Estimated Weight", fil: "timbang", value: fmt(kg, 1) + " kg" },
      { label: "From Structure Run", fil: "run = " + fmt(L, 1) + " m", value: fmt(runNails, 0) + " pcs" },
      { label: "From Boards", fil: boards + " boards", value: fmt(boardNails, 0) + " pcs" }
    ]
  );
}

/* -------- 5. Concrete: Cement / Sand / Gravel -------- */
function runConcrete() {
  var form = $("#form-concrete");
  if (validateForm(form)) { toast("Please fill in all measurements.", "fa-triangle-exclamation"); return; }

  var project = $("#conc-project").value;
  var L = num($("#conc-length").value);
  var W = num($("#conc-width").value);
  var H = num($("#conc-height").value);

  if (L <= 0 || W <= 0 || H <= 0) { toast("Measurements must be greater than zero.", "fa-triangle-exclamation"); return; }

  var vol = L * W * H; /* m3 */
  var m = CONCRETE_MIX[project];

  /* raw volumes for the mix (1:2:4 proportions give 7 parts; a m3 of concrete ≈ 1.54 m3 of dry materials) */
  var dryFactor = 1.54;
  var cementVol = vol * (m.cement / (m.cement + m.sand + m.gravel)) * dryFactor;
  var sandVol   = vol * (m.sand / (m.cement + m.sand + m.gravel)) * dryFactor;
  var gravelVol = vol * (m.gravel / (m.cement + m.sand + m.gravel)) * dryFactor;

  var bags = ceilInt(cementVol / CEMENT_BAG_VOL);
  var water = vol * WATER_PER_M3;

  storeQuantities("concrete", { bags: bags, vol: vol });

  var projectLabel = $("#conc-project").selectedOptions[0].text.split(" (")[0];

  showResult(
    "Concrete Volume",
    projectLabel + " · 1 : " + (m.sand / m.cement).toFixed(0) + " : " + (m.gravel / m.cement).toFixed(0) + " mix",
    [
      { label: "Concrete Volume", fil: "kabuuang bolyum", value: fmt(vol, 2) + " m³", hero: true },
      { label: "Cement", fil: "semento (40kg bags)", value: fmt(bags, 0) + " bags" },
      { label: "Sand", fil: "buhangin", value: fmt(sandVol, 2) + " m³" },
      { label: "Gravel", fil: "graba", value: fmt(gravelVol, 2) + " m³" },
      { label: "Water", fil: "tubig", value: fmt(water, 0) + " L" }
    ]
  );
}

/* -------- 6. Cost Estimator -------- */
function storeQuantities(module, qty) {
  var q = loadJSON(QUANT_KEY, {});
  q[module] = qty;
  saveJSON(QUANT_KEY, q);
}

function runCost() {
  var form = $("#form-cost");
  if (validateForm(form)) { toast("Please enter your prices.", "fa-triangle-exclamation"); return; }

  var pCement = num($("#price-cement").value);
  var pSteel  = num($("#price-steel").value);
  var pPaint  = num($("#price-paint").value);
  var pTile   = num($("#price-tile").value);
  var pNails  = num($("#price-nails").value);
  var pLabor  = num($("#price-labor").value);
  var days    = num($("#cost-days").value);

  var q = loadJSON(QUANT_KEY, {});
  var steel = q.steel || { pieces: 0, weight: 0 };
  var paint = q.paint || { gallons: 0, liters: 0 };
  var tile  = q.tile  || { boxes: 0, tiles: 0 };
  var nail  = q.nail  || { kg: 0, count: 0 };
  var conc  = q.concrete || { bags: 0, vol: 0 };

  var cSteel = steel.pieces * pSteel;
  var cPaint = paint.gallons * pPaint;
  var cTile  = tile.boxes * pTile;
  var cNail  = nail.kg * pNails;
  var cCement = conc.bags * pCement;
  var cLabor = pLabor * days;

  var subtotal = cSteel + cPaint + cTile + cNail + cCement;
  var grand = subtotal + cLabor;

  /* persist prices */
  saveJSON(PRICE_KEY, { cement: pCement, steel: pSteel, paint: pPaint, tile: pTile, nails: pNails, labor: pLabor, days: days });

  var rows = [];
  if (steel.pieces) rows.push({ label: "Steel (Anilyo)", fil: steel.pieces + " pcs × " + money(pSteel), value: money(cSteel) });
  if (conc.bags)    rows.push({ label: "Cement (Semento)", fil: conc.bags + " bags × " + money(pCement), value: money(cCement) });
  if (paint.gallons > 0) rows.push({ label: "Paint (Pintura)", fil: fmt(paint.gallons, 1) + " gal × " + money(pPaint), value: money(cPaint) });
  if (tile.boxes)   rows.push({ label: "Tiles", fil: tile.boxes + " boxes × " + money(pTile), value: money(cTile) });
  if (nail.kg > 0)  rows.push({ label: "Nails (Pako)", fil: fmt(nail.kg, 1) + " kg × " + money(pNails), value: money(cNail) });
  if (cLabor > 0)   rows.push({ label: "Labor", fil: fmt(days, 0) + " days × " + money(pLabor), value: money(cLabor) });

  if (!rows.length) {
    toast("Run a calculator first so there are quantities to price.", "fa-circle-info");
    return;
  }

  var totals = [{ label: "Grand Total", fil: "kabuuang gastos", value: money(grand) }];

  showResult("Material Cost Estimate", "Based on your saved quantities and current prices", rows, totals);

  currentResult.costRows = rows;
  currentResult.grandTotal = grand;
}

/* =========================================================
   Measurement Converter (live two-way)
   ========================================================= */
var M_TO_FT = 3.28084;
var IN_TO_CM = 2.54;
var SQM_TO_SQFT = 10.7639;

function convPair(mInput, ftInput, factor) {
  /* m -> ft */
  mInput.addEventListener("input", function () {
    var v = num(mInput.value);
    ftInput.value = v ? (v * factor).toFixed(3) : "";
  });
  /* ft -> m */
  ftInput.addEventListener("input", function () {
    var v = num(ftInput.value);
    mInput.value = v ? (v / factor).toFixed(3) : "";
  });
}

function updateConverter() {
  /* initial fill */
  $("#conv-length-ft").value = (num($("#conv-length-m").value) * M_TO_FT).toFixed(3);
  $("#conv-cm").value = (num($("#conv-inch").value) * IN_TO_CM).toFixed(2);
  $("#conv-area-sqft").value = (num($("#conv-area-sqm").value) * SQM_TO_SQFT).toFixed(2);
}

function initConverter() {
  convPair($("#conv-length-m"), $("#conv-length-ft"), M_TO_FT);
  convPair($("#conv-inch"), $("#conv-cm"), IN_TO_CM);
  convPair($("#conv-area-sqm"), $("#conv-area-sqft"), SQM_TO_SQFT);
  updateConverter();
}

/* =========================================================
   Saved estimates
   ========================================================= */
function getSaved() { return loadJSON(STORE_KEY, []); }

function saveCurrent() {
  if (!currentResult) return;
  var list = getSaved();
  var entry = {
    id: "est-" + Date.now(),
    module: currentModule,
    title: currentResult.title,
    sub: currentResult.sub,
    date: new Date().toISOString(),
    rows: currentResult.rows.map(function (r) { return { label: r.label, fil: r.fil, value: r.value }; }),
    totals: (currentResult.totals || []).map(function (r) { return { label: r.label, fil: r.fil, value: r.value }; })
  };
  if (currentResult.costRows) {
    entry.costRows = currentResult.costRows;
    entry.grandTotal = currentResult.grandTotal;
  }
  list.unshift(entry);
  saveJSON(STORE_KEY, list);
  toast("Estimate saved.", "fa-floppy-disk");
}

function renderSaved() {
  var wrap = $("#saved-list");
  var list = getSaved();
  wrap.innerHTML = "";

  if (!list.length) {
    wrap.innerHTML =
      '<div class="empty-state"><i class="fa-solid fa-clipboard"></i>' +
      "<h4>No saved estimates yet</h4>" +
      "<p>Run a calculator and tap <b>Save</b> to keep the result here.</p></div>";
    return;
  }

  list.forEach(function (e) {
    var mod = MODULES.filter(function (m) { return m.id === e.module; })[0] || {};
    var d = new Date(e.date);
    var dateStr = d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) +
                  " · " + d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });

    var card = document.createElement("div");
    card.className = "saved-card";

    var summary = e.rows.map(function (r) { return "<b>" + r.label + ":</b> " + r.value; }).join("<br>");
    if (e.totals && e.totals.length) {
      summary += e.totals.map(function (r) { return "<br><b>" + r.label + ":</b> " + r.value; }).join("");
    }

    card.innerHTML =
      '<div class="saved-card-top">' +
        "<div><h4><i class=\"fa-solid " + (mod.icon || "fa-calculator") + "\"></i> " + e.title + "</h4>" +
        '<div class="sc-date">' + dateStr + (e.sub ? " · " + e.sub : "") + "</div></div>" +
      "</div>" +
      '<div class="sc-summary">' + summary + "</div>" +
      '<div class="sc-actions">' +
        '<button class="btn btn-outline act-reprint"><i class="fa-solid fa-print"></i> Reprint</button>' +
        '<button class="btn btn-outline act-pdf"><i class="fa-solid fa-file-pdf"></i> PDF</button>' +
        '<button class="btn btn-ghost act-del"><i class="fa-solid fa-trash-can"></i> Delete</button>' +
      "</div>";

    $(".act-reprint", card).addEventListener("click", function () { printEntry(e); });
    $(".act-pdf", card).addEventListener("click", function () { exportPDF(e); });
    $(".act-del", card).addEventListener("click", function () {
      saveJSON(STORE_KEY, getSaved().filter(function (x) { return x.id !== e.id; }));
      renderSaved();
      toast("Estimate deleted.", "fa-trash-can");
    });

    wrap.appendChild(card);
  });
}

/* =========================================================
   Print / PDF
   ========================================================= */
function reportHTML(entry, projectName) {
  var rows = (entry.rows || []).map(function (r) {
    return "<tr><td>" + r.label + (r.fil ? '<br><small style="color:#777">' + r.fil + "</small>" : "") +
           '</td><td class="num">' + r.value + "</td></tr>";
  }).join("");
  var totals = (entry.totals || []).map(function (r) {
    return "<tr><td><b>" + r.label + "</b>" + (r.fil ? '<br><small style="color:#777">' + r.fil + "</small>" : "") +
           '</td><td class="num"><b>' + r.value + "</b></td></tr>";
  }).join("");

  return '<h1>BUILDING MATERIAL ESTIMATE</h1>' +
    '<div class="pr-sub">BuildCalc · Construction Material Calculator<br>' +
    "Project: " + (projectName || "—") + "<br>" +
    "Date: " + new Date(entry.date || Date.now()).toLocaleString("en-PH") + "</div>" +
    '<table><thead><tr><th>Item</th><th class="num">Quantity / Amount</th></tr></thead>' +
    "<tbody>" + rows + totals + "</tbody></table>" +
    (entry.grandTotal ? '<div class="pr-total">Total Estimated Cost: ' + entry.grandTotal + "</div>" : "") +
    '<div class="pr-foot">Estimates only. Confirm final quantities with your supplier and engineer before ordering.</div>';
}

function printEntry(entry) {
  var el = $("#print-report");
  el.innerHTML = reportHTML(entry, entry.sub || entry.title);
  el.setAttribute("aria-hidden", "false");
  window.print();
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = "";
}

function exportPDF(entry) {
  if (typeof window.jspdf === "undefined" || !window.jspdf.jsPDF) {
    toast("PDF library failed to load.", "fa-triangle-exclamation");
    return;
  }
  var doc = new window.jspdf.jsPDF({ unit: "pt", format: "a4" });
  var left = 48, right = 48, pageW = doc.internal.pageSize.getWidth();
  var y = 60;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(245, 124, 0);
  doc.text("BuildCalc", left, y);
  doc.setTextColor(0, 0, 0);
  y += 8;
  doc.setDrawColor(245, 124, 0);
  doc.setLineWidth(2);
  doc.line(left, y, pageW - right, y);
  y += 28;

  doc.setFontSize(15);
  doc.text("BUILDING MATERIAL ESTIMATE", left, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text("Project: " + (entry.sub || entry.title), left, y); y += 12;
  doc.text("Date: " + new Date(entry.date || Date.now()).toLocaleString("en-PH"), left, y);
  y += 24;
  doc.setTextColor(0, 0, 0);

  function row(label, fil, value, bold) {
    if (y > 740) { doc.addPage(); y = 60; }
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 12 : 10.5);
    doc.text(label, left, y);
    doc.text(String(value), pageW - right, y, { align: "right" });
    if (fil) {
      y += 11;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(String(fil), left, y);
      doc.setTextColor(0, 0, 0);
    }
    y += bold ? 18 : 14;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(left, y - 10, pageW - right, y - 10);
  }

  (entry.rows || []).forEach(function (r) { row(r.label, r.fil, r.value, false); });
  (entry.totals || []).forEach(function (r) { row(r.label, r.fil, r.value, true); });

  y += 12;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(130, 130, 130);
  doc.text("Estimates only. Confirm final quantities with your supplier and engineer.", left, y);

  var name = "BuildCalc-" + (entry.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "estimate") + ".pdf";
  doc.save(name);
  toast("PDF exported: " + name, "fa-file-pdf");
}

/* =========================================================
   Form wiring: instant recalculation on any input change
   ========================================================= */
function runCalc(form) {
  var m = form.dataset.module;
  if (m === "steel") runSteel();
  else if (m === "paint") runPaint();
  else if (m === "tile") runTile();
  else if (m === "nail") runNail();
  else if (m === "concrete") runConcrete();
  else if (m === "cost") runCost();
}

function wireForms() {
  /* live recalc on input / change */
  $all(".calc-form").forEach(function (form) {
    $all("input, select", form).forEach(function (inp) {
      var evt = inp.tagName === "SELECT" ? "change" : "input";
      inp.addEventListener(evt, function () {
        if (form.dataset.module === "converter") return; /* converter wires its own */
        runCalc(form);
      });
    });
    $all(".chip", form).forEach(function (chip) {
      chip.addEventListener("click", function () {
        $all(".chip", form).forEach(function (c) { c.classList.remove("is-active"); c.setAttribute("aria-checked", "false"); });
        chip.classList.add("is-active");
        chip.setAttribute("aria-checked", "true");
        runCalc(form);
      });
    });
    form.addEventListener("submit", function (e) { e.preventDefault(); });
    form.addEventListener("reset", function () {
      setTimeout(function () {
        $all(".is-invalid", form).forEach(function (i) { i.classList.remove("is-invalid"); });
        hideResult();
      }, 0);
    });
  });
}

/* =========================================================
   Init
   ========================================================= */
function init() {
  buildModuleBar();
  buildHomeCards();
  wireForms();
  initConverter();

  /* nav */
  $all(".nav-btn").forEach(function (b) {
    b.addEventListener("click", function () { showView(b.dataset.view); });
  });
  $("#btn-start").addEventListener("click", function () { showView("calculators"); selectModule("steel"); });
  $("#result-close").addEventListener("click", hideResult);

  /* result actions */
  $("#btn-save").addEventListener("click", saveCurrent);
  $("#btn-print").addEventListener("click", function () {
    if (currentResult) printEntry({
      title: currentResult.title, sub: currentResult.sub,
      rows: currentResult.rows, totals: currentResult.totals,
      costRows: currentResult.costRows, grandTotal: currentResult.grandTotal,
      date: new Date().toISOString()
    });
  });
  $("#btn-pdf").addEventListener("click", function () {
    if (!currentResult) return;
    exportPDF({
      title: currentResult.title, sub: currentResult.sub,
      rows: currentResult.rows, totals: currentResult.totals,
      costRows: currentResult.costRows, grandTotal: currentResult.grandTotal,
      date: new Date().toISOString()
    });
  });

  /* saved */
  $("#btn-clear-saved").addEventListener("click", function () {
    if (!getSaved().length) { toast("Nothing to clear.", "fa-circle-info"); return; }
    if (window.confirm("Delete all saved estimates? This cannot be undone.")) {
      localStorage.removeItem(STORE_KEY);
      renderSaved();
      toast("All estimates cleared.", "fa-trash-can");
    }
  });

  /* restore saved prices */
  var prices = loadJSON(PRICE_KEY, null);
  if (prices) {
    $("#price-cement").value = prices.cement;
    $("#price-steel").value = prices.steel;
    $("#price-paint").value = prices.paint;
    $("#price-tile").value = prices.tile;
    $("#price-nails").value = prices.nails;
    if (prices.labor !== undefined) $("#price-labor").value = prices.labor;
    if (prices.days !== undefined) $("#cost-days").value = prices.days;
  }

  /* default module */
  selectModule("steel", true);
}

document.addEventListener("DOMContentLoaded", init);
