/* =========================================================
   BuildCalc — Construction Material Calculator
   Vanilla JS · all calculations + localStorage
   Formulas are industry-typical estimates for PH construction.
   ========================================================= */

"use strict";

/* ---------- module metadata (nav + cards) ---------- */
var MODULES = [
  { id: "steel",     title: "Anilyo / Steel",   fil: "Rebar",       icon: "fa-ruler-combined", desc: "Bars, length & weight for footing, column, beam, slab, stairs, fence." },
  { id: "paint",     title: "Pintura",          fil: "Paint",       icon: "fa-paint-roller",   desc: "Liters, gallons & primer for interior, exterior, waterproofing." },
  { id: "tile",      title: "Tiles",            fil: "Tiles",       icon: "fa-border-all",     desc: "Tile count, boxes, adhesive & grout for your floor area." },
  { id: "nail",      title: "Pako",             fil: "Nails",       icon: "fa-hammer",         desc: "Nail quantity & recommended size for roofing, framing, forms." },
  { id: "formwork",  title: "Porma / Formwork", fil: "Forms", icon: "fa-layer-group", desc: "Phenolic plywood, cocolumber 2×2/2×3/2×4, slant braces every 2m & nails." },
  { id: "concrete",  title: "Semento/Graba",    fil: "Concrete",    icon: "fa-trowel-bricks",  desc: "Cement bags, buhangin, graba & water for your concrete pour." },
  { id: "cost",      title: "Cost",             fil: "Presyo",      icon: "fa-peso-sign",      desc: "Total estimated cost from current prices and saved quantities." },
  { id: "converter", title: "Converter",        fil: "Sukat",       icon: "fa-ruler",          desc: "Meters↔feet, inches↔cm, sqm↔sqft." }
];

var STORE_KEY = "buildcalc.saved.v1";
var PRICE_KEY = "buildcalc.prices.v1";
var QUANT_KEY = "buildcalc.quantities.v1";
var PROJECT_KEY = "buildcalc.projects.v3";
var ACTIVE_PROJECT_KEY = "buildcalc.activeproject.v3";

/* =========================================================
   Small helpers
   ========================================================= */
function $(sel, root) { return (root || document).querySelector(sel); }
function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

function num(v) { var n = Number(v); return Number.isFinite(n) ? n : NaN; }
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
  el.textContent = String(msg);
  if (icon && /^fa-[a-z-]+$/.test(icon)) {
    var i = document.createElement('i');
    i.className = 'fa-solid ' + icon;
    el.prepend(i);
  }
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
  try { localStorage.setItem(key, JSON.stringify(val)); return true; }
  catch (e) { toast("Storage blocked or full — could not save.", "fa-triangle-exclamation"); return false; }
}

/* =========================================================
   Validation
   ========================================================= */
