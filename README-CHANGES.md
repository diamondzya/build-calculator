# BuildCalc v2 — Audited Construction Material Estimator

**What this is:** A fully offline, static HTML/CSS/JavaScript preliminary material quantity and cost estimator. There is **no server, account login, database or synced storage**. Entries remain in the current browser's `localStorage` until cleared. Backups are available in **Saved → Backup JSON**.

## Start

1. Extract the entire ZIP, preserving its `assets/` directory.
2. Open `index.html` in a current browser. If your browser restricts local-file storage, use a local HTTP server, e.g. from the extracted folder: `python -m http.server 8000`, then visit `http://localhost:8000`.
3. Run each material calculator, then **Cost**. The Cost tab uses the **most recent successful quantity in each material module**. It is *not* a multi-project bill of quantities.
4. Fill **real supplier prices** and choose compatible packaging units; the initial price fields are illustrative only. A zero price is flagged and makes the total incomplete.
5. Save estimates and export printable/PDF reports. Back up frequently using **Saved → Backup JSON**.

## Major fixes

- Rewired **Calculate / Compute Total** buttons (previously no button click listeners were present).
- Extracted isolated, tested `calc-engine.js` quantity/cost calculation functions.
- **Concrete** now lets you specify class AA/A/B/C, element count and an allowance, using Fajardo-style **40-kg cement bag** per-m³ estimating factors (AA: 12, A: 9, B: 7.5, C: 6 bags per m³; sand: 0.5 m³ per m³ concrete; gravel: 1.0 m³ per m³). Do not treat these as engineering concrete mixes or strength specifications.
- **Steel** replaced the one-formula-for-everything approximation with two basic takeoff modes: two-direction grid for slab/footing/stairs and user-entered longitudinal bars + stirrups for beam/column/fence. Includes spacing, clear cover, approximate cut lengths, 6/12m stock, separate tie diameter, purchase rounding, and refusal when a single run exceeds stock length (laps/splices require engineering input).
- **Paint** subtracts openings, supports user-entered finish/primer coverage, adjustable allowances, optional primer, 4L/3.785L/1L/16L containers and whole-container purchase quantities. Primer-only paint uses the primer price in costs.
- **Tiles** calculates pieces, supplier-specified pieces/box, boxes, adhesive bags from entered product coverage (default 5 m² per 25kg bag + 10% allowance), grout from editable kg/m² rate.
- **Nails** uses actual entered fastening spacing (previously ignored), nails per joint, material-specific rough nail mass, allowance, and rounded purchasing weight. Nail counts are *not* a substitute for roofing/structural fastening schedules.
- **Cost** now includes main/tie steel, cement, sand, gravel, finish paint, primer, tile boxes, tile adhesive, grout, nails, labor workers × days × rate, overhead and contingency. All quantities and prices retain explicit units. Old incompatible quantities must be recalculated to prevent silently incomplete totals.
- **Saved estimates** can reopen their input values. Export/import backup of saved results, latest quantities and price fields. Escaped saved text/report HTML to reduce injection risk. Repaired PDF peso-sign compatibility via `PHP` in its default Helvetica font, and rendered/inspected a sample A4 PDF.
- Prevents keeping a stale result visible when calculation inputs are invalid. Improved cost layout and mobile spacing.

## Method notes and limitations

- These are preliminary **quantity take-offs**, **not structural designs**. Confirm bar locations, number of layers, tie spacing, hooks, bends, anchorage, cover, lap lengths and cutting schedules with approved structural drawings.
- Stock counts are conservative repeated-cut estimates separated by bar orientation/diameter. Shared offcuts, cutting optimization and lap splice details are not modeled.
- Concrete class is **selected by the user** and must match an authorized specification. Actual mix proportions, slump, water, strength, ready-mix yield and site loss are project-dependent; water quantity was removed because a single constant creates false certainty.
- Tile grout rate and nail counts are highly dependent on installation details and must be confirmed against product datasheets. Tile adhesive coverage depends on trowel and substrate; default rate should be edited for the purchased product.
- Paint coverage and can sizes vary by manufacturer; 4 L is the default in the app and is **not identical to a US gallon of 3.785 L**.
- Estimate totals do not automatically include VAT treatment, delivery, permits, hauling, equipment rental, subcontractor fees, excavation or wastage outside entered allowances. You must add these through proper project line items outside this prototype.
- Data from the original v1 may be present in localStorage. Historical saved results remain readable, but **quantity schema changed**. Run all modules again (or Clear Material Quantities) before relying on the cost calculator.
- Backup is local JSON only; there is no cloud synchronization or multiuser collaboration.

## Source references for estimating defaults (verify product/edition)

- Max Fajardo Jr., *Simplified Construction Estimate*, Concrete Table 1-2, as reproduced online: https://www.scribd.com/document/565386444/Simplified-Construction-Estimate-Third-Edition-Max-Fajardo-Jr-Enhanced-PDF
- Additional reproduced text/explanation: https://studylib.net/doc/28292469/simplified-estimate-by-max-fajardo-pdf-pdf-free
- SkyBird Tile Adhesive, 25kg coverage 5m² at 3mm: https://skybirdph.com/products-tile-adhesive/
- Boysen Konstrukt K-302, 25kg coverage 4–6m² depending on surface: https://www.boysen.com.ph/products/konstrukt-tileworks-k-321-tile-adhesion-promoter-and-k-302-all-purpose-tile-adhesive/

## Automated checks

- `node tests/test-engine.cjs` — pure numerical unit tests covering examples, bounds and cost subtotals.
- `python tests/test-browser.py` — Chromium/Playwright browser smoke tests for all modules, saving, reopen, PDF generation, backup and restore, and HTML escaping. Python Playwright and Chrome/Chromium are prerequisites. Browser smoke test embeds local assets to avoid relying on an HTTP server; it substitutes an in-memory localStorage for its synthetic origin.

## Recommended next development phases

1. Add real projects and multiple room/floor/element line items (BOQ), quantity additions, revisions, and no cross-project mixing.
2. Add detailed CHB, plaster, mortar, roofing, wood/formworks calculators with validated take-off assumptions.
3. Add supplier price catalogs per region/date, unit-price updates, procurement pack-size controls, and optional VAT/haulage/markup templates.
4. Add printable professional BOQs, itemized labor productivity and exportable CSV/Excel sheets.
5. If commercialized: authenticated project storage, roles, cloud backups, audit history, and deployment security/privacy review.

**Safety:** Do not use this app alone to specify structural steel or concrete for actual construction. Have the results reviewed against an engineer's drawings and current manufacturer data.
