/* BuildCalc calculation engine v2. Pure functions: browser global + Node exports for testing.
   Preliminary quantity take-offs only, NOT structural design or a mix-strength specification. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BuildCalcEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var BAR_WEIGHT = { 10: 0.617, 12: 0.888, 16: 1.58, 20: 2.47 };
  var PAINT_COVERAGE = { interior: 12, exterior: 10, primer: 8, waterproofing: 6, enamel: 11 };
  var TILE_DATA = { '30x30': { w: .3, h: .3, pcsPerBox: 11 }, '40x40': { w: .4, h: .4, pcsPerBox: 6 }, '60x60': { w: .6, h: .6, pcsPerBox: 4 }, '30x60': { w: .3, h: .6, pcsPerBox: 8 } };
  // Preliminary Max Fajardo-style concrete table, quantities per m³, 40-kg cement bags.
  // Always use the structural engineer's specified concrete mix/ready-mix design for actual work.
  var CONCRETE_CLASS = {
    AA: { ratio: '1 : 1.5 : 3', cement: 12, sand: .5, gravel: 1 },
    A:  { ratio: '1 : 2 : 4', cement: 9, sand: .5, gravel: 1 },
    B:  { ratio: '1 : 2.5 : 5', cement: 7.5, sand: .5, gravel: 1 },
    C:  { ratio: '1 : 3 : 6', cement: 6, sand: .5, gravel: 1 }
  };
  var NAIL_DATA = {
    roofing:  { size: '2-inch', perBoard: 8, gram: 3, label: 'Roofing' },
    framing:  { size: '3-inch', perBoard: 10, gram: 5, label: 'Wood framing' },
    formwork: { size: '2-inch', perBoard: 6, gram: 3, label: 'Formwork' },
    fence:    { size: '4-inch', perBoard: 5, gram: 8, label: 'Fence' }
  };
  function required(value, label, zeroAllowed) {
    var n = Number(value);
    if (value === '' || value === null || !Number.isFinite(n) || n < 0 || (!zeroAllowed && n <= 0) || n > 1000000) {
      throw new Error(label + ' must be a valid ' + (zeroAllowed ? 'non-negative' : 'positive') + ' number.');
    }
    return n;
  }
  function whole(value, label, zeroAllowed) {
    var n = required(value, label, zeroAllowed);
    if (!Number.isSafeInteger(n)) throw new Error(label + ' must be a whole number.');
    return n;
  }
  function pick(map, key, label) {
    if (!Object.prototype.hasOwnProperty.call(map, key)) throw new Error('Invalid ' + label + '.');
    return map[key];
  }
  function purchase(amount) { return Math.ceil(amount - 1e-9); }
  function stocksForRepeatedCuts(runLength, runs, stockLength) {
    if (runLength > stockLength + 1e-9) {
      throw new Error('A rebar run is longer than the selected stock length. Splicing and lap lengths must be specified before estimating pieces.');
    }
    return purchase(runs / Math.floor((stockLength + 1e-9) / runLength));
  }
  function steel(p) {
    var type = String(p.project), L = required(p.length, 'Length'), W = required(p.width, 'Width');
    var H = required(p.height, 'Height / thickness');
    var spacing = required(p.spacingCm, 'Spacing') / 100;
    var cover = required(p.coverMm, 'Cover', true) / 1000;
    var stock = required(p.stockLength, 'Stock length');
    var mainDia = whole(p.size, 'Main bar size'), tieDia = whole(p.tieSize, 'Tie bar size');
    pick(BAR_WEIGHT, mainDia, 'main bar size'); pick(BAR_WEIGHT, tieDia, 'tie size');
    if (cover * 2 >= W || cover * 2 >= H) throw new Error('Cover must be smaller than half the width and depth.');
    if (spacing > 1) throw new Error('Spacing must not exceed 100 cm.');
    if (['slab', 'footing', 'staircase'].indexOf(type) >= 0) {
      var layers = whole(p.layers, 'Number of layers');
      if (layers < 1 || layers > 2) throw new Error('Choose 1 or 2 layers.');
      var lenRun = L - 2 * cover, wideRun = W - 2 * cover;
      if (lenRun <= 0 || wideRun <= 0) throw new Error('Cover exceeds the plan dimensions.');
      var countLengthwise = (purchase(wideRun / spacing) + 1) * layers;
      var countWidthwise = (purchase(lenRun / spacing) + 1) * layers;
      var mainLen = lenRun * countLengthwise + wideRun * countWidthwise;
      var mainPieces = stocksForRepeatedCuts(lenRun, countLengthwise, stock) + stocksForRepeatedCuts(wideRun, countWidthwise, stock);
      return { type: type, mainDiameter: mainDia, tieDiameter: tieDia, mainBars: countLengthwise + countWidthwise,
        countLengthwise: countLengthwise, countWidthwise: countWidthwise, mainLength: mainLen, tieLength: 0,
        mainWeight: mainLen * BAR_WEIGHT[mainDia], tieWeight: 0, mainPieces: mainPieces, tiePieces: 0,
        pieces: mainPieces, stockLength: stock, note: type === 'staircase' ? 'Plan-grid approximation only; stair slope, landings, anchorage and bends are not included.' : 'Straight bars only; laps, bends, anchorage, supports and detailing not included. Cutting assumes no shared offcuts between directions.' };
    }
    if (['beam', 'column', 'fence'].indexOf(type) < 0) throw new Error('Unknown steel project type.');
    var longitudinal = whole(p.longitudinalBars, 'Longitudinal bars');
    var tieCount = purchase(L / spacing) + 1;
    var tiePerimeter = 2 * ((W - 2 * cover) + (H - 2 * cover));
    // Approximate two 10db hook tails per rectangular stirrup; actual bend schedule can differ.
    var tieRun = tiePerimeter + 20 * tieDia / 1000;
    var mainLenB = longitudinal * L, tieLen = tieCount * tieRun;
    var mainStock = stocksForRepeatedCuts(L, longitudinal, stock);
    var tieStock = stocksForRepeatedCuts(tieRun, tieCount, stock);
    return { type: type, mainDiameter: mainDia, tieDiameter: tieDia, mainBars: longitudinal,
      stirrups: tieCount, stirrupCutLength: tieRun, mainLength: mainLenB, tieLength: tieLen,
      mainWeight: mainLenB * BAR_WEIGHT[mainDia], tieWeight: tieLen * BAR_WEIGHT[tieDia],
      mainPieces: mainStock, tiePieces: tieStock, pieces: mainStock + tieStock, stockLength: stock,
      note: 'Preliminary longitudinal/tie take-off, not a reinforcement design. Verify tie spacing, cover, development, lap and bend schedules with the structural plans.' };
  }
  function paint(p) {
    pick(PAINT_COVERAGE, p.type, 'paint type');
    var coverage = p.coverage == null ? PAINT_COVERAGE[p.type] : required(p.coverage, 'Finish coverage');
    var area = required(p.length, 'Wall length') * required(p.height, 'Wall height') * whole(p.walls, 'Walls');
    var open = required(p.openings, 'Openings', true);
    if (open >= area) throw new Error('Openings must be less than the total wall area.');
    var coats = whole(p.coats, 'Coats');
    var waste = required(p.wastePct, 'Paint allowance', true) / 100;
    var canL = required(p.canLiters, 'Container liters');
    var netArea = area - open;
    var liters = netArea * coats * (1 + waste) / coverage;
    var primerCoverage = p.primerCoverage == null ? PAINT_COVERAGE.primer : required(p.primerCoverage, 'Primer coverage');
    var primerLiters = p.includePrimer && p.type !== 'primer' ? netArea * (1 + waste) / primerCoverage : 0;
    return { area: netArea, grossArea: area, openings: open, coats: coats, coverage: coverage,
      liters: liters, cans: purchase(liters / canL), canLiters: canL,
      primerLiters: primerLiters, primerCans: purchase(primerLiters / canL),
      note: 'Coverage varies by manufacturer, surface porosity and application. Check product label and required coats.' };
  }
  function tile(p) {
    var L = required(p.length, 'Floor length'), W = required(p.width, 'Floor width');
    var info = pick(TILE_DATA, p.size, 'tile size');
    var pcsBox = whole(p.pcsPerBox, 'Pieces per box');
    var allowance = required(p.allowance, 'Tile waste allowance', true);
    if (allowance > 1) throw new Error('Tile allowance must be a decimal between 0 and 1.');
    var coverage = required(p.adhesiveCoverage, 'Adhesive coverage');
    var adhesiveWaste = required(p.adhesiveWastePct, 'Adhesive allowance', true) / 100;
    var groutRate = required(p.groutRate, 'Grout rate', true);
    var area = L * W;
    var tiles = purchase(area / (info.w * info.h) * (1 + allowance));
    var adhesiveBags = purchase(area * (1 + adhesiveWaste) / coverage);
    var groutKg = area * groutRate;
    return { area: area, tiles: tiles, boxes: purchase(tiles / pcsBox), pcsPerBox: pcsBox,
      adhesiveBags: adhesiveBags, groutKg: groutKg, groutBuyKg: Math.ceil(groutKg * 2 - 1e-9) / 2,
      note: 'Tile-box count uses your entered package size. Adhesive coverage and grout rate must be confirmed from the product technical sheet.' };
  }
  function nail(p) {
    var data = pick(NAIL_DATA, p.type, 'nail type');
    var L = required(p.length, 'Length', true), boards = whole(p.boards, 'Boards', true);
    if (L === 0 && boards === 0) throw new Error('Enter a structure length or number of boards.');
    var spacing = required(p.spacingCm, 'Spacing') / 100;
    var perJoint = whole(p.nailsPerJoint, 'Nails per joint');
    var waste = required(p.wastePct, 'Nail allowance', true) / 100;
    var joints = L > 0 ? purchase(L / spacing) + 1 : 0;
    var runNails = joints * perJoint;
    var boardNails = boards * data.perBoard;
    var count = purchase((runNails + boardNails) * (1 + waste));
    var kg = count * data.gram / 1000;
    return { type: p.type, size: data.size, joints: joints, runNails: runNails, boardNails: boardNails,
      count: count, kg: kg, buyKg: Math.ceil(kg * 2 - 1e-9) / 2,
      note: 'Generic fastening allowance only. Do not use for specifying roof fixing; follow manufacturer fastening pattern and product type.' };
  }
  function concrete(p) {
    var mix = pick(CONCRETE_CLASS, p.mixClass, 'mix class');
    var count = whole(p.count, 'Number of elements');
    var volume = required(p.length, 'Length') * required(p.width, 'Width') * required(p.height, 'Thickness') * count;
    var waste = required(p.wastePct, 'Concrete allowance', true) / 100;
    var purchaseVol = volume * (1 + waste);
    return { volume: volume, materialVolume: purchaseVol, bags: purchase(purchaseVol * mix.cement),
      sand: purchaseVol * mix.sand, gravel: purchaseVol * mix.gravel,
      className: p.mixClass, ratio: mix.ratio, count: count,
      note: 'Fajardo-style estimating factors for nominal site mix, 40-kg bags. NOT mix-design, compressive-strength, or water recommendations. Structural plans take precedence.' };
  }
  function cost(q, p) {
    var priceKeys = ['cement','steel','ties','paint','primer','tile','adhesive','grout','nails','sand','gravel','labor'];
    var prices = {};
    priceKeys.forEach(function (key) { prices[key] = required(p[key], key + ' price', true); });
    var days = required(p.days, 'Labor days', true), workers = whole(p.workers, 'Workers', true);
    var overheadRate = required(p.overheadPct, 'Overhead', true) / 100;
    var contingencyRate = required(p.contingencyPct, 'Contingency', true) / 100;
    if (overheadRate > 1 || contingencyRate > 1) throw new Error('Overhead and contingency must not exceed 100%.');
    var lines = [];
    function add(label, amount, price, unit, qty) {
      if (!Number.isFinite(amount) || amount < 0 || amount > 1e9) throw new Error('Invalid stored quantity: ' + label + '. Recalculate this material.');
      if (amount > 0) lines.push({ label: label, qty: amount, price: price, unit: unit, amount: amount * price, source: qty });
    }
    var s = q.steel || {}, pa = q.paint || {}, t = q.tile || {}, n = q.nail || {}, c = q.concrete || {};
    add('Main steel bars', Number(s.mainPieces || 0), prices.steel, 'pcs', 'steel');
    add('Tie / stirrup steel', Number(s.tiePieces || 0), prices.ties, 'pcs', 'steel');
    add('Cement (40 kg)', Number(c.bags || 0), prices.cement, 'bags', 'concrete');
    add('Sand', Number(c.sand || 0), prices.sand, 'm³', 'concrete');
    add('Gravel', Number(c.gravel || 0), prices.gravel, 'm³', 'concrete');
    add(pa.type === 'primer' ? 'Primer coating' : 'Finish paint', Number(pa.cans || 0), pa.type === 'primer' ? prices.primer : prices.paint, 'cans', 'paint');
    add('Primer', Number(pa.primerCans || 0), prices.primer, 'cans', 'paint');
    add('Tiles', Number(t.boxes || 0), prices.tile, 'boxes', 'tile');
    add('Tile adhesive (25 kg)', Number(t.adhesiveBags || 0), prices.adhesive, 'bags', 'tile');
    add('Tile grout', Number(t.groutBuyKg || 0), prices.grout, 'kg', 'tile');
    add('Nails', Number(n.buyKg || 0), prices.nails, 'kg', 'nail');
    var materials = lines.reduce(function (sum, line) { return sum + line.amount; }, 0);
    var labor = prices.labor * days * workers;
    var direct = materials + labor;
    var overhead = direct * overheadRate;
    var contingency = (direct + overhead) * contingencyRate;
    return { lines: lines, materials: materials, labor: labor, days: days, workers: workers,
      overhead: overhead, contingency: contingency, total: direct + overhead + contingency,
      warnings: lines.filter(function (line) { return line.price === 0; }).map(function (line) { return line.label + ' has a zero price'; }) };
  }
  return { steel: steel, paint: paint, tile: tile, nail: nail, concrete: concrete, cost: cost,
    constants: { bars: BAR_WEIGHT, concrete: CONCRETE_CLASS, tiles: TILE_DATA, paint: PAINT_COVERAGE } };
});