function readPositive(input, label) {
  var v = num(input.value);
  var bad = input.value.trim() === "" || !Number.isFinite(v) || v < Number(input.min || 0) ||
    (input.max !== "" && v > Number(input.max)) || (input.step === "1" && !Number.isSafeInteger(v));
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
  if (name === "projects") renderProjects();
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
    updateSteelFields(); updateConcreteFields();
    runCalc(form, true);
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
  // Do not jump the viewport on every keystroke during live calculations.
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

/* =========================================================
   CALCULATORS — all formulas live in calc-engine.js for testability.
   ========================================================= */
function field(id) { return document.getElementById(id).value; }
function checked(id) { return document.getElementById(id).checked; }
function priceField(id) { return field('price-' + id); }
function showError(message, silent) {
  hideResult();
  var error = $('#calc-error');
  error.textContent = message;
  error.hidden = false;
  if (!silent) toast(message, 'fa-triangle-exclamation');
}
function safeCompute(fn, silent) {
  try {
    var result = fn();
    var error = $('#calc-error');
    error.hidden = true;
    error.textContent = '';
    return result;
  } catch (e) {
    showError(e.message || 'Unable to calculate. Check your inputs.', silent);
    return null;
  }
}
function resultRows(resultTitle, sub, rows, note, totals) {
  showResult(resultTitle, sub, rows, totals || []);
  currentResult.note = note;
  $('#result-note').textContent = note || '';
  $('#btn-add-project').hidden = !['steel','concrete','paint','tile','nail','formwork'].includes(currentModule);
  $('#project-item-label').hidden = $('#btn-add-project').hidden;
  currentResult.inputValues = captureInputs($('.calc-form[data-module="' + currentModule + '"]'));
}
function captureInputs(form) {
  if (!form) return {};
  var values = {};
  $all('input, select', form).forEach(function (control) {
    if (control.id && control.type !== 'file') values[control.id] = control.type === 'checkbox' ? control.checked : control.value;
  });
  var chip = $('.chip.is-active', form);
  if (chip) values._chip = chip.dataset.value;
  return values;
}
function restoreInputs(entry) {
  var module = entry.module, values = entry.inputValues;
  var form = $('.calc-form[data-module="' + module + '"]');
  if (!form || !values || typeof values !== 'object') return;
  $all('input, select', form).forEach(function (input) {
    if (Object.prototype.hasOwnProperty.call(values, input.id) && input.type !== 'file') {
      if (input.type === 'checkbox') input.checked = values[input.id] === true;
      else input.value = String(values[input.id]);
    }
  });
  if (values._chip) $all('.chip', form).forEach(function (chip) {
    var active = chip.dataset.value === values._chip;
    chip.classList.toggle('is-active', active);
    chip.setAttribute('aria-checked', String(active));
  });
  if (module === 'formwork') updateFormworkFields(false);
  showView('calculators');
  selectModule(module);
  toast('Restored input fields. Recalculate before saving.', 'fa-rotate-left');
}
function updateSteelFields() {
  var grid = ['slab', 'footing', 'staircase'].indexOf(field('steel-project')) >= 0;
  $('#steel-grid-fields').hidden = !grid;
  $('#steel-tie-fields').hidden = grid;
  $('#steel-column-fields').hidden = field('steel-project') !== 'column';
  $('#steel-stirrup-hook').disabled = grid;
  $('#steel-min-splices').disabled = false;
}
function updateConcreteFields() { $('#conc-below-fields').hidden = field('conc-project') !== 'column'; }
function updateTileBoxDefault() {
  var data = BuildCalcEngine.constants.tiles[field('tile-size')];
  if (data) $('#tile-pcs-box').value = data.pcsPerBox;
}
function storeQuantities(module, qty) {
  var q = loadJSON(QUANT_KEY, {});
  if (!q || typeof q !== 'object' || Array.isArray(q)) q = {};
  q[module] = qty;
  saveJSON(QUANT_KEY, q);
}
function runSteel(silent) {
  return safeCompute(function () {
    var r = BuildCalcEngine.steel({
      project: field('steel-project'), length: field('steel-length'), width: field('steel-width'),
      height: field('steel-height'), spacingCm: field('steel-spacing'), coverMm: field('steel-cover'),
      stockLength: field('steel-stock'), size: $('.chip.is-active', $('#form-steel')).dataset.value,
      tieSize: field('steel-tie-size'), layers: field('steel-layers'), longitudinalBars: field('steel-longitudinal'),
      elementCount: field('steel-elements'), excavationDepth: field('steel-excavation'),
      bottomHookM: field('steel-bottom-hook'), topHookM: field('steel-top-hook'),
      lapLength: field('steel-lap'), minSplices: field('steel-min-splices'),
      stirrupHookDb: field('steel-stirrup-hook'), wireLengthCm: field('steel-wire-cut'),
      wirePerJoin: field('steel-wire-ties'), wireWastePct: field('steel-wire-waste'),
      wireGramPerM: field('steel-wire-grams')
    });
    var rows = [
      { label: 'Longitudinal Bar Run', fil: 'Includes applicable depth + entered hooks', value: fmt(r.mainRunLength, 3) + ' m/bar' },
      { label: 'Main Reinforcement Length', fil: 'Includes entered splice overlaps · ' + r.elementCount + ' identical element(s)', value: fmt(r.mainLength, 3) + ' m' },
      { label: 'Main Stock Bars to Buy', fil: r.mainDiameter + 'mm × ' + r.stockLength + 'm', value: r.mainPieces + ' bars', hero: true }
    ];
    if (r.type === 'column') rows.push(
      { label: 'Height Above FFL + Below FFL', fil: 'Column rise / hukay', value: fmt(Number(field('steel-length')), 2) + ' + ' + fmt(r.excavationDepth, 2) + ' = ' + fmt(r.verticalLength, 2) + ' m' },
      { label: 'Bottom + Top Hook / Anchorage', fil: 'Entered allowance per longitudinal bar', value: fmt(r.bottomHook, 2) + ' + ' + fmt(r.topHook, 2) + ' m' });
    rows.push({ label: 'Splice / Lap Joints', fil: fmt(r.spliceLap, 3) + ' m overlap per joint, if needed', value: r.spliceCount + ' joints' });
    if (r.tiePieces) rows.push(
      { label: 'Anilyo / Stirrups', fil: r.tieDiameter + 'mm · ' + fmt(r.stirrupCutLength, 3) + ' m cut incl. hook tails', value: r.stirrups + ' pcs' },
      { label: 'Anilyo Steel to Buy', fil: r.tieDiameter + 'mm × ' + r.stockLength + 'm', value: r.tiePieces + ' bars' });
    else rows.push({ label: 'Grid Rebars', fil: 'Parallel length / parallel width', value: r.countLengthwise + ' / ' + r.countWidthwise + ' pcs' });
    rows.push(
      { label: 'Panali / Tie Wire (#16)', fil: r.tieWireJoints + ' intersections, incl. ' + field('steel-wire-waste') + '% allowance', value: fmt(r.tieWireKg, 3) + ' kg' },
      { label: 'Tie Wire to Buy', fil: 'Rounded up to 0.5 kg for this item', value: fmt(r.wireBuyKg, 1) + ' kg' },
      { label: 'Steel Weight', fil: 'Longitudinal and stirrup bars (excludes tie wire)', value: fmt(r.mainWeight + r.tieWeight, 2) + ' kg' });
    storeQuantities('steel', { mainPieces: r.mainPieces, tiePieces: r.tiePieces, wireBuyKg: r.wireBuyKg,
      mainDiameter: r.mainDiameter, tieDiameter: r.tieDiameter, stockLength: r.stockLength });
    resultRows('Steel & Tie-Wire Requirement', field('steel-project') + ' · ' + r.stockLength + ' m stock · ' + r.elementCount + ' elements', rows, r.note);
    currentResult.quantity = r; currentResult.section = field('steel-project');
    return r;
  }, silent);
}
function runPaint(silent) {
  return safeCompute(function () {
    var r = BuildCalcEngine.paint({ type: field('paint-type'), coverage: field('paint-coverage'),
      primerCoverage: field('paint-primer-coverage'), length: field('paint-length'),
      height: field('paint-height'), walls: field('paint-walls'), coats: field('paint-coats'),
      openings: field('paint-openings'), wastePct: field('paint-waste'),
      canLiters: field('paint-can-size'), includePrimer: checked('paint-primer') });
    var rows = [
      { label: 'Net Paintable Area', fil: 'After openings', value: fmt(r.area, 2) + ' m²' },
      { label: 'Finish Paint', fil: r.coats + ' coat(s), including allowance', value: fmt(r.liters, 2) + ' L' },
      { label: 'Finish Cans to Buy', fil: fmt(r.canLiters, 3) + ' L per can', value: r.cans + ' cans', hero: true }
    ];
    if (r.primerCans) rows.push({ label: 'Primer', fil: 'One coat', value: fmt(r.primerLiters, 2) + ' L / ' + r.primerCans + ' cans' });
    storeQuantities('paint', { cans: r.cans, primerCans: r.primerCans, canLiters: r.canLiters, type: field('paint-type') });
    resultRows('Paint Requirement', field('paint-type') + ' · ' + field('paint-coats') + ' coat(s)', rows, r.note);
    r.type = field('paint-type'); currentResult.quantity = r; currentResult.section = 'paint';
    return r;
  }, silent);
}
function runTile(silent) {
  return safeCompute(function () {
    var r = BuildCalcEngine.tile({ length: field('tile-length'), width: field('tile-width'),
      size: field('tile-size'), allowance: field('tile-allowance'), pcsPerBox: field('tile-pcs-box'),
      adhesiveCoverage: field('tile-adhesive-coverage'), adhesiveWastePct: field('tile-adhesive-waste'),
      groutRate: field('tile-grout-rate') });
    storeQuantities('tile', { boxes: r.boxes, tiles: r.tiles, adhesiveBags: r.adhesiveBags, groutBuyKg: r.groutBuyKg });
    r.tileSize = field('tile-size');
    resultRows('Tile Requirement', field('tile-size') + ' cm · ' + fmt(Number(field('tile-allowance')) * 100, 0) + '% cuts allowance', [
      { label: 'Floor Area', fil: 'Gross', value: fmt(r.area, 2) + ' m²' },
      { label: 'Tile Pieces', fil: 'Including cut allowance', value: r.tiles + ' pcs' },
      { label: 'Boxes to Buy', fil: r.pcsPerBox + ' pcs/box', value: r.boxes + ' boxes', hero: true },
      { label: 'Tile Adhesive', fil: '25 kg bags', value: r.adhesiveBags + ' bags' },
      { label: 'Grout', fil: 'Approximate · rounded to 0.5 kg for costing', value: fmt(r.groutKg, 2) + ' kg / ' + fmt(r.groutBuyKg, 1) + ' kg to buy' }
    ], r.note);
    currentResult.quantity = r; currentResult.section = 'tile';
    return r;
  }, silent);
}
function runNail(silent) {
  return safeCompute(function () {
    var r = BuildCalcEngine.nail({ type: field('nail-material'), length: field('nail-length'),
      boards: field('nail-boards'), spacingCm: field('nail-spacing'),
      nailsPerJoint: field('nail-per-joint'), wastePct: field('nail-waste') });
    storeQuantities('nail', { count: r.count, kg: r.kg, buyKg: r.buyKg });
    r.nailSize = r.size;
    resultRows('Nail Requirement', field('nail-material') + ' · ' + r.size, [
      { label: 'Fastening Points', fil: 'From run and spacing', value: r.joints + ' joints' },
      { label: 'Nails Required', fil: 'Including boards and waste', value: r.count + ' pcs', hero: true },
      { label: 'Estimated Weight', fil: 'Individual nail weight is approximate', value: fmt(r.kg, 3) + ' kg' },
      { label: 'Nails to Buy', fil: 'Rounded to 0.5 kg', value: fmt(r.buyKg, 1) + ' kg' }
    ], r.note);
    currentResult.quantity = r; currentResult.section = 'nail';
    return r;
  }, silent);
}
function runConcrete(silent) {
  return safeCompute(function () {
    var r = BuildCalcEngine.concrete({ project: field('conc-project'), length: field('conc-length'),
      width: field('conc-width'), height: field('conc-height'),
      count: field('conc-count'), mixClass: field('conc-mix'), wastePct: field('conc-waste'), belowFloorM: field('conc-below') });
    storeQuantities('concrete', { bags: r.bags, sand: r.sand, gravel: r.gravel, volume: r.volume });
    resultRows('Concrete Material Take-off', field('conc-project') + ' · Class ' + r.className + ' · ' + r.ratio, [
      { label: 'Net Concrete Volume', fil: r.count + ' element(s)' + (r.belowFloor ? ' · height includes ' + fmt(r.belowFloor, 2) + ' m hukay' : ''), value: fmt(r.volume, 3) + ' m³', hero: true },
      { label: 'With Material Allowance', fil: 'Basis for purchase estimate', value: fmt(r.materialVolume, 3) + ' m³' },
      { label: 'Cement', fil: '40 kg bags', value: r.bags + ' bags' },
      { label: 'Sand', fil: 'Loose material estimate', value: fmt(r.sand, 3) + ' m³' },
      { label: 'Gravel', fil: 'Loose material estimate', value: fmt(r.gravel, 3) + ' m³' }
    ], r.note);
    currentResult.quantity = r; currentResult.section = field('conc-project');
    return r;
  }, silent);
}

function updateFormworkFields(autofill) {
  var type = field('form-type'), byArea = type === 'area';
  $('#form-dimensions').hidden = byArea;
  $('#form-area-group').hidden = !byArea;
  $('#form-framing-group').hidden = byArea;
  $('#form-height-group').hidden = ['column','beam','footing'].indexOf(type) === -1;
  ['form-length','form-width'].forEach(function(id) { $('#'+id).disabled = byArea; });
  $('#form-height').disabled = ['column','beam','footing'].indexOf(type) === -1;
  $('#form-area').disabled = !byArea;
  ['form-lumber','form-brace-lumber','form-joist-spacing','form-brace-spacing','form-brace-length','form-braces-per'].forEach(function(id) { $('#'+id).disabled = byArea; });
  if (autofill) $('#form-joist-spacing').value = type === 'slab' || type === 'scaffolding' ? '40' : '60';
}
function runFormwork(silent) {
  return safeCompute(function () {
    var r = BuildCalcEngine.formwork({type:field('form-type'), length:field('form-length'), width:field('form-width'),
      height:field('form-height'),areaSqm:field('form-area'),count:field('form-count'),
      plywoodThickness:field('form-plywood'),sheetCoverageSqm:field('form-coverage'),plywoodWastePct:field('form-plywood-waste'),
      frameLumber:field('form-lumber'),braceLumber:field('form-brace-lumber'),
      framingSpacingCm:field('form-joist-spacing'),braceSpacingM:field('form-brace-spacing'),
      braceLengthM:field('form-brace-length'),bracesPerStation:field('form-braces-per'),
      nailSize:field('form-nail-size'),nailGram:field('form-nail-gram'),nailsPerSqm:field('form-nails-per'),nailWastePct:field('form-nail-waste')});
    var rows = [
      {label:'Plywood Formwork Area',fil:r.elementCount+' element(s) · contact surface',value:fmt(r.areaSqm,3)+' m²'},
      {label:'Adjusted Plywood Area',fil:field('form-plywood-waste')+'% entered plywood allowance',value:fmt(r.plywoodAreaSqm,3)+' m²'},
      {label:'Phenolic Plywood to Buy',fil:r.plywoodThickness+' inch · '+fmt(r.sheetCoverageSqm,4)+' m²/sheet',value:r.plywoodSheets+' whole sheet(s)',hero:true}
    ];
    if (r.type !== 'area') rows.push(
      {label:'Frame / Joist Stations',fil:fmt(r.framingSpacingCm,1)+' cm spacing (station count per element)',value:r.framingStations+' stations'},
      {label:'Coco Lumber — Frame',fil:r.frameLumber.replace(/x/g,'×')+' (inch × inch × feet)',value:r.framingBars+' pcs'},
      {label:'Slant Braces / Palikpik',fil:fmt(r.braceSpacingM,2)+' m intervals × '+fmt(r.braceLengthM,2)+' m cut',value:r.braceCount+' braces'},
      {label:'Coco Lumber — Braces',fil:r.braceLumber.replace(/x/g,'×')+' (inch × inch × feet)',value:r.braceBars+' pcs'},
      {label:'Long-Member Cut Breaks',fil:'Cutting estimate only; connections need approved details',value:r.woodJoints+' breaks'});
    rows.push({label:'Pako / Fasteners',fil:(r.nailSize === '3-concrete' ? '3-inch concrete nail' : r.nailSize+' inch')+' · '+fmt(Number(field('form-nails-per')),1)+' pcs/m²',value:r.nailCount+' nails'},
      {label:'Pako to Buy',fil:fmt(r.nailKg,3)+' kg exact · purchasing rounded to 0.5 kg',value:fmt(r.nailBuyKg,1)+' kg'});
    storeQuantities('formwork',r);
    resultRows('Porma / Formwork Material Take-off',r.type+' · '+r.elementCount+' element(s)',rows,r.note);
    currentResult.quantity = r; currentResult.section = r.type === 'area' ? 'formwork' : r.type;
    return r;
  },silent);
}

function runCost(silent) {
  return safeCompute(function () {
    var prices = {
      cement: priceField('cement'), steel: priceField('steel'), ties: priceField('ties'), wire: priceField('wire'),
      paint: priceField('paint'), primer: priceField('primer'), tile: priceField('tile'),
      adhesive: priceField('adhesive'), grout: priceField('grout'), nails: priceField('nails'),
      sand: priceField('sand'), gravel: priceField('gravel'), labor: priceField('labor'),
      plywood: priceField('plywood'), lumber: priceField('lumber'), formnails: priceField('formnails'),
      days: field('cost-days'), workers: field('cost-workers'),
      overheadPct: field('cost-overhead'), contingencyPct: field('cost-contingency')
    };
    var q = loadJSON(QUANT_KEY, {});
    if (q && ((q.formwork && q.formwork.plywoodSheets != null && !q.formwork.cutGroups) ||
      (q.steel && q.steel.pieces != null && q.steel.mainPieces == null) ||
      (q.steel && q.steel.mainPieces != null && q.steel.wireBuyKg == null) ||
      (q.paint && q.paint.gallons != null && q.paint.cans == null) ||
      (q.tile && q.tile.boxes != null && q.tile.adhesiveBags == null) ||
      (q.nail && q.nail.kg != null && q.nail.buyKg == null) ||
      (q.concrete && q.concrete.vol != null && q.concrete.sand == null))) {
      throw new Error('Old-format quantities detected (some do not include tie wire). Recalculate those materials or use Clear Material Quantities before costing.');
    }
    var active = getActiveProject();
    var useProject = field('cost-source') === 'project' && active && active.items.length > 0;
    if (useProject) prices.rateOverrides = active.priceOverrides || {};
    var r = useProject ? BuildCalcEngine.projectSummary(active.items, prices) :
      BuildCalcEngine.cost(q && typeof q === 'object' ? q : {}, prices);
    if (!r.lines.length && !r.labor) throw new Error('Calculate a material or add items to the active project first.');
    saveJSON(PRICE_KEY, prices);
    var rows = r.lines.map(function (line) {
      return { label: line.label, fil: fmt(line.qty, 6) + ' ' + line.unit + ' × ' + money(line.rate == null ? line.price : line.rate), value: money(line.amount) };
    });
    if (r.labor) rows.push({ label: 'Labor', fil: prices.workers + ' worker(s) × ' + fmt(Number(prices.days), 1) + ' day(s) × ' + money(Number(prices.labor)), value: money(r.labor) });
    var totals = [
      { label: 'Materials Subtotal', fil: 'All priced materials', value: money(r.materials) },
      { label: 'Labor Subtotal', fil: 'Workers × days × rate', value: money(r.labor) },
      { label: 'Overhead', fil: field('cost-overhead') + '% of direct cost', value: money(r.overhead) },
      { label: 'Contingency', fil: field('cost-contingency') + '% of direct cost plus overhead', value: money(r.contingency) },
      { label: 'Grand Total', fil: 'Estimated project amount', value: money(r.total) }
    ];
    var note = (useProject ? 'Full active project: ' + active.name + ' (' + active.items.length + ' entries). ' : 'Latest quantity per module only (no project entries or legacy mode). ') + 'Prices in PHP. ' +
      (r.warnings.length ? 'Missing price(s): ' + r.warnings.join(', ') + '. ' : '') +
      'Supplier rates, hauling, tax treatment and project scope must be verified.';
    resultRows('Material & Labor Estimate', field('cost-project-name').trim() || (useProject ? active.name : 'Combined material estimate'), rows, note, totals);
    currentResult.grandTotal = r.total;
    return r;
  }, silent);
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
    ftInput.value = Number.isFinite(v) && mInput.value !== '' ? (v * factor).toFixed(3) : "";
  });
  /* ft -> m */
  ftInput.addEventListener("input", function () {
    var v = num(ftInput.value);
    mInput.value = Number.isFinite(v) && ftInput.value !== '' ? (v / factor).toFixed(3) : "";
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
function getSaved() { var v = loadJSON(STORE_KEY, []); return Array.isArray(v) ? v : []; }
function escapeHTML(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function(c) {
  return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
}); }

function saveCurrent() {
  if (!currentResult) return;
  var list = getSaved();
  if (!Array.isArray(list)) list = [];
  var entry = {
    id: "est-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9),
    module: currentModule,
    title: currentResult.title,
    sub: currentResult.sub,
    date: new Date().toISOString(),
    rows: currentResult.rows.map(function (r) { return { label: r.label, fil: r.fil, value: r.value }; }),
    totals: (currentResult.totals || []).map(function (r) { return { label: r.label, fil: r.fil, value: r.value }; }),
    note: currentResult.note || '', inputValues: currentResult.inputValues || {}
  };
  if (currentResult.costRows) {
    entry.costRows = currentResult.costRows;
    entry.grandTotal = currentResult.grandTotal;
  }
  list.unshift(entry);
  if (saveJSON(STORE_KEY, list)) toast("Estimate saved.", "fa-floppy-disk");
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
    if (!e || typeof e !== 'object' || !Array.isArray(e.rows)) return;
    var d = new Date(e.date);
    if (Number.isNaN(d.getTime())) d = new Date();
    var dateStr = d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) +
                  " · " + d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });

    var card = document.createElement("div");
    card.className = "saved-card";

    var summary = e.rows.filter(function(r) { return r && typeof r === 'object'; }).map(function (r) { return "<b>" + escapeHTML(r.label) + ":</b> " + escapeHTML(r.value); }).join("<br>");
    if (e.totals && e.totals.length) {
      summary += e.totals.filter(function(r) { return r && typeof r === 'object'; }).map(function (r) { return "<br><b>" + escapeHTML(r.label) + ":</b> " + escapeHTML(r.value); }).join("");
    }

    card.innerHTML =
      '<div class="saved-card-top">' +
        "<div><h4><i class=\"fa-solid " + (mod.icon || "fa-calculator") + "\"></i> " + escapeHTML(e.title) + "</h4>" +
        '<div class="sc-date">' + escapeHTML(dateStr) + (e.sub ? " · " + escapeHTML(e.sub) : "") + "</div></div>" +
      "</div>" +
      '<div class="sc-summary">' + summary + "</div>" +
      '<div class="sc-actions">' +
        '<button class="btn btn-outline act-reprint"><i class="fa-solid fa-print"></i> Reprint</button>' +
        '<button class="btn btn-outline act-pdf"><i class="fa-solid fa-file-pdf"></i> PDF</button>' +
        (e.inputValues ? '<button class="btn btn-outline act-restore"><i class="fa-solid fa-rotate-left"></i> Reopen</button>' : '') +
        '<button class="btn btn-ghost act-del"><i class="fa-solid fa-trash-can"></i> Delete</button>' +
      "</div>";

    var restore = $(".act-restore", card);
    if (restore) restore.addEventListener("click", function () { restoreInputs(e); });
    $(".act-reprint", card).addEventListener("click", function () { printEntry(e); });
    $(".act-pdf", card).addEventListener("click", function () { exportPDF(e); });
    $(".act-del", card).addEventListener("click", function () {
      if (!window.confirm('Delete this saved estimate?')) return;
      if (saveJSON(STORE_KEY, getSaved().filter(function (x) { return x.id !== e.id; }))) {
        renderSaved();
        toast("Estimate deleted.", "fa-trash-can");
      }
    });

    wrap.appendChild(card);
  });
}

