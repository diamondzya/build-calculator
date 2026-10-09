/* BuildCalc v3: multi-element construction project sheets and purchasing summary.
   Uses existing calculator inputs, offline localStorage and the tested numerical engine. */
'use strict';
var editingProjectItemId = null;
var editingProjectId = null;
var SECTION_LABELS = {
  footing: '01 — Pundasyon / Footings', column: '02 — Poste / Columns', beam: '03 — Biga / Beams',
  slab: '04 — Palapag / Slabs', staircase: '05 — Hagdan / Stairs', fence: '06 — Bakod / Fences',
  scaffolding: '07 — Scaffold / Platform Forms', concrete: '08 — Concrete Work', paint: '09 — Painting',
  chb: '10 — CHB / Masonry', plaster: '11 — Palitada / Plaster',
  lumber: '12 — Coco Lumber / Timber', tile: '13 — Tiles', nail: '14 — Fasteners', formwork: '15 — General Porma / Formwork'
};
function uniqueId(prefix) { return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9); }
function getProjects() {
  var v = loadJSON(PROJECT_KEY, []);
  return Array.isArray(v) ? v.filter(function(p) { return p && typeof p === 'object' && typeof p.id === 'string' && Array.isArray(p.items); }) : [];
}
function getActiveProject() {
  var projects = getProjects(), id = localStorage.getItem(ACTIVE_PROJECT_KEY);
  return projects.find(function(p) { return p.id === id; }) || projects[0] || null;
}
function createProject(name) {
  var projects = getProjects();
  if (projects.length >= 100) { toast('Maximum 100 projects. Back up and archive older projects.', 'fa-triangle-exclamation'); return; }
  var p = { id: uniqueId('project'), name: (name || 'Untitled Construction Project').slice(0, 100), createdAt: new Date().toISOString(), items: [] };
  projects.push(p);
  if (saveJSON(PROJECT_KEY, projects)) { localStorage.setItem(ACTIVE_PROJECT_KEY, p.id); renderProjects(); return p; }
}
function saveProject(project) {
  var projects = getProjects();
  var index = projects.findIndex(function(p) { return p.id === project.id; });
  if (index === -1) return false;
  projects[index] = project;
  return saveJSON(PROJECT_KEY, projects);
}
function readProjectPrices() {
  var p = {};
  ['chb','cement50','cement','steel','ties','wire','paint','primer','tile','adhesive','grout','nails','sand','gravel','labor','plywood','lumber','formnails'].forEach(function(k) { p[k] = priceField(k); });
  p.days = field('cost-days'); p.workers = field('cost-workers');
  p.overheadPct = field('cost-overhead'); p.contingencyPct = field('cost-contingency');
  return p;
}
function getProjectSummary(p) { var prices = readProjectPrices(); prices.rateOverrides = p.priceOverrides || {}; return BuildCalcEngine.projectSummary(p.items, prices); }
function getSectionSummary(project, group) {
  var prices = readProjectPrices();
  prices.rateOverrides = project.priceOverrides || {};
  prices.labor = 0; prices.days = 0; prices.workers = 0; prices.overheadPct = 0; prices.contingencyPct = 0;
  return BuildCalcEngine.projectSummary(group.items, prices);
}
function sectionName(section) { return SECTION_LABELS[section] || 'Other Work — ' + section; }
function lineItemDescription(item) {
  var q = item.qty;
  if (item.module === 'steel') return q.elementCount + ' element(s) · main Ø' + q.mainDiameter + ' ' + q.mainPieces + ' bars · anilyo Ø' + q.tieDiameter + ' ' + q.tiePieces + ' bars · alambre ' + fmt(q.tieWireKg, 3) + ' kg' + (q.spliceCount ? ' · ' + q.spliceCount + ' lap joint(s)' : '');
  if (item.module === 'concrete') return fmt(q.volume, 3) + ' m³ concrete · ' + q.bags + ' bags cement · ' + fmt(q.sand, 3) + ' m³ sand · ' + fmt(q.gravel, 3) + ' m³ gravel';
  if (item.module === 'chb') return fmt(q.area,2)+' m² wall · '+q.blocks+' CHB ('+q.thicknessCm+'cm) · '+q.bags+' cement bags · '+fmt(q.sand,3)+' m³ sand';
  if (item.module === 'lumber') return q.count+' cuts of '+fmt(q.memberLengthM,3)+' m · '+q.stockPieces+' '+q.spec+' timber pcs · '+fmt(q.boardFeetToBuy,2)+' bd-ft';
  if (item.module === 'plaster') return fmt(q.area,2)+' m² plaster ('+q.thicknessMm+'mm) · '+q.bags+' cement bags · '+fmt(q.sand,3)+' m³ sand';
  if (item.module === 'paint') return q.cans + ' cans of ' + fmt(q.canLiters, 3) + ' L paint · ' + q.primerCans + ' cans primer';
  if (item.module === 'tile') return q.boxes + ' boxes (' + q.tiles + ' tiles) · ' + q.adhesiveBags + ' bags adhesive · ' + fmt(q.groutBuyKg, 2) + ' kg grout';
  if (item.module === 'nail') return q.count + ' nails · ' + fmt(q.buyKg, 2) + ' kg';
  if (item.module === 'formwork') return fmt(q.type==='scaffolding'?(q.stagingAreaSqm||0):q.areaSqm,3) + ' m² ' + (q.type==='scaffolding'?'scaffold staging':'porma') + ' · ' + q.plywoodSheets + ' phenolic sheets · ' + q.framingBars + ' lumber stock · ' + q.braceCount + ' braces · ' + fmt(q.nailBuyKg,1) + ' kg nails';
  return 'Material quantity';
}
function addCurrentToProject() {
  if (!currentResult || !currentResult.quantity || !['steel','concrete','chb','plaster','lumber','paint','tile','nail','formwork'].includes(currentModule)) {
    toast('Calculate a material first.', 'fa-triangle-exclamation'); return;
  }
  var project = editingProjectId ? getProjects().find(function(p) { return p.id === editingProjectId; }) : getActiveProject();
  if (editingProjectItemId && project) {
    var prior = project.items.find(function(item) { return item.id === editingProjectItemId; });
    if (!prior || prior.module !== currentModule) {
      editingProjectItemId = editingProjectId = null;
      project = getActiveProject();
      $('#btn-add-project').innerHTML = '<i class="fa-solid fa-file-circle-plus"></i> Add to Project Sheet';
    }
  }
  if (!project) project = createProject();
  if (!project) return;
  if (project.items.length >= 1000 && !editingProjectItemId) {
    toast('Maximum of 1,000 entries per project.', 'fa-triangle-exclamation'); return;
  }
  var label = field('line-item-name').trim().slice(0, 140);
  var savedItem = {
    id: editingProjectItemId || uniqueId('item'), module: currentModule,
    section: currentResult.section || currentModule, label: label || (sectionName(currentResult.section || currentModule).replace(/^\d+ — /, '') + ' #' + (project.items.length + 1)),
    qty: JSON.parse(JSON.stringify(currentResult.quantity)),
    rows: currentResult.rows.map(function(r) { return { label: r.label, fil: r.fil, value: r.value }; }),
    inputs: currentResult.inputValues, note: currentResult.note, addedAt: new Date().toISOString()
  };
  var i = project.items.findIndex(function(item) { return item.id === editingProjectItemId; });
  if (i >= 0) project.items[i] = savedItem;
  else project.items.push(savedItem);
  if (!saveProject(project)) return;
  var action = i >= 0 ? 'updated' : 'added';
  editingProjectItemId = editingProjectId = null;
  $('#btn-add-project').innerHTML = '<i class="fa-solid fa-file-circle-plus"></i> Add to Project Sheet';
  $('#line-item-name').value = '';
  toast('Item ' + action + ' in ' + project.name, 'fa-check');
  renderProjects();
}
function projectGroups(project) {
  var groups = {};
  project.items.forEach(function(item) {
    var section = Object.prototype.hasOwnProperty.call(SECTION_LABELS, item.section) ? item.section : item.module;
    if (!groups[section]) groups[section] = [];
    groups[section].push(item);
  });
  return Object.keys(groups).sort(function(a,b) {
    return Object.keys(SECTION_LABELS).indexOf(a) - Object.keys(SECTION_LABELS).indexOf(b);
  }).map(function(key) { return { section: key, items: groups[key] }; });
}
function renderProjects() {
  var projects = getProjects(), active = getActiveProject();
  var picker = $('#project-select'); picker.textContent = '';
  projects.forEach(function(p) {
    var option = document.createElement('option'); option.value = p.id; option.textContent = p.name; picker.appendChild(option);
  });
  if (!active) {
    $('#project-name').value = '';
    $('#project-details').textContent = '';
    $('#project-summary-lines').textContent = '';
    $('#project-summary-total').textContent = '';
    $('#project-empty').hidden = false;
    return;
  }
  picker.value = active.id; $('#project-name').value = active.name;
  var details = $('#project-details'); details.innerHTML = '';
  $('#project-empty').hidden = !!active.items.length;
  projectGroups(active).forEach(function(group) {
    var section = document.createElement('section'); section.className = 'sheet-section';
    section.innerHTML = '<h3>' + escapeHTML(sectionName(group.section)) + '</h3>' +
      '<p class="sheet-section-count">' + group.items.length + ' recorded estimate(s)</p>';
    group.items.forEach(function(item) {
      var entry = document.createElement('div'); entry.className = 'sheet-line';
      var rowDetails = (item.rows || []).map(function(r) {
        return '<tr><td>' + escapeHTML(r.label) + '</td><td>' + escapeHTML(r.value) + '</td></tr>';
      }).join('');
      entry.innerHTML = '<div class="sheet-line-info"><h4>' + escapeHTML(item.label) + '</h4><p>' + escapeHTML(lineItemDescription(item)) + '</p></div>' +
        '<div class="sheet-line-actions"><button type="button" class="btn btn-outline sheet-edit">Edit</button><button type="button" class="btn btn-ghost sheet-remove">Remove</button></div>' +
        '<details class="sheet-breakdown"><summary>Detailed calculation / anilyo, hook, splice, alambre</summary><table><tbody>' + rowDetails + '</tbody></table></details>';
      $('.sheet-edit', entry).addEventListener('click', function() {
        editingProjectItemId = item.id; editingProjectId = active.id;
        restoreInputs({ module: item.module, inputValues: item.inputs });
        $('#line-item-name').value = item.label;
        $('#btn-add-project').innerHTML = '<i class="fa-solid fa-pen"></i> Update Project Item';
      });
      $('.sheet-remove', entry).addEventListener('click', function() {
        if (!window.confirm('Remove this line item from ' + active.name + '?')) return;
        active.items = active.items.filter(function(x) { return x.id !== item.id; });
        if (saveProject(active)) { renderProjects(); toast('Removed from project sheet.', 'fa-trash-can'); }
      });
      section.appendChild(entry);
    });
    try {
      var sectionTotals = getSectionSummary(active,group);
      var sec = document.createElement('div'); sec.className = 'sheet-section-total';
      sec.innerHTML = '<h4>Section Materials Summary</h4><div class="sheet-table-scroll"><table class="sheet-table"><thead><tr><th>Material</th><th>Quantity</th><th>Amount</th></tr></thead><tbody>' +
        sectionTotals.lines.map(function(l) { return '<tr><td>' + escapeHTML(l.label) + '</td><td>' + escapeHTML(fmt(l.qty,3) + ' ' + l.unit) + '</td><td>' + money(l.amount) + '</td></tr>'; }).join('') +
        '</tbody></table></div><div class="sheet-section-amount">Section materials estimate <b>' + money(sectionTotals.materials) + '</b></div>';
      section.appendChild(sec);
    } catch(e) { var warning = document.createElement('p'); warning.textContent = 'Section summary unavailable: ' + e.message; section.appendChild(warning); }
    details.appendChild(section);
  });
  var out = $('#project-summary-lines'), total = $('#project-summary-total');
  if (!active.items.length) { out.innerHTML = ''; total.innerHTML = ''; return; }
  try {
    var s = getProjectSummary(active);
    out.innerHTML = '<div class="sheet-table-scroll"><table class="sheet-table"><thead><tr><th>Material / Specification</th><th>Quantity to Buy</th><th>Unit Rate (PHP, editable)</th><th>Amount</th></tr></thead><tbody>' +
      s.lines.map(function(l) { return '<tr><td>' + escapeHTML(l.label) + '</td><td>' + escapeHTML(fmt(l.qty, 3) + ' ' + l.unit) + '</td><td><input aria-label="Unit price of ' + escapeHTML(l.label) + '" class="sheet-rate-input" type="number" min="0" step="0.01" data-price-key="' + escapeHTML(l.key) + '" value="' + l.rate + '"></td><td>' + money(l.amount) + '</td></tr>'; }).join('') +
      '</tbody></table></div>';
    $all('.sheet-rate-input',out).forEach(function(inp) {
      inp.addEventListener('change',function() {
        if (inp.dataset.handling === '1') return;
        inp.dataset.handling = '1';
        var n=Number(inp.value);
        if (inp.value.trim()==='' || !Number.isFinite(n) || n<0 || n>1000000) { toast('Enter a valid unit price.', 'fa-triangle-exclamation'); inp.blur(); renderProjects(); return; }
        var updated=getActiveProject(); if (!updated) return;
        if (!updated.priceOverrides) updated.priceOverrides={};
        updated.priceOverrides[inp.dataset.priceKey]=n;
        if (saveProject(updated)) { inp.blur(); renderProjects(); }
      });
    });
    total.innerHTML = '<div class="sheet-totals"><span>Materials subtotal</span><b>' + money(s.materials) + '</b><span>Labor</span><b>' + money(s.labor) + '</b><span>Overhead</span><b>' + money(s.overhead) + '</b><span>Contingency</span><b>' + money(s.contingency) + '</b><strong>' + (s.warnings.length ? 'PARTIAL TOTAL (PRICES MISSING)' : 'PROJECT GRAND TOTAL') + '</strong><strong>' + money(s.total) + '</strong></div>' +
      (s.warnings.length ? '<p class="sheet-warning">WARNING: Total is incomplete until unit prices are entered. Missing prices: ' + escapeHTML(s.warnings.join('; ')) + '</p>' : '') +
      '<p class="form-note">Edit each unit price here; it is saved for this project. Default material prices are in Calculator → Cost. Purchase bars grouped and cut-packed by role, diameter and stock length; tie-wire is rounded once to 0.5 kg across this project.</p>';
  } catch(e) {
    out.textContent = 'Cannot summarize this project: ' + (e.message || 'invalid project data'); total.textContent = '';
  }
}
function safeProjectFile(name) { return String(name).replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').slice(0,80) || 'project'; }
function projectPrintHTML(project, summary) {
  var header = '<div class="pr-sub">' + escapeHTML(project.name) + ' · ' + new Date().toLocaleDateString('en-PH') + '<br>BuildCalc preliminary material take-off</div>';
  var sheets = projectGroups(project).map(function(group) {
    return '<section class="sheet-page"><h1>' + escapeHTML(sectionName(group.section)) + ' — Detailed Sheet</h1>' + header +
      group.items.map(function(item) {
        return '<h3>' + escapeHTML(item.label) + '</h3><table><thead><tr><th>Measurement / Material</th><th class="num">Estimated Quantity</th></tr></thead><tbody>' +
          (item.rows || []).map(function(r) { return '<tr><td>' + escapeHTML(r.label) + '</td><td class="num">' + escapeHTML(r.value) + '</td></tr>'; }).join('') +
          '</tbody></table>';
      }).join('') + '<h3>SECTION MATERIALS SUMMARY</h3><table><thead><tr><th>Material</th><th class="num">Quantity / Cost</th></tr></thead><tbody>' +
      getSectionSummary(project,group).lines.map(function(l) { return '<tr><td>' + escapeHTML(l.label) + '</td><td class="num">' + escapeHTML(fmt(l.qty,3)+' '+l.unit) + ' · ' + money(l.amount) + '</td></tr>'; }).join('') +
      '</tbody></table><p class="pr-foot">Section purchase estimates are rounded separately; final consolidated purchases may be lower after stock cut grouping.</p></section>';
  }).join('');
  return sheets + '<section class="sheet-page"><h1>CONSOLIDATED PROJECT SUMMARY</h1>' + header +
    '<table><thead><tr><th>Material</th><th class="num">Quantity / Cost</th></tr></thead><tbody>' +
    summary.lines.map(function(l) { return '<tr><td>' + escapeHTML(l.label) + '</td><td class="num">' + escapeHTML(fmt(l.qty,3) + ' ' + l.unit) + ' · ' + escapeHTML(money(l.amount)) + '</td></tr>'; }).join('') +
    '</tbody></table><div class="pr-total">Project Total: ' + money(summary.total) + '</div>' +
    '<p class="pr-foot">Materials ' + money(summary.materials) + ' · Labor ' + money(summary.labor) + ' · Overhead ' + money(summary.overhead) + ' · Contingency ' + money(summary.contingency) + '</p>' +
    '<p class="pr-foot">Preliminary quantities only. Rebar/splices and formwork, joists, temporary braces, shoring/scaffold safety and connections must follow approved structural and temporary-works plans. Supplier prices must be verified.</p></section>';
}
function printProject() {
  var project = getActiveProject();
  if (!project || !project.items.length) { toast('Add project items before printing.', 'fa-triangle-exclamation'); return; }
  try {
    var result = getProjectSummary(project);
    var el = $('#print-report'); el.innerHTML = projectPrintHTML(project, result); el.setAttribute('aria-hidden', 'false');
    window.addEventListener('afterprint', function() { el.innerHTML = ''; el.setAttribute('aria-hidden', 'true'); }, { once: true });
    window.print();
  } catch(e) { toast(e.message, 'fa-triangle-exclamation'); }
}
function projectPDF() {
  var project = getActiveProject();
  if (!project || !project.items.length) { toast('Add project items before exporting.', 'fa-triangle-exclamation'); return; }
  if (!window.jspdf || !window.jspdf.jsPDF) { toast('PDF library unavailable.', 'fa-triangle-exclamation'); return; }
  try {
    var summary = getProjectSummary(project), doc = new window.jspdf.jsPDF({unit:'pt',format:'a4'});
    var width = doc.internal.pageSize.getWidth(), x = 42, right = width - 42, y = 42, page = 0;
    function clean(v) { return String(v == null ? '' : v).replace(/₱/g,'PHP ').replace(/×/g,' x ').replace(/³/g,'^3').replace(/²/g,'^2').replace(/[–—·]/g,'-').replace(/[Ø]/g,'Dia ').replace(/[^\x20-\x7E\n]/g,''); }
    function nextPage(title) {
      if (page++) doc.addPage();
      y = 45; doc.setTextColor(238,112,0); doc.setFont('helvetica','bold'); doc.setFontSize(15);
      doc.text(clean(title).slice(0,80),x,y); y+=13;
      doc.setLineWidth(1.7); doc.setDrawColor(245,124,0); doc.line(x,y,right,y); y+=18;
      doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(70,70,70);
      doc.text(clean(project.name).slice(0,85), x,y); y+=14;
      doc.text('Generated ' + new Date().toLocaleDateString('en-PH') + ' | Preliminary quantity take-off', x,y); y+=22;
      doc.setTextColor(0,0,0);
    }
    function line(label, value, isHeading) {
      if (y>770) { nextPage('DETAILS CONTINUED'); }
      doc.setFont('helvetica',isHeading?'bold':'normal'); doc.setFontSize(isHeading?11:9);
      var maxLabelWidth = isHeading ? width-84 : 320;
      var wrapped = doc.splitTextToSize(clean(label),maxLabelWidth);
      doc.text(wrapped,x,y);
      if (value) doc.text(clean(value),right,y,{align:'right',maxWidth:170});
      y += Math.max(1,wrapped.length)*(isHeading?13:11)+(isHeading?8:4);
    }
    projectGroups(project).forEach(function(group) {
      nextPage(sectionName(group.section) + ' | DETAILED SHEET');
      group.items.forEach(function(item) {
        line(item.label, '', true);
        (item.rows || []).forEach(function(r) { line(r.label, r.value); });
        if (y>740) nextPage('DETAILS CONTINUED');
        y += 10;
      });
      var sectionTotals = getSectionSummary(project,group);
      line('SECTION MATERIALS SUMMARY', '', true);
      sectionTotals.lines.forEach(function(l) { line(l.label, fmt(l.qty,3) + ' ' + l.unit + ' | PHP ' + fmt(l.amount,2)); });
      line('Section materials estimate', 'PHP ' + fmt(sectionTotals.materials,2), true);
    });
    nextPage('CONSOLIDATED MATERIAL SUMMARY');
    summary.lines.forEach(function(l) { line(l.label, fmt(l.qty,3) + ' ' + l.unit + ' | PHP ' + fmt(l.amount,2)); });
    y += 12; line('Materials', 'PHP ' + fmt(summary.materials,2), true);
    line('Labor', 'PHP ' + fmt(summary.labor,2));
    line('Overhead', 'PHP ' + fmt(summary.overhead,2));
    line('Contingency', 'PHP ' + fmt(summary.contingency,2));
    line(summary.warnings.length ? 'PARTIAL TOTAL - PRICES MISSING' : 'PROJECT TOTAL', 'PHP ' + fmt(summary.total,2), true);
    if (summary.warnings.length) line('WARNING: Incomplete cost - enter missing prices. Unpriced: ' + summary.warnings.join('; '), '');
    if (y > 710) nextPage('ESTIMATE NOTES');
    doc.setFontSize(8); doc.setTextColor(110,110,110);
    doc.text(doc.splitTextToSize('Quantity estimates only; not structural reinforcement design. Verify hook/development and splice specifications against approved plans. Bars grouped by diameter/role/stock for preliminary cutting estimates.',width-84),x,y+18);
    doc.save('BuildCalc-' + safeProjectFile(project.name) + '-Project-Sheets.pdf');
    toast('Full project report exported.', 'fa-file-pdf');
  } catch(e) { toast('PDF export: '+e.message, 'fa-triangle-exclamation'); }
}
function initProjects() {
  if (!getProjects().length) createProject('My Construction Project');
  $('#project-select').addEventListener('change', function() { localStorage.setItem(ACTIVE_PROJECT_KEY,this.value); renderProjects(); });
  $('#project-new').addEventListener('click', function() { createProject('New Construction Project'); });
  $('#project-rename').addEventListener('click', function() {
    var project = getActiveProject(); if (!project) return;
    var name = $('#project-name').value.trim();
    if (!name) { toast('Enter a project name.', 'fa-triangle-exclamation'); return; }
    project.name = name.slice(0,100); if (saveProject(project)) { renderProjects(); toast('Project renamed.', 'fa-check'); }
  });
  $('#project-delete').addEventListener('click', function() {
    var project = getActiveProject(); if (!project || !window.confirm('Permanently delete ' + project.name + ' and its ' + project.items.length + ' entries?')) return;
    var next = getProjects().filter(function(p) { return p.id !== project.id; });
    if (saveJSON(PROJECT_KEY,next)) { localStorage.setItem(ACTIVE_PROJECT_KEY, next[0] ? next[0].id : ''); renderProjects(); }
  });
  $('#project-pricing').addEventListener('click',function() { showView('calculators'); selectModule('cost'); });
  $('#project-pdf').addEventListener('click',projectPDF);
  $('#project-print').addEventListener('click',printProject);
  $all('#form-cost input, #cost-source').forEach(function(input) {
    input.addEventListener(input.tagName==='SELECT'?'change':'input',function() {
      var vals=readProjectPrices();
      if (Object.keys(vals).every(function(k){return vals[k]!=='' && Number.isFinite(Number(vals[k])) && Number(vals[k])>=0;})) saveJSON(PRICE_KEY, vals);
    });
  });
  renderProjects();
}
