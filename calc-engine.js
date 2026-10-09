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
  // Greedy cutting estimate (first-fit decreasing). Each cut list is kept by bar role/diameter.
  // This estimates purchasing quantity, NOT a fabricator-approved cutting or splice schedule.
  function stockBarsForCuts(cuts, stockLength) {
    var pieces = [];
    cuts.forEach(function(c) {
      var len = required(c.length, 'Cut length');
      var count = whole(c.count, 'Cut count');
      if (len > stockLength + 1e-8) throw new Error('Cut exceeds selected stock length. Enter a valid splice lap.');
      if (pieces.length + count > 30000) throw new Error('Too many rebar cuts for one estimate. Divide the project into smaller entries.');
      for (var i = 0; i < count; i++) pieces.push(len);
    });
    pieces.sort(function(a,b) { return b-a; });
    var remaining = [];
    pieces.forEach(function(len) {
      var placed = false;
      for (var j = 0; j < remaining.length; j++) {
        if (remaining[j] + 1e-8 >= len) { remaining[j] -= len; placed = true; break; }
      }
      if (!placed) remaining.push(stockLength - len);
    });
    return remaining.length;
  }
  function spliceForRun(runLength, lapLength, minSplices, stockLength) {
    var requiredSplices = 0;
    if (runLength > stockLength + 1e-8) {
      if (lapLength <= 0 || lapLength >= stockLength) throw new Error('Splicing required: for runs longer than the stock bar, enter a positive lap length smaller than the stock length, based on structural drawings.');
      requiredSplices = Math.max(1, Math.ceil((runLength - stockLength - 1e-8) / (stockLength - lapLength)));
    }
    var splices = Math.max(minSplices, requiredSplices);
    if (splices && (lapLength <= 0 || lapLength >= stockLength)) throw new Error('Splicing requires a valid lap length from the approved structural plan.');
    var total = runLength + splices * lapLength;
    var segment = total / (splices + 1);
    if (segment > stockLength + 1e-8) throw new Error('Not enough splice segments for the selected stock length.');
    return { splices: splices, cutLength: total, segmentLength: segment, segments: splices + 1 };
  }
  function steel(p) {
    var type = String(p.project), L = required(p.length, 'Length / height above floor'), W = required(p.width, 'Width');
    var H = required(p.height, 'Height / depth');
    var spacing = required(p.spacingCm, 'Spacing') / 100;
    var cover = required(p.coverMm, 'Cover', true) / 1000;
    var stock = required(p.stockLength, 'Stock length');
    if ([6, 9, 12].indexOf(stock) === -1) throw new Error('Select a 6 m, 9 m or 12 m stock bar.');
    var mainDia = whole(p.size, 'Main bar diameter'), tieDia = whole(p.tieSize, 'Stirrup diameter');
    pick(BAR_WEIGHT, mainDia, 'main diameter'); pick(BAR_WEIGHT, tieDia, 'stirrup diameter');
    var nElements = p.elementCount == null ? 1 : whole(p.elementCount, 'Number of identical elements');
    var lap = p.lapLength == null ? 0 : required(p.lapLength, 'Splice lap', true);
    var minSplices = p.minSplices == null ? 0 : whole(p.minSplices, 'Minimum splices per longitudinal bar', true);
    var wireCm = p.wireLengthCm == null ? 30 : required(p.wireLengthCm, 'Tie-wire cut length');
    var wireWaste = p.wireWastePct == null ? 10 : required(p.wireWastePct, 'Tie wire allowance', true);
    var wirePerJoin = p.wirePerJoin == null ? 1 : whole(p.wirePerJoin, 'Ties per joint');
    var wireGramPerM = p.wireGramPerM == null ? 15.8 : required(p.wireGramPerM, 'Tie wire mass per meter');
    if (wireWaste > 100 || spacing > 1 || wireCm > 200) throw new Error('Spacing, tie-wire cuts, or allowance exceeds the permitted range.');
    if (cover * 2 >= W || cover * 2 >= H) throw new Error('Cover must be less than half the cross-section dimensions.');
    var mainCuts = [], tieCuts = [], splicesTotal = 0, intersections = 0, mainBars = 0, stirrups = 0;
    var totalMainLen = 0, totalTieLen = 0, mainRun = 0, stirrupCut = 0, verticalRun = L;
    var countLengthwise = 0, countWidthwise = 0, nLayers = 0;
    function addCut(cuts, base, count, allowMin) {
      var joint = spliceForRun(base, lap, allowMin ? minSplices : 0, stock);
      cuts.push({ length: joint.segmentLength, count: count * joint.segments });
      splicesTotal += joint.splices * count;
      return joint.cutLength * count;
    }
    if (['slab', 'footing', 'staircase'].indexOf(type) >= 0) {
      nLayers = whole(p.layers, 'Grid layers');
      if (nLayers < 1 || nLayers > 2) throw new Error('Choose 1 or 2 grid layers.');
      var lenRun = L - 2 * cover, wideRun = W - 2 * cover;
      if (lenRun <= 0 || wideRun <= 0) throw new Error('Cover exceeds the plan dimensions.');
      countLengthwise = (purchase(wideRun / spacing) + 1) * nLayers * nElements;
      countWidthwise = (purchase(lenRun / spacing) + 1) * nLayers * nElements;
      mainBars = countLengthwise + countWidthwise;
      totalMainLen = addCut(mainCuts, lenRun, countLengthwise, true) + addCut(mainCuts, wideRun, countWidthwise, true);
      intersections = (countLengthwise / nLayers) * (countWidthwise / nLayers) * nLayers / nElements;
      mainRun = lenRun;
    } else if (['column', 'beam', 'fence'].indexOf(type) >= 0) {
      var longitudinal = whole(p.longitudinalBars, 'Longitudinal bars');
      var excavation = type === 'column' ? required(p.excavationDepth == null ? 0 : p.excavationDepth, 'Depth below floor', true) : 0;
      var bottomHook = type === 'column' ? required(p.bottomHookM == null ? 0 : p.bottomHookM, 'Bottom hook / anchorage', true) : 0;
      var topHook = type === 'column' ? required(p.topHookM == null ? 0 : p.topHookM, 'Top hook / anchorage', true) : 0;
      var hookMultiple = p.stirrupHookDb == null ? 10 : required(p.stirrupHookDb, 'Stirrup hook tail (db)', true);
      verticalRun = L + excavation;
      mainRun = verticalRun + bottomHook + topHook;
      if (hookMultiple > 30) throw new Error('Stirrup hook tail factor is unexpectedly large.');
      mainBars = longitudinal * nElements;
      totalMainLen = addCut(mainCuts, mainRun, mainBars, true);
      var perElementTieCount = purchase(verticalRun / spacing) + 1;
      stirrups = perElementTieCount * nElements;
      var innerWidth = W - 2 * cover, innerDepth = H - 2 * cover;
      stirrupCut = 2 * (innerWidth + innerDepth) + 2 * hookMultiple * tieDia / 1000;
      totalTieLen = addCut(tieCuts, stirrupCut, stirrups, false);
      intersections = stirrups * longitudinal;
    } else throw new Error('Unknown steel project type.');
    var mainStocks = stockBarsForCuts(mainCuts, stock), tieStocks = stockBarsForCuts(tieCuts, stock);
    // #16 annealed wire typical diameter ~1.6mm, approx 15.8g/m; editable by manufacturer.
    var wireKg = intersections * wirePerJoin * wireCm / 100 * wireGramPerM / 1000 * (1 + wireWaste / 100);
    return { type: type, elementCount: nElements, mainDiameter: mainDia, tieDiameter: tieDia,
      stockLength: stock, mainBars: mainBars, mainRunLength: mainRun, verticalLength: verticalRun,
      excavationDepth: type === 'column' ? excavation : 0, bottomHook: type === 'column' ? bottomHook : 0,
      topHook: type === 'column' ? topHook : 0, spliceLap: lap, spliceCount: splicesTotal,
      mainCuts: mainCuts, tieCuts: tieCuts, countLengthwise: countLengthwise, countWidthwise: countWidthwise,
      layers: nLayers, stirrups: stirrups, stirrupCutLength: stirrupCut,
      mainLength: totalMainLen, tieLength: totalTieLen,
      mainWeight: totalMainLen * BAR_WEIGHT[mainDia], tieWeight: totalTieLen * BAR_WEIGHT[tieDia],
      mainPieces: mainStocks, tiePieces: tieStocks, pieces: mainStocks + tieStocks,
      tieWireJoints: intersections, tieWireKg: wireKg, wireBuyKg: Math.ceil(wireKg * 2 - 1e-9) / 2,
      note: 'Preliminary take-off. Hooks and laps are user-entered lengths, NOT validated code detailing; segment splits are estimating assumptions only. Verify bar splices, 135-degree ties, covers and positions from approved structural plans.' };
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
    var belowFloor = p.project === 'column' ? required(p.belowFloorM == null ? 0 : p.belowFloorM, 'Column depth below FFL', true) : 0;
    var totalHeight = required(p.height, 'Height / thickness') + belowFloor;
    var volume = required(p.length, 'Length') * required(p.width, 'Width') * totalHeight * count;
    var waste = required(p.wastePct, 'Concrete allowance', true) / 100;
    var purchaseVol = volume * (1 + waste);
    return { volume: volume, materialVolume: purchaseVol, bags: purchase(purchaseVol * mix.cement),
      sand: purchaseVol * mix.sand, gravel: purchaseVol * mix.gravel,
      className: p.mixClass, ratio: mix.ratio, count: count, belowFloor: belowFloor, totalHeight: totalHeight,
      note: 'Fajardo-style estimating factors for nominal site mix, 40-kg bags. NOT mix-design, compressive-strength, or water recommendations. Structural plans take precedence.' };
  }

  // Formwork is a MATERIAL QUANTITY estimate only; this DOES NOT design shoring,
  // scaffolding, bracing capacity, load paths, or connections. All spacings entered
  // here are take-off assumptions; use the engineer's temporary-works drawings.
  var FORMWORK_NAILS = { '1': 0.9, '1.5': 1.6, '2': 2.8, '3': 6, '3-concrete': 8.5 }; // indicative g/nail, editable
  var FORMWORK_LUMBER = ['2x2x8','2x2x10','2x2x12','2x3x8','2x3x10','2x3x12','2x4x8','2x4x10','2x4x12','3x3x10','3x3x12'];
  function parseLumber(spec) {
    if (FORMWORK_LUMBER.indexOf(spec) < 0) throw new Error('Choose a valid coco lumber dimension and stock length.');
    var parts = spec.split('x');
    return { spec:spec, size:parts[0]+'x'+parts[1], feet:Number(parts[2]), stockLength:Number(parts[2])*.3048 };
  }
  function splitWoodMembers(cuts, memberLength, count, stockLength) {
    if (!count || !memberLength) return 0;
    if (count > 30000) throw new Error('Too many lumber cuts. Divide your estimate into smaller sections.');
    var segments = Math.ceil(memberLength / stockLength - 1e-9);
    if (segments > 1000 || segments * count > 30000) throw new Error('Too many lumber cut segments. Divide the work into smaller sections.');
    // The equal cuts are a procurement approximation, NOT an approved splice detail.
    cuts.push({length:memberLength / segments, count:count * segments});
    return count * (segments-1);
  }
  function formwork(p) {
    var type = String(p.type);
    var known = {column:1, beam:1, slab:1, footing:1, scaffolding:1, area:1};
    pick(known, type, 'formwork type');
    var count = whole(p.count == null ? 1 : p.count,'Number of identical elements');
    var L = type === 'area' ? 0 : required(p.length,'Formwork length');
    var W = type === 'area' ? 0 : required(p.width,'Formwork width');
    var H = ['column','beam','footing'].indexOf(type) >= 0 ? required(p.height,'Formwork depth / height') : 0;
    var sqm = type === 'area' ? required(p.areaSqm,'Area per element')*count :
      (type === 'column' ? 2*(W+H)*L*count :
       type === 'beam' ? (W+2*H)*L*count :
       type === 'footing' ? 2*(L+W)*H*count : L*W*count);
    if (sqm > 1000000) throw new Error('Area is too large for a single estimate.');
    var plywoodThickness = String(p.plywoodThickness);
    if (['1/2','3/4'].indexOf(plywoodThickness)<0) throw new Error('Choose phenolic 1/2 or 3/4 inch.');
    var sheetCoverage = required(p.sheetCoverageSqm == null ? 2.44 : p.sheetCoverageSqm,'Effective area per plywood sheet');
    if (sheetCoverage > 10) throw new Error('Plywood sheet coverage must be no more than 10 m².');
    var plywoodWastePct = required(p.plywoodWastePct == null ? 0 : p.plywoodWastePct,'Plywood waste',true);
    if (plywoodWastePct > 100) throw new Error('Plywood allowance must not exceed 100%.');
    var plywoodArea = sqm*(1+plywoodWastePct/100);
    var plywoodSheets = purchase(plywoodArea / sheetCoverage);
    var frameSpec = parseLumber(String(p.frameLumber || '2x3x10'));
    var braceSpec = parseLumber(String(p.braceLumber || '2x2x10'));
    var framingSpacing = required(p.framingSpacingCm == null ? (type==='slab'?40:60) : p.framingSpacingCm,'Frame / joist spacing (cm)')/100;
    var braceSpacing = required(p.braceSpacingM == null ? 2 : p.braceSpacingM,'Diagonal brace interval (m)');
    var braceLength = required(p.braceLengthM == null ? 1.5 : p.braceLengthM,'Diagonal brace cut length (m)');
    var bracePerStation = whole(p.bracesPerStation == null ? 1 : p.bracesPerStation,'Braces per interval');
    if (framingSpacing < .1 || framingSpacing > 5 || braceSpacing > 20 || braceLength > 20 || bracePerStation > 12) {
      throw new Error('Check frame spacing, brace interval, and brace length.');
    }
    var framingCuts = [], braceCuts = [], framingStations = 0, braces = 0, impliedWoodJoints = 0;
    function frame(len,qty) { impliedWoodJoints += splitWoodMembers(framingCuts,len,qty*count,frameSpec.stockLength); }
    if (type === 'slab' || type === 'scaffolding') {
      // Joists run lengthwise, at the entered centers across the slab width.
      framingStations = purchase(W / framingSpacing)+1;
      frame(L,framingStations);
      frame(L,2); // perimeter runners, longitudinal
      frame(W,2); // perimeter runners, transverse
    } else if (type === 'beam') {
      framingStations = purchase(L / framingSpacing)+1;
      frame(H,2*framingStations); // side vertical cleats
      frame(W,framingStations);   // soffit cross supports
      frame(L,3); // longitudinal bottom + side runners
    } else if (type === 'column') {
      framingStations = purchase(L / framingSpacing)+1;
      frame(L,4);             // vertical corner pieces
      frame(W,2*framingStations);
      frame(H,2*framingStations);
    } else if (type === 'footing') {
      var perimeter = 2*(L+W);
      framingStations = purchase(perimeter/framingSpacing);
      frame(H,framingStations);
      frame(L,4); frame(W,4); // top/bottom runners on four faces
    }
    if (type !== 'area') {
      var braceRun = type === 'column' ? L : type === 'footing' ? 2*(L+W) : L;
      braces = purchase(braceRun / braceSpacing)*bracePerStation*count;
      impliedWoodJoints += splitWoodMembers(braceCuts,braceLength,braces,braceSpec.stockLength);
    }
    var framingBars = stockBarsForCuts(framingCuts,frameSpec.stockLength);
    var braceBars = stockBarsForCuts(braceCuts,braceSpec.stockLength);
    var cutGroups = [{spec:frameSpec.spec,stockLength:frameSpec.stockLength,cuts:framingCuts},
      {spec:braceSpec.spec,stockLength:braceSpec.stockLength,cuts:braceCuts}];
    var nailsType = String(p.nailSize || '2');
    var nailDefault = pick(FORMWORK_NAILS,nailsType,'nail size');
    var nailGram = required(p.nailGram == null ? nailDefault : p.nailGram,'Grams per nail');
    var nailsPerSqm = required(p.nailsPerSqm == null ? 20 : p.nailsPerSqm,'Nails per square meter',true);
    var nailWaste = required(p.nailWastePct == null ? 10 : p.nailWastePct,'Nail allowance',true);
    if (nailWaste > 100 || nailsPerSqm > 1000) throw new Error('Nail rate or allowance is too high.');
    var nailCount = purchase(sqm*nailsPerSqm*(1+nailWaste/100));
    var nailKg = nailCount*nailGram/1000;
    return {type:type, elementCount:count, areaSqm:sqm, plywoodAreaSqm:plywoodArea, plywoodWastePct:plywoodWastePct,
      plywoodThickness:plywoodThickness, sheetCoverageSqm:sheetCoverage, plywoodSheets:plywoodSheets,
      framingSpacingCm:framingSpacing*100, framingStations:framingStations, braceSpacingM:braceSpacing, braceLengthM:braceLength,
      braceCount:braces, frameLumber:frameSpec.spec, braceLumber:braceSpec.spec,
      framingCuts:framingCuts, braceCuts:braceCuts, cutGroups:cutGroups, framingBars:framingBars, braceBars:braceBars,
      woodJoints:impliedWoodJoints,nailSize:nailsType,nailGram:nailGram,nailCount:nailCount,nailKg:nailKg,
      nailBuyKg:Math.ceil(nailKg*2 - 1e-9)/2,
      note: 'Area-based plywood take-off, 2.44 m²/sheet default editable. Joists, coco lumber, diagonal slants and nails are approximate inputs, NOT a temporary-works or scaffold safety design. Verify panel cuts, props, load ratings, spacing and bracing from approved plans.'};
  }

  function cost(q, p) {
    var priceKeys = ['wire','cement','steel','ties','paint','primer','tile','adhesive','grout','nails','sand','gravel','labor','plywood','lumber','formnails'];
    var prices = {};
    priceKeys.forEach(function (key) { prices[key] = required(p[key] == null && ['wire','plywood','lumber','formnails'].indexOf(key) >= 0 ? 0 : p[key], key + ' price', true); });
    var days = required(p.days, 'Labor days', true), workers = whole(p.workers, 'Workers', true);
    var overheadRate = required(p.overheadPct, 'Overhead', true) / 100;
    var contingencyRate = required(p.contingencyPct, 'Contingency', true) / 100;
    if (overheadRate > 1 || contingencyRate > 1) throw new Error('Overhead and contingency must not exceed 100%.');
    var lines = [];
    function add(label, amount, price, unit, qty) {
      if (!Number.isFinite(amount) || amount < 0 || amount > 1e9) throw new Error('Invalid stored quantity: ' + label + '. Recalculate this material.');
      if (amount > 0) lines.push({ label: label, qty: amount, price: price, unit: unit, amount: amount * price, source: qty });
    }
    var s = q.steel || {}, pa = q.paint || {}, t = q.tile || {}, n = q.nail || {}, c = q.concrete || {}, f = q.formwork || {};
    add('Main steel bars', Number(s.mainPieces || 0), prices.steel, 'pcs', 'steel');
    add('Tie / stirrup steel', Number(s.tiePieces || 0), prices.ties, 'pcs', 'steel');
    add('Tie wire (#16)', Number(s.wireBuyKg || 0), prices.wire, 'kg', 'steel');
    add('Cement (40 kg)', Number(c.bags || 0), prices.cement, 'bags', 'concrete');
    add('Sand', Number(c.sand || 0), prices.sand, 'm³', 'concrete');
    add('Gravel', Number(c.gravel || 0), prices.gravel, 'm³', 'concrete');
    add(pa.type === 'primer' ? 'Primer coating' : 'Finish paint', Number(pa.cans || 0), pa.type === 'primer' ? prices.primer : prices.paint, 'cans', 'paint');
    add('Primer', Number(pa.primerCans || 0), prices.primer, 'cans', 'paint');
    add('Tiles', Number(t.boxes || 0), prices.tile, 'boxes', 'tile');
    add('Tile adhesive (25 kg)', Number(t.adhesiveBags || 0), prices.adhesive, 'bags', 'tile');
    add('Tile grout', Number(t.groutBuyKg || 0), prices.grout, 'kg', 'tile');
    add('Nails', Number(n.buyKg || 0), prices.nails, 'kg', 'nail');
    add('Phenolic plywood ' + (f.plywoodThickness || ''), Number(f.plywoodSheets || 0), prices.plywood, 'sheets', 'formwork');
    add('Coco lumber — framing', Number(f.framingBars || 0), prices.lumber, 'pcs', 'formwork');
    add('Coco lumber — braces', Number(f.braceBars || 0), prices.lumber, 'pcs', 'formwork');
    add('Formwork nails ' + (f.nailSize || ''), Number(f.nailBuyKg || 0), prices.formnails, 'kg', 'formwork');
    var materials = lines.reduce(function (sum, line) { return sum + line.amount; }, 0);
    var labor = prices.labor * days * workers;
    var direct = materials + labor;
    var overhead = direct * overheadRate;
    var contingency = (direct + overhead) * contingencyRate;
    return { lines: lines, materials: materials, labor: labor, days: days, workers: workers,
      overhead: overhead, contingency: contingency, total: direct + overhead + contingency,
      warnings: lines.filter(function (line) { return line.price === 0; }).map(function (line) { return line.label + ' has a zero price'; }) };
  }
  function projectSummary(items, p) {
    if (!Array.isArray(items) || items.length > 1000) throw new Error('Invalid project sheet (maximum 1,000 entries).');
    var priceKeys = ['wire','cement','steel','ties','paint','primer','tile','adhesive','grout','nails','sand','gravel','labor','plywood','lumber','formnails'];
    var prices = {};
    priceKeys.forEach(function(key) { prices[key] = required(p[key] == null ? 0 : p[key], key + ' price', true); });
    var groups = {}, cutting = {}, woodCutting = {}, plywood = {}, formNails = {};
    function put(key, label, qty, unit, rateKey, section) {
      var value = required(qty, label, true);
      if (!value) return;
      if (!groups[key]) groups[key] = { key: key, label: label, qty: 0, unit: unit, rateKey: rateKey, section: section };
      groups[key].qty += value;
    }
    items.forEach(function(item) {
      if (!item || typeof item !== 'object' || !item.qty || typeof item.qty !== 'object') throw new Error('Invalid project item.');
      var q = item.qty, section = String(item.section || item.module || 'other');
      if (item.module === 'steel') {
        if (!Array.isArray(q.mainCuts) || !Array.isArray(q.tieCuts)) throw new Error('Old rebar entry found. Reopen and recalculate it.');
        ['main','tie'].forEach(function(role) {
          var cuts = role === 'main' ? q.mainCuts : q.tieCuts;
          var diameter = role === 'main' ? q.mainDiameter : q.tieDiameter;
          if (!cuts.length) return;
          var key = role + '-' + diameter + 'mm-' + q.stockLength + 'm';
          if (!cutting[key]) cutting[key] = { key: key, label: (role === 'main' ? 'Main rebars' : 'Anilyo / stirrup bars') + ' ' + diameter + 'mm × ' + q.stockLength + 'm', stock: q.stockLength, role: role, cuts: [], rateKey: role === 'main' ? 'steel' : 'ties', section: section };
          cuts.forEach(function(cut) { cutting[key].cuts.push(cut); });
        });
        put('wire-16', 'Tie wire (#16 gauge)', q.tieWireKg || 0, 'kg', 'wire', section);
      } else if (item.module === 'concrete') {
        put('cement-40', 'Cement (40 kg)', q.bags || 0, 'bags', 'cement', section);
        put('sand', 'Sand', q.sand || 0, 'm³', 'sand', section);
        put('gravel', 'Gravel', q.gravel || 0, 'm³', 'gravel', section);
      } else if (item.module === 'paint') {
        var size = q.canLiters || 4;
        put((q.type === 'primer' ? 'primer-' : 'paint-') + size, (q.type === 'primer' ? 'Primer paint ' : 'Finish paint ') + size + ' L', q.cans || 0, 'cans', q.type === 'primer' ? 'primer' : 'paint', section);
        put('primer-' + size, 'Primer paint ' + size + ' L', q.primerCans || 0, 'cans', 'primer', section);
      } else if (item.module === 'tile') {
        put('tiles-' + (q.tileSize || 'unknown') + '-' + (q.pcsPerBox || 0), 'Tiles ' + (q.tileSize || 'size unspecified') + ' (' + (q.pcsPerBox || '?') + '/box)', q.boxes || 0, 'boxes', 'tile', section);
        put('adhesive-25', 'Tile adhesive (25 kg)', q.adhesiveBags || 0, 'bags', 'adhesive', section);
        put('grout', 'Tile grout', q.groutBuyKg || 0, 'kg', 'grout', section);
      } else if (item.module === 'formwork') {
        if (!Array.isArray(q.cutGroups) || !Number.isFinite(Number(q.plywoodAreaSqm))) throw new Error('Outdated formwork item. Reopen and recalculate it.');
        var plyKey = 'phenolic-' + q.plywoodThickness + '-' + q.sheetCoverageSqm;
        if (!plywood[plyKey]) plywood[plyKey] = { key:plyKey, label:'Phenolic plywood ' + q.plywoodThickness + ' in (' + q.sheetCoverageSqm + ' m²/sheet)', area:0, coverage:Number(q.sheetCoverageSqm), section:section };
        plywood[plyKey].area += required(q.plywoodAreaSqm,'Formwork plywood area',true);
        q.cutGroups.forEach(function(g) {
          if (!g.cuts || !g.cuts.length) return;
          var key = 'coco-' + g.spec;
          if (!woodCutting[key]) woodCutting[key] = { key:key, label:'Coco lumber ' + g.spec.replace(/x/g,'×') + ' ft', stock:Number(g.stockLength), cuts:[], section:section };
          if (Math.abs(woodCutting[key].stock - Number(g.stockLength)) > 1e-8) throw new Error('Inconsistent coco lumber stock length.');
          g.cuts.forEach(function(cut) { woodCutting[key].cuts.push(cut); });
        });
        var nkey = 'form-nails-' + q.nailSize;
        if (!formNails[nkey]) formNails[nkey] = { key:nkey,label:'Formwork nails ' + (q.nailSize === '3-concrete' ? '3 in (concrete)' : q.nailSize + ' in'),kg:0,section:section };
        formNails[nkey].kg += required(q.nailKg,'Formwork nail kilograms',true);
      } else if (item.module === 'nail') {
        put('nails-' + (q.nailSize || 'mixed'), 'Nails (' + (q.nailSize || 'unspecified') + ')', q.buyKg || 0, 'kg', 'nails', section);
      } else throw new Error('Invalid project item category.');
    });
    Object.keys(cutting).forEach(function(key) {
      var c = cutting[key];
      put(key, c.label, stockBarsForCuts(c.cuts, c.stock), 'bars', c.rateKey, c.section);
    });
    Object.keys(plywood).forEach(function(key) {
      var g=plywood[key]; put(key,g.label,purchase(g.area/g.coverage),'sheets','plywood',g.section);
    });
    Object.keys(woodCutting).forEach(function(key) {
      var g=woodCutting[key]; put(key,g.label,stockBarsForCuts(g.cuts,g.stock),'pcs','lumber',g.section);
    });
    Object.keys(formNails).forEach(function(key) {
      var g=formNails[key]; put(key,g.label,Math.ceil(g.kg*2-1e-9)/2,'kg','formnails',g.section);
    });
    if (groups['wire-16']) groups['wire-16'].qty = Math.ceil(groups['wire-16'].qty * 2 - 1e-9) / 2;
    var rateOverrides = p.rateOverrides && typeof p.rateOverrides === 'object' ? p.rateOverrides : {};
    var lines = Object.values(groups).map(function(g) {
      g.rate = Object.prototype.hasOwnProperty.call(rateOverrides, g.key) ? required(rateOverrides[g.key], 'Project rate for ' + g.label, true) : prices[g.rateKey]; g.amount = g.qty * g.rate; return g;
    }).sort(function(a,b) { return a.label.localeCompare(b.label); });
    var materials = lines.reduce(function(s, l) { return s + l.amount; }, 0);
    var labor = prices.labor * required(p.days == null ? 0 : p.days, 'Labor days', true) * whole(p.workers == null ? 0 : p.workers, 'Workers', true);
    var ohPct = required(p.overheadPct == null ? 0 : p.overheadPct, 'Overhead percent', true);
    var contPct = required(p.contingencyPct == null ? 0 : p.contingencyPct, 'Contingency percent', true);
    if (ohPct > 100 || contPct > 100) throw new Error('Overhead and contingency must not exceed 100%.');
    var overhead = (materials + labor) * ohPct / 100;
    var contingency = (materials + labor + overhead) * contPct / 100;
    return { lines: lines, materials: materials, labor: labor, overhead: overhead, contingency: contingency,
      total: materials + labor + overhead + contingency,
      warnings: lines.filter(function(l) { return !l.rate; }).map(function(l) { return l.label + ': price not entered'; }) };
  }
  return { steel: steel, paint: paint, tile: tile, nail: nail, concrete: concrete, formwork: formwork, cost: cost, projectSummary: projectSummary,
    constants: { bars: BAR_WEIGHT, concrete: CONCRETE_CLASS, tiles: TILE_DATA, paint: PAINT_COVERAGE, formNails: FORMWORK_NAILS, formLumber: FORMWORK_LUMBER } };
});