/* =========================================================
   Print / PDF
   ========================================================= */
function reportHTML(entry, projectName) {
  var rows = (entry.rows || []).map(function (r) {
    return "<tr><td>" + escapeHTML(r.label) + (r.fil ? '<br><small style="color:#777">' + escapeHTML(r.fil) + "</small>" : "") +
           '</td><td class="num">' + escapeHTML(r.value) + "</td></tr>";
  }).join("");
  var totals = (entry.totals || []).map(function (r) {
    return "<tr><td><b>" + escapeHTML(r.label) + "</b>" + (r.fil ? '<br><small style="color:#777">' + escapeHTML(r.fil) + "</small>" : "") +
           '</td><td class="num"><b>' + escapeHTML(r.value) + "</b></td></tr>";
  }).join("");

  return '<h1>BUILDING MATERIAL ESTIMATE</h1>' +
    '<div class="pr-sub">BuildCalc · Construction Material Calculator<br>' +
    "Project: " + escapeHTML(projectName || "—") + "<br>" +
    "Date: " + new Date(entry.date || Date.now()).toLocaleString("en-PH") + "</div>" +
    '<table><thead><tr><th>Item</th><th class="num">Quantity / Amount</th></tr></thead>' +
    "<tbody>" + rows + totals + "</tbody></table>" +
    (Number.isFinite(entry.grandTotal) ? '<div class="pr-total">Total Estimated Cost: ' + money(entry.grandTotal) + "</div>" : "") +
    (entry.note ? '<p class="pr-foot">' + escapeHTML(entry.note) + '</p>' : '') +
    '<div class="pr-foot">Estimates only. Confirm final quantities with your supplier and engineer before ordering.</div>';
}

