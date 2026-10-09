/* BuildCalc calculation engine v6. Pure functions: browser global + Node exports for testing.
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
    AA: { ratio: '1 : 1.5 : 3', cement: 12, cement50: 9.5, sand: .5, gravel: 1 },
    A:  { ratio: '1 : 2 : 4', cement: 9, cement50: 7, sand: .5, gravel: 1 },
    B:  { ratio: '1 : 2.5 : 5', cement: 7.5, cement50: 6, sand: .5, gravel: 1 },
    C:  { ratio: '1 : 3 : 6', cement: 6, cement50: 5, sand: .5, gravel: 1 }
  };
  // Source: supplied scanned Fajardo book, Table 2-2 (printed p.53), 40-kg cement bags per m².
  // CHB 10, 15, 20 cm thickness, all 20 × 40 cm laid faces: 12.5 blocks per m².
  var CHB_MORTAR = {
    '10': { A:.792, B:.522, C:.394, D:.328, sand:.0435 },
    '15': { A:1.526, B:1.018, C:.763, D:.633, sand:.0844 },
    '20': { A:2.260, B:1.500, C:1.125, D:.938, sand:.1250 }
  };
  // Source: Table 2-4 (printed p.56), quantities per m² of wall face.
  var PLASTER_MORTAR = {
    A: {8:.144,12:.216,16:.288,20:.360,25:.450},
    B: {8:.096,12:.144,16:.192,20:.240,25:.300},
    C: {8:.072,12:.108,16:.144,20:.180,25:.225},
    D: {8:.060,12:.090,16:.120,20:.150,25:.188}
  };
  var PLASTER_SAND = {8:.008,12:.012,16:.016,20:.020,25:.025};
  // Fajardo, printed p.312, one coat per nominal 4-liter gallon by finish texture.
  var PAINT_SURFACE_GALLON = { rough:30, medium:35, smooth:40 };
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
  function purchase(amount) { return Math.max(0, Math.ceil(amount - 1e-9)); }
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
    var wireGramPerM = p.wireGramPerM == null ? 1000 / 53 : required(p.wireGramPerM, 'Tie wire mass per meter');
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
    // Fajardo, printed pp.110/118: approximately 53 m of #16 GI wire per kilogram; editable by supplier.
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
    var bagKg = p.bagKg == null ? 40 : Number(p.bagKg);
    if (![40, 50].includes(bagKg)) throw new Error('Choose 40 kg or 50 kg cement bags.');
    var waste = required(p.wastePct, 'Concrete allowance', true) / 100;
    var purchaseVol = volume * (1 + waste);
    return { volume: volume, materialVolume: purchaseVol, cementExactBags: purchaseVol * (bagKg === 40 ? mix.cement : mix.cement50),
      bags: purchase(purchaseVol * (bagKg === 40 ? mix.cement : mix.cement50)), bagKg: bagKg,
      sand: purchaseVol * mix.sand, gravel: purchaseVol * mix.gravel,
      className: p.mixClass, ratio: mix.ratio, count: count, belowFloor: belowFloor, totalHeight: totalHeight,
      note: 'Fajardo Table 1-2 (printed p.8): nominal concrete material quantities with selected 40/50 kg cement. This is NOT an engineered mix design; structural plans take precedence.' };
  }


  function chb(p) {
    var thickness = String(p.thicknessCm == null ? (p.thickness == null ? '10' : p.thickness) : p.thicknessCm);
    var mixClass = String(p.mixClass || 'B');
    var row = pick(CHB_MORTAR, thickness, 'CHB thickness');
    var cementPerSqm = pick(row, mixClass, 'CHB mortar class');
    var length = required(p.length, 'Wall length'), height = required(p.height, 'Wall height');
    var count = whole(p.count == null ? 1 : p.count, 'Wall count');
    var openings = required(p.openings == null ? 0 : p.openings, 'Openings per wall', true);
    var each = length * height - openings;
    if (each <= 0) throw new Error('Wall openings must be smaller than each wall area.');
    var area = each * count;
    var waste = required(p.wastePct == null ? 0 : p.wastePct, 'Material allowance', true);
    if (waste > 100) throw new Error('Material allowance must not exceed 100%.');
    var adjusted = area * (1 + waste / 100);
    return { area:area, thicknessCm:Number(thickness), mixClass:mixClass, count:count,
      blocksExact:adjusted * 12.5, blocks:purchase(adjusted * 12.5),
      cementExactBags:adjusted * cementPerSqm, bags:purchase(adjusted * cementPerSqm), bagKg:40,
      sand:adjusted * row.sand, tableCementPerSqm:cementPerSqm, tableSandPerSqm:row.sand,
      source:'Fajardo Table 2-2 (printed p.53)',
      note:'Fajardo CHB laying-mortar area method: 12.5 blocks/m² for 20×40 cm blocks, 40-kg cement. Openings are subtracted; waste allowance is additional. Does NOT include reinforcement, CHB footing, grout/core fill, plaster or lintels.' };
  }
  function plaster(p) {
    var mixClass = String(p.mixClass || 'B');
    var thickness = Number(p.thicknessMm == null ? 16 : p.thicknessMm);
    var row = pick(PLASTER_MORTAR, mixClass, 'plaster mix class');
    if (![8,12,16,20,25].includes(thickness)) throw new Error('Choose a plaster thickness listed in Table 2-4.');
    var count = whole(p.count == null ? 1 : p.count, 'Wall count');
    var faces = whole(p.faces == null ? 2 : p.faces, 'Plaster faces');
    if (faces < 1 || faces > 2) throw new Error('Select one or two plastered faces.');
    var length = required(p.length, 'Wall length'), height = required(p.height, 'Wall height');
    var openings = required(p.openings == null ? 0 : p.openings, 'Opening area per face per wall', true);
    var each = length * height - openings;
    if (each <= 0) throw new Error('Openings must be smaller than each wall face.');
    var area = each * count * faces;
    var waste = required(p.wastePct == null ? 0 : p.wastePct, 'Material allowance', true);
    if (waste > 100) throw new Error('Material allowance must not exceed 100%.');
    var adjusted = area * (1 + waste / 100);
    return { area:area, mixClass:mixClass, thicknessMm:thickness, faces:faces, count:count,
      mortarVolume:adjusted * thickness / 1000,
      cementExactBags: adjusted * row[thickness], bags:purchase(adjusted * row[thickness]), bagKg:40,
      sand: adjusted * PLASTER_SAND[thickness], tableCementPerSqm:row[thickness], tableSandPerSqm:PLASTER_SAND[thickness],
      source:'Fajardo Table 2-4 (printed p.56)',
      note:'Fajardo plaster area method, 40-kg cement bags. Quantities exclude CHB laying mortar, primer, painting and special wall finishes. Deduct openings separately per face.' };
  }

  // Formwork is a MATERIAL QUANTITY estimate only; this DOES NOT design shoring,
  // scaffolding, bracing capacity, load paths, or connections. All spacings entered
  // here are take-off assumptions; use the engineer's temporary-works drawings.
  var FORMWORK_NAILS = { '1': 0.9, '1.5': 1.6, '2': 2.8, '3': 6, '3-concrete': 8.5 }; // indicative g/nail, editable
  // Fajardo, Simplified Construction Estimate (2000 ed.), plywood forms Table 5-1.
  // Board-feet of framing PER 1.20m x 2.40m (2.88m²) form sheet, 12mm plywood.
  // 18mm phenolic is NOT in this table: conservatively retain 12mm factor pending plans.
  var FAJARDO_FRAME_12MM = { column: {'2x2':20.33, '2x3':30.50}, beam: {'2x2':18.66, '2x3':28.00} };
  // Fajardo Table 5-3: flooring staging (NOT slab joist/frame), board-feet per m².
  var FAJARDO_STAGE_FLOOR = {'2x2':6.10, '2x3':9.10, '2x4':12.10};
  var FORMWORK_LUMBER = ['2x2x8','2x2x10','2x2x12','2x3x8','2x3x10','2x3x12','2x4x8','2x4x10','2x4x12','3x3x10','3x3x12'];
  function parseLumber(spec) {
    if (FORMWORK_LUMBER.indexOf(spec) < 0) throw new Error('Choose a valid coco lumber dimension and stock length.');
    var parts = spec.split('x');
    return { spec:spec, size:parts[0]+'x'+parts[1], inchesA:Number(parts[0]), inchesB:Number(parts[1]), feet:Number(parts[2]), stockLength:Number(parts[2])*.3048, boardFeetPerPiece:Number(parts[0])*Number(parts[1])*Number(parts[2])/12 };
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
  // Fajardo, Simplified Construction Estimate, printed p.151 (Illustration 4-3):
  // board feet = thickness(in) × width(in) × length(ft) / 12.
  function lumber(p) {
    var spec=parseLumber(String(p.spec||'2x3x10'));
    var memberM=required(p.memberLengthM,'Wood member length');
    if (memberM > spec.stockLength + 1e-8) throw new Error('Member is longer than the chosen coco lumber stock. Choose longer stock or enter approved joints as separate cuts.');
    var count=whole(p.count,'Wood member count');
    var waste=required(p.wastePct==null?0:p.wastePct,'Wood spare allowance',true);
    if (waste>100) throw new Error('Wood spare allowance cannot exceed 100%.');
    var cuts=purchase(count*(1+waste/100));
    if(cuts>30000) throw new Error('Too many cuts. Divide this lumber estimate into smaller sections.');
    var stockPieces=stockBarsForCuts([{length:memberM,count:cuts}],spec.stockLength);
    var boardFeetNet=spec.inchesA*spec.inchesB*(memberM/.3048)*count/12;
    return { spec:spec.spec, size:spec.size, memberLengthM:memberM, count:count, cuts:cuts,
      stockLength:spec.stockLength, stockPieces:stockPieces, boardFeetNet:boardFeetNet,
      boardFeetToBuy:stockPieces*spec.boardFeetPerPiece,
      cutGroups:[{spec:spec.spec,stockLength:spec.stockLength,cuts:[{length:memberM,count:cuts}]}],
      note:'Fajardo lumber board-foot method (printed p.151) + first-fit stock cutting estimate. Waste is extra full-length cut members, not engineered connections. Timber species, grade and loads must follow design.'};
  }
  function formwork(p) {
    var type = String(p.type);
    var known = {column:1, beam:1, slab:1, footing:1, scaffolding:1, area:1};
    pick(known, type, 'formwork type');
    var count = whole(p.count == null ? 1 : p.count,'Number of identical elements');
    var L = type === 'area' ? 0 : required(p.length,'Formwork length');
    var W = type === 'area' ? 0 : required(p.width,'Formwork width');
    var H = ['column','beam','footing'].indexOf(type) >= 0 ? required(p.height,'Formwork depth / height') : 0;
    // Fajardo: columns add 0.20m lap to lateral perimeter; beams add 0.10m.
    // Footing is counted by four exposed sides; slab by soffit area.
    var formPerimeter = type==='column' ? 2*(W+H)+0.20 : type==='beam' ? W+2*H+0.10 : type==='footing' ? 2*(L+W) : 0;
    var sqm = type === 'area' ? required(p.areaSqm,'Area per element')*count :
      (type === 'column' || type === 'beam' ? formPerimeter*L*count :
       type === 'footing' ? formPerimeter*H*count : type==='scaffolding' ? 0 : L*W*count);
    var stagingArea = type==='scaffolding' ? L*W*count : 0;
    if (sqm > 1000000) throw new Error('Area is too large for a single estimate.');
    var plywoodThickness = String(p.plywoodThickness);
    if (['1/2','3/4'].indexOf(plywoodThickness)<0) throw new Error('Choose phenolic 1/2 or 3/4 inch.');
    var sheetCoverage = required(p.sheetCoverageSqm == null ? 2.88 : p.sheetCoverageSqm,'Effective area per plywood sheet');
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
    var framingBoardFeet = 0, frameFactor = 0, factorOrigin = '', frameMethod = '';
    function factorStock(bdft,spec) { var n=purchase(bdft/spec.boardFeetPerPiece); if(n>30000)throw new Error('Lumber quantity exceeds a single estimate.'); if(n)framingCuts.push({length:spec.stockLength,count:n}); return n; }
    function frame(len,qty) { impliedWoodJoints += splitWoodMembers(framingCuts,len,qty*count,frameSpec.stockLength); }
    if (type === 'scaffolding') {
      // Fajardo Table 5-3: flooring/staging only. It is NOT a plywood form.
      frameMethod = 'Fajardo Table 5-3: flooring staging';
      frameFactor = FAJARDO_STAGE_FLOOR[frameSpec.size];
      if (!frameFactor) { frameFactor = 9.10*(frameSpec.inchesA*frameSpec.inchesB/6); factorOrigin='Extrapolated beyond listed 2x2, 2x3, 2x4 sizes'; }
      framingBoardFeet = stagingArea*frameFactor;
      factorStock(framingBoardFeet,frameSpec);
    } else if (type === 'column' || type === 'beam') {
      // Fajardo 2000 ed. Table 5-1, wood framing per 2.88m² sheet (12mm).
      // Match material coverage quantity to Fajardo standard reference sheet.
      // An explicitly smaller effective cover remains a separate user site allowance.
      frameMethod = 'Fajardo Table 5-1: frame board-feet per reference 2.88m² plywood form';
      var factor = FAJARDO_FRAME_12MM[type][frameSpec.size];
      if (factor == null) {
        factor = FAJARDO_FRAME_12MM[type]['2x3']*(frameSpec.inchesA*frameSpec.inchesB/6);
        factorOrigin='Frame size is not in Fajardo Table 5-1; board-feet scaled by cross-section (planning proxy only)';
      }
      if (plywoodThickness==='3/4') factorOrigin += (factorOrigin?'; ':'')+'18mm plywood uses conservative 12mm framing factor; actual frame spacing needs approval';
      frameFactor=factor;
      framingBoardFeet = purchase(plywoodArea/2.88)*factor;
      factorStock(framingBoardFeet,frameSpec);
    } else if (type === 'slab') {
      // User-specified 40cm joists. Fajardo's staging is separate (see scaffolding type).
      frameMethod='Site layout: joists and edge runners (not Fajardo frame table)';
      framingStations = purchase(W / framingSpacing)+1;
      frame(L,framingStations);
      frame(L,2);
      frame(W,2);
    } else if (type === 'footing') {
      // Direct counting method for footing forms; no per-sheet factor asserted.
      frameMethod='Direct member count: footing ribs/runners';
      var perimeter = 2*(L+W);
      framingStations = purchase(perimeter/framingSpacing);
      frame(H,framingStations);
      frame(L,4); frame(W,4);
    }
    if (type !== 'area' && type !== 'scaffolding') {
      var braceRun = type === 'column' ? L : type === 'footing' ? 2*(L+W) : L;
      braces = purchase(braceRun / braceSpacing)*bracePerStation*count;
      impliedWoodJoints += splitWoodMembers(braceCuts,braceLength,braces,braceSpec.stockLength);
    }
    var framingBars = stockBarsForCuts(framingCuts,frameSpec.stockLength);
    if (!framingBoardFeet) framingBoardFeet=framingCuts.reduce(function(sum,cut){return sum+cut.length/.3048*frameSpec.inchesA*frameSpec.inchesB/12*cut.count;},0);
    // Direct-layout board-feet above uses whole cut segments and is an indicative quantity.
    var braceBars = stockBarsForCuts(braceCuts,braceSpec.stockLength);
    var cutGroups = [{spec:frameSpec.spec,stockLength:frameSpec.stockLength,cuts:framingCuts},
      {spec:braceSpec.spec,stockLength:braceSpec.stockLength,cuts:braceCuts}];
    var nailsType = String(p.nailSize || '2');
    var nailDefault = pick(FORMWORK_NAILS,nailsType,'nail size');
    var nailGram = required(p.nailGram == null ? nailDefault : p.nailGram,'Grams per nail');
    var nailsPerSqm = required(p.nailsPerSqm == null ? 20 : p.nailsPerSqm,'Nails per square meter',true);
    var nailMethod = p.nailMethod == null ? (nailsType==='1' ? 'fajardo' : 'site') : String(p.nailMethod);
    pick({fajardo:1,site:1}, nailMethod, 'formwork nail method');
    if(nailMethod==='fajardo' && nailsType!=='1') throw new Error('Fajardo plywood nail rate is for 1-inch (2d) finishing nails only. Choose manual/site rate for other sizes.');
    var nailWaste = required(p.nailWastePct == null ? 10 : p.nailWastePct,'Nail allowance',true);
    if (nailWaste > 100 || nailsPerSqm > 1000) throw new Error('Nail rate or allowance is too high.');
    // Fajardo Table 8-10 specifies 0.055 kg 2d finishing nails per plywood sheet
    // for the stated fixing pattern; other sizes use the editable site allowance.
    var nailKg, nailCount;
    if (nailMethod==='fajardo') { nailKg=plywoodSheets*0.055*(1+nailWaste/100); nailCount=purchase(nailKg*1000/nailGram); }
    else { nailCount=purchase((type==='scaffolding'?stagingArea:sqm)*nailsPerSqm*(1+nailWaste/100)); nailKg=nailCount*nailGram/1000; }
    return {type:type, elementCount:count, areaSqm:sqm, plywoodAreaSqm:plywoodArea, plywoodWastePct:plywoodWastePct,
      plywoodThickness:plywoodThickness, sheetCoverageSqm:sheetCoverage, plywoodSheets:plywoodSheets,
      formPerimeterM:formPerimeter, stagingAreaSqm:stagingArea, framingBoardFeet:framingBoardFeet, frameFactor:frameFactor, frameMethod:frameMethod, factorOrigin:factorOrigin,
      framingSpacingCm:framingSpacing*100, framingStations:framingStations, braceSpacingM:braceSpacing, braceLengthM:braceLength,
      braceCount:braces, frameLumber:frameSpec.spec, braceLumber:braceSpec.spec,
      framingCuts:framingCuts, braceCuts:braceCuts, cutGroups:cutGroups, framingBars:framingBars, braceBars:braceBars,
      woodJoints:impliedWoodJoints,nailSize:nailsType,nailMethod:nailMethod,nailGram:nailGram,nailCount:nailCount,nailKg:nailKg,
      nailBuyKg:Math.ceil(nailKg*2 - 1e-9)/2,
      note: 'Max Fajardo referenced quantity take-off: column joint +0.20m, beam joint +0.10m, 12mm framing factors and staging factor when applicable. Fajardo uses 2.88 m² effective sheet; 2.44 m² is available as a conservative site setting. ' + (factorOrigin ? factorOrigin+'. ' : '') + 'User-specified 40cm slab joists and 2m slants are site assumptions, not Fajardo structural requirements. Stock conversion is by board-foot volume, NOT a feasible cutting schedule. No shoring, scaffold or brace safety design is provided.'};
  }

  function cost(q, p) {
    var priceKeys = ['chb','cement50','wire','cement','steel','ties','paint','primer','tile','adhesive','grout','nails','sand','gravel','labor','plywood','lumber','formnails'];
    var prices = {};
    priceKeys.forEach(function (key) { prices[key] = required(p[key] == null && ['chb','cement50','wire','plywood','lumber','formnails'].indexOf(key) >= 0 ? 0 : p[key], key + ' price', true); });
    var days = required(p.days, 'Labor days', true), workers = whole(p.workers, 'Workers', true);
    var overheadRate = required(p.overheadPct, 'Overhead', true) / 100;
    var contingencyRate = required(p.contingencyPct, 'Contingency', true) / 100;
    if (overheadRate > 1 || contingencyRate > 1) throw new Error('Overhead and contingency must not exceed 100%.');
    var lines = [];
    function add(label, amount, price, unit, qty) {
      if (!Number.isFinite(amount) || amount < 0 || amount > 1e9) throw new Error('Invalid stored quantity: ' + label + '. Recalculate this material.');
      if (amount > 0) lines.push({ label: label, qty: amount, price: price, unit: unit, amount: amount * price, source: qty });
    }
    var s = q.steel || {}, pa = q.paint || {}, t = q.tile || {}, n = q.nail || {}, c = q.concrete || {}, f = q.formwork || {}, ch = q.chb || {}, pl = q.plaster || {}, lu = q.lumber || {};
    add('Main steel bars', Number(s.mainPieces || 0), prices.steel, 'pcs', 'steel');
    add('Tie / stirrup steel', Number(s.tiePieces || 0), prices.ties, 'pcs', 'steel');
    add('Tie wire (#16)', Number(s.wireBuyKg || 0), prices.wire, 'kg', 'steel');
    add('Cement (' + (c.bagKg || 40) + ' kg)', Number(c.bags || 0), (c.bagKg || 40) === 50 ? prices.cement50 : prices.cement, 'bags', 'concrete');
    add('CHB ' + (ch.thicknessCm || '?') + ' cm', Number(ch.blocks || 0), prices.chb, 'pcs', 'chb');
    add('CHB mortar cement (40 kg)', Number(ch.bags || 0), prices.cement, 'bags', 'chb');
    add('CHB mortar sand', Number(ch.sand || 0), prices.sand, 'm³', 'chb');
    add('Plaster cement (40 kg)', Number(pl.bags || 0), prices.cement, 'bags', 'plaster');
    add('Plaster sand', Number(pl.sand || 0), prices.sand, 'm³', 'plaster');
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
    add('General coco lumber ' + (lu.spec || ''), Number(lu.stockPieces || 0), prices.lumber, 'pcs', 'lumber');
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
    var priceKeys = ['chb','cement50','wire','cement','steel','ties','paint','primer','tile','adhesive','grout','nails','sand','gravel','labor','plywood','lumber','formnails'];
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
        put('cement-' + (q.bagKg || 40), 'Cement (' + (q.bagKg || 40) + ' kg)', q.cementExactBags == null ? (q.bags || 0) : q.cementExactBags, 'bags', (q.bagKg || 40) === 50 ? 'cement50' : 'cement', section);
        put('sand', 'Sand', q.sand || 0, 'm³', 'sand', section);
        put('gravel', 'Gravel', q.gravel || 0, 'm³', 'gravel', section);
      } else if (item.module === 'chb') {
        put('chb-' + q.thicknessCm + 'cm', 'CHB ' + q.thicknessCm + '×20×40 cm', q.blocks || 0, 'pcs', 'chb', section);
        put('cement-40', 'Cement (40 kg)', q.cementExactBags == null ? q.bags : q.cementExactBags, 'bags', 'cement', section);
        put('sand', 'Sand', q.sand || 0, 'm³', 'sand', section);
      } else if (item.module === 'plaster') {
        put('cement-40', 'Cement (40 kg)', q.cementExactBags == null ? q.bags : q.cementExactBags, 'bags', 'cement', section);
        put('sand', 'Sand', q.sand || 0, 'm³', 'sand', section);
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
      } else if (item.module === 'lumber') {
        if (!Array.isArray(q.cutGroups)) throw new Error('Outdated lumber entry. Reopen and recalculate it.');
        q.cutGroups.forEach(function(g) {
          var key='coco-'+g.spec;
          if (!woodCutting[key]) woodCutting[key]={key:key,label:'Coco lumber '+g.spec.replace(/x/g,'×')+' ft',stock:Number(g.stockLength),cuts:[],section:section};
          if (Math.abs(woodCutting[key].stock-Number(g.stockLength))>1e-8) throw new Error('Inconsistent lumber stock length.');
          g.cuts.forEach(function(cut) { woodCutting[key].cuts.push(cut); });
        });
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
    ['cement-40','cement-50'].forEach(function(key) { if (groups[key]) groups[key].qty = purchase(groups[key].qty); });
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
  return { steel: steel, paint: paint, tile: tile, nail: nail, concrete: concrete, chb: chb, plaster: plaster, lumber: lumber, formwork: formwork, cost: cost, projectSummary: projectSummary,
    constants: { chbMortar: CHB_MORTAR, plasterMortar: PLASTER_MORTAR, paintSurfaceGallon: PAINT_SURFACE_GALLON, bars: BAR_WEIGHT, concrete: CONCRETE_CLASS, tiles: TILE_DATA, paint: PAINT_COVERAGE, formNails: FORMWORK_NAILS, formLumber: FORMWORK_LUMBER, fajardoFrames: FAJARDO_FRAME_12MM, fajardoFloorStaging: FAJARDO_STAGE_FLOOR } };
});