function printEntry(entry) {
  var el = $("#print-report");
  el.innerHTML = reportHTML(entry, entry.sub || entry.title);
  el.setAttribute("aria-hidden", "false");
  function clean() { el.setAttribute("aria-hidden", "true"); el.textContent = ""; }
  window.addEventListener('afterprint', clean, { once: true });
  window.print();
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
  doc.text(pdfText("Project: " + (entry.sub || entry.title)), left, y, { maxWidth: pageW - left - right }); y += 12;
  doc.text("Date: " + new Date(entry.date || Date.now()).toLocaleString("en-PH"), left, y);
  y += 24;
  doc.setTextColor(0, 0, 0);

  function pdfText(text) { return String(text == null ? '' : text).replace(/₱/g, 'PHP ').replace(/×/g, 'x').replace(/³/g, '^3').replace(/²/g, '^2').replace(/·/g, '-').replace(/[–—]/g, '-'); }
  function row(label, fil, value, bold) {
    if (y > 740) { doc.addPage(); y = 60; }
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 12 : 10.5);
    doc.text(pdfText(label), left, y, { maxWidth: 310 });
    doc.text(pdfText(value), pageW - right, y, { align: "right", maxWidth: 160 });
    if (fil) {
      y += 11;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(pdfText(fil), left, y, { maxWidth: pageW - left - right });
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
  if (entry.note) {
    y += 14;
    if (y > 750) { doc.addPage(); y = 60; }
    doc.text(doc.splitTextToSize(pdfText(entry.note), pageW - left - right), left, y);
  }

  var name = "BuildCalc-" + (entry.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "estimate") + ".pdf";
  doc.save(name);
  toast("PDF exported: " + name, "fa-file-pdf");
}

/* =========================================================
   Form wiring: instant recalculation on any input change
   ========================================================= */
function runCalc(form, silent) {
  var m = form.dataset.module;
  if (m === 'steel') return runSteel(silent);
  if (m === 'paint') return runPaint(silent);
  if (m === 'tile') return runTile(silent);
  if (m === 'nail') return runNail(silent);
  if (m === 'concrete') return runConcrete(silent);
  if (m === 'formwork') return runFormwork(silent);
  if (m === 'cost') return runCost(silent);
}
function wireForms() {
  $all('.calc-form').forEach(function(form) {
    $all('input, select', form).forEach(function(input) {
      var evt = input.tagName === 'SELECT' ? 'change' : 'input';
      input.addEventListener(evt, function() {
        if (form.dataset.module === 'converter') return;
        if (input.id === 'steel-project') updateSteelFields();
        if (input.id === 'conc-project') updateConcreteFields();
        if (input.id === 'tile-size') updateTileBoxDefault();
        if (input.id === 'form-type') updateFormworkFields(true);
        if (input.id === 'form-nail-size') $('#form-nail-gram').value = BuildCalcEngine.constants.formNails[field('form-nail-size')];
        if (input.id === 'paint-type') {
          $('#paint-coverage').value = BuildCalcEngine.constants.paint[field('paint-type')];
          $('#paint-primer').disabled = field('paint-type') === 'primer';
        }
        runCalc(form, true);
      });
    });
    $all('.chip', form).forEach(function(chip) {
      chip.addEventListener('click', function() {
        $all('.chip', form).forEach(function(c) { c.classList.remove('is-active'); c.setAttribute('aria-checked', 'false'); });
        chip.classList.add('is-active'); chip.setAttribute('aria-checked', 'true');
        runCalc(form, true);
      });
    });
    var button = $('.calc-btn', form);
    if (button) button.addEventListener('click', function() {
      if (runCalc(form, false)) $('#result-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    form.addEventListener('submit', function(e) { e.preventDefault(); runCalc(form, false); });
    form.addEventListener('reset', function() { setTimeout(function() {
      $all('.is-invalid', form).forEach(function(i) { i.classList.remove('is-invalid'); i.removeAttribute('aria-invalid'); });
      if (form.dataset.module === 'steel') {
        $all('.chip', form).forEach(function(c) { var a = c.dataset.value === '12'; c.classList.toggle('is-active', a); c.setAttribute('aria-checked', String(a)); });
        updateSteelFields();
      }
      if (form.dataset.module === 'concrete') updateConcreteFields();
      if (form.dataset.module === 'formwork') updateFormworkFields(false);
      if (form.dataset.module === 'paint') { $('#paint-primer').disabled = false; }
      if (form.dataset.module === 'converter') updateConverter();
      else runCalc(form, true);
    }, 0); });
  });
}
function exportBackup() {
  var backup = { app: 'BuildCalc', version: 4, projects: getProjects(), activeProject: localStorage.getItem(ACTIVE_PROJECT_KEY), exportedAt: new Date().toISOString(),
    saved: getSaved(), quantities: loadJSON(QUANT_KEY, {}), prices: loadJSON(PRICE_KEY, {}) };
  var blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = 'BuildCalc-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function() { URL.revokeObjectURL(url); }, 10000);
  toast('Backup exported.', 'fa-download');
}
function importBackup(file) {
  if (!file) return;
  if (file.size > 3000000) { toast('Backup is too large (max 3 MB).', 'fa-triangle-exclamation'); return; }
  var reader = new FileReader();
  reader.onload = function() {
    try {
      var data = JSON.parse(reader.result);
      if (!data || data.app !== 'BuildCalc' || !Array.isArray(data.saved) || data.saved.length > 1000 ||
          !data.saved.every(function(e) { return e && typeof e === 'object' && Array.isArray(e.rows) && e.rows.length <= 200 &&
            e.rows.every(function(r) { return r && typeof r === 'object' && typeof r.label === 'string' && typeof r.value === 'string'; }); }))
        throw new Error('Not a compatible BuildCalc backup.');
      if (data.projects != null && (!Array.isArray(data.projects) || data.projects.length > 100 ||
          !data.projects.every(function(project) { return project && typeof project.name === 'string' && project.name.length <= 100 &&
          typeof project.id === 'string' && Array.isArray(project.items) && project.items.length <= 1000 &&
          project.items.every(function(item) { return item && typeof item.module === 'string' && typeof item.label === 'string' && item.label.length <= 140 && item.qty && typeof item.qty === 'object'; }); })))
        throw new Error('Invalid project sheets in backup.');
      if (!window.confirm('Restore backup? This will replace saved estimates, project sheets, quantities and prices on this device.')) return;
      if (!saveJSON(STORE_KEY, data.saved)) return;
      if (!saveJSON(QUANT_KEY, data.quantities && typeof data.quantities === 'object' ? data.quantities : {})) return;
      if (!saveJSON(PRICE_KEY, data.prices && typeof data.prices === 'object' ? data.prices : {})) return;
      if (!saveJSON(PROJECT_KEY, data.projects || [])) return;
      localStorage.setItem(ACTIVE_PROJECT_KEY, data.activeProject || '');
      restorePrices(); renderSaved(); renderProjects();
      toast('Backup restored. Review inputs and prices.', 'fa-file-import');
    } catch(e) { toast(e.message || 'Could not read backup.', 'fa-triangle-exclamation'); }
  };
  reader.readAsText(file);
}
function restorePrices() {
  var p = loadJSON(PRICE_KEY, null);
  if (!p || typeof p !== 'object') return;
  ['wire','cement','steel','ties','paint','primer','tile','adhesive','grout','nails','sand','gravel','labor','plywood','lumber','formnails'].forEach(function(key) {
    if (p[key] != null && Number.isFinite(Number(p[key])) && Number(p[key]) >= 0) $('#price-' + key).value = p[key];
  });
  ['days','workers'].forEach(function(key) {
    if (p[key] != null) $('#cost-' + key).value = p[key];
  });
  if (p.overheadPct != null) $('#cost-overhead').value = p.overheadPct;
  if (p.contingencyPct != null) $('#cost-contingency').value = p.contingencyPct;
}

/* =========================================================
   Init
   ========================================================= */
function init() {
  buildModuleBar();
  buildHomeCards();
  updateFormworkFields(false);
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
  $('#btn-add-project').addEventListener('click', addCurrentToProject);
  $("#btn-print").addEventListener("click", function () {
    if (currentResult) printEntry({
      title: currentResult.title, sub: currentResult.sub,
      rows: currentResult.rows, totals: currentResult.totals,
      costRows: currentResult.costRows, grandTotal: currentResult.grandTotal, note: currentResult.note,
      date: new Date().toISOString()
    });
  });
  $("#btn-pdf").addEventListener("click", function () {
    if (!currentResult) return;
    exportPDF({
      title: currentResult.title, sub: currentResult.sub,
      rows: currentResult.rows, totals: currentResult.totals,
      costRows: currentResult.costRows, grandTotal: currentResult.grandTotal, note: currentResult.note,
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

  restorePrices();
  updateSteelFields(); updateConcreteFields();
  initProjects();
  $('#btn-clear-quantities').addEventListener('click', function() {
    if (window.confirm('Clear all calculated material quantities? Saved reports will remain.')) {
      localStorage.removeItem(QUANT_KEY);
      runCost(true);
      toast('Material quantities cleared.', 'fa-trash-can');
    }
  });
  $('#btn-export-backup').addEventListener('click', exportBackup);
  $('#btn-import-backup').addEventListener('click', function() { $('#backup-file').click(); });
  $('#backup-file').addEventListener('change', function() {
    importBackup(this.files[0]); this.value = '';
  });

  /* default module */
  selectModule("steel", true);
}

document.addEventListener("DOMContentLoaded", init);
