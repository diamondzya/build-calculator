# BuildCalc v3 — Anilyo, Column Splices and Project BOQ Sheets

A **standalone, offline-first HTML/CSS/JavaScript** preliminary construction quantity estimator. This update builds on BuildCalc v2. It does not require an account, database, or internet connection.

## Getting started

1. Extract all files from the ZIP into one directory. Open `index.html` in Chrome, Firefox, or Edge. If browser-local storage is blocked under `file://`, run `python -m http.server 8000` from the extracted folder, then browse to `http://localhost:8000`.
2. In **Calculator → Steel**, choose *Column (Haligi)*, *Footing (Pundasyon)*, or another construction section. Choose the **6 m, 9 m, or 12 m** stock length and all other dimensions and allowances.
3. Enter the **number of identical elements**. For a column, enter the **height above finished floor level**, the **additional height below FFL/hukay**, and any **bottom/top hooks or anchorage lengths** specified on the drawings. Those depths are added once, not twice.
4. For a bar run requiring a splice, enter the **lap/overlap length from the project's approved structural drawings**. The calculator can estimate required splice segments and stock pieces. The tie/stirrup hook tail and tie-wire quantities are editable too.
5. Click **Add to Project Sheet** below any steel, concrete, paint, tile, or nail calculation. Give the entry a useful name, e.g. `Footing F1 — 3 units`, `Poste C1`, `Footing F1 concrete`.
6. Open **Project Sheets** to see the grouped **Pundasyon, Poste, Biga, Slab**, and other detail sheets, their **section material summaries**, and one **consolidated project procurement/cost summary**.
7. Set default prices in **Calculator → Cost**. Override individual row prices directly from the Project Sheets' consolidated material table (useful for different rebar diameters and 6/9/12m stock lengths). Price overrides persist per project.
8. Export **Full Report PDF** or **Print Sheets**. Printed/PDF reports begin a new page for each project section and include a final combined project summary. Back up data from **Saved → Backup JSON**; v3 backups also contain projects and bar-size price overrides.

## Computation details

### Column/poste bars

The estimator uses the following **user-entered allowances**:

```text
Unspliced main-bar run = height above FFL + depth below FFL + bottom anchorage/hook + top anchorage/hook
Total cut length per longitudinal bar = unspliced run + (number of splice overlaps × entered lap length)
Required automatic splices when the run exceeds the chosen stock length:
  minimum count permitting each cut segment to fit within stock length after overlap.

Column stirrups count = (ceil((height above FFL + depth below FFL) / entered stirrup spacing) + 1)
  × number of identical elements
Approximate rectangular anilyo cut length = 2 × (width - 2×cover + depth - 2×cover)
  + 2 × (entered stirrup hook-tail multiplier × stirrup diameter)
  Note: hook allowance in bar diameters must be converted from mm to m.
```

The approximation **does not design splice locations or check structural hook/development rules**. The algorithm splits a long bar into **approximately equal cut segments** for preliminary stock purchasing. Actual fabricator bar bending, development length, splice location, seismic confinement, 135-degree ties and concrete cover must be taken from signed structural documents.

For **grid footing/slab/stairs**, the calculator counts two directions of bars, applicable layers, element count, overlaps for bar runs longer than stock, and wire tie intersections. Stairs are only a **grid approximation**, not full stepped/stringer reinforcement design. Footing bends and special dowels beyond entered run allowances are **not** automatically added.

### Tie wire / alambre

Wire is derived from estimated reinforcing-bar intersections, **wire pieces per intersection**, entered **cut length per wire tie** (default 30 cm), **grams per meter of wire** (editable default 15.8 g/m, approximately #16 gauge), and **waste allowance** (default 10%). On the **project summary**, raw wire quantities are combined and **rounded up once to the nearest 0.5 kg**. Site tying patterns and actual wire products differ.

### Illustrative column example (these are example dimensions, NOT code-compliant design defaults)

- Four 12 mm longitudinal bars in a **300 mm × 400 mm** column; 6.0 m above floor + **1.5 m** below floor + **0.4 m bottom hook** + **0.2 m top hook** = **8.1 m unspliced run** per main bar.
- Using a project-specified **0.6 m overlap** with **6 m stock**, each longitudinal bar needs a **single overlap** and two preliminary **4.35 m cut segments**, for **8 purchased 6 m main stock bars** in this simple layout (no shared offcut reuse). With 9 m or 12 m stock, the example requires **4 main stock bars** with no splice.
- At 150 mm spacing, ties along 7.5 m height = **51 ties**, using the user-entered section, cover, and tie-hook allowance.
- Four intersections per tie (204 junctions) at 30 cm of #16 wire and 10% allowance = **1.064 kg**, rounded to **1.5 kg** when purchased as an individual element. If multiple entries share one project, **purchase rounding happens after aggregation**.

### Multi-project reporting

- Supports up to 100 local projects and 1,000 items per project (practical performance will depend on your device).
- Project entries are **snapshots**: changes to calculator inputs do **not** update an existing project item unless you select its **Edit** button and explicitly **Update Project Item**.
- A group's **section material subtotal** uses per-section purchase rounding and can be **greater than the consolidated project subtotal** because stock cutting and tie-wire purchasing are grouped across the project; do not add section subtotals to reconstruct the project grand total.
- Global purchasing bars are grouped by **role (main/tie), diameter, and stock length**, using a preliminary **first-fit-decreasing cutting estimator** across matching groups. Different role/diameter/stock bars are not pooled. Actual cut schedules can differ.
- Consolidated quantities of paint cans, cement bags, adhesives, tiles, and nails are summed from individually rounded entries; some bulk procurement may save additional material after final supplier packaging and cut planning.
- Site rates are **not live supplier quotations**. Zero rates are clearly flagged. Cost mode supports **Project Sheet** (all entries) or **Legacy latest-per-module**.

### Concrete below floor level

For a **column concrete** entry only, the below-FFL height field is **added** to the entered above-floor concrete height. This is a measurement convenience, **not a statement that a 1.5 m excavation should all be poured as a column**. Count only concrete actually specified in the structural documents; isolate pad footings, pedestals and other concrete components as separate items to avoid duplicate volumes.

### Other material estimators

Concrete's nominal class AA/A/B/C consumption factors remain **preliminary table-style factors based on 40kg bags**, inspired by references to Max Fajardo Jr.'s *Simplified Construction Estimate*. They **are not engineered concrete mix design**. Paint, tiles, adhesive, nails and old individual Saved estimates remain available.

## Storage, data migration, and privacy

- Everything is stored in **your own browser's localStorage**; projects are under `buildcalc.projects.v3`, active project selection under `buildcalc.activeproject.v3`. Existing v2 saved calculations, price fields and module quantities use their original storage keys and are not cleared by installing new source files.
- Existing saved reports do **not** automatically become project line items; recalculate and add them intentionally. Old-format steel quantities without tie-wire data are now rejected in legacy Cost mode until recalculated.
- **Back up JSON before restoring** on another device. Restoring replaces existing saved reports, project sheets, prices, and legacy quantities on the device.
- No server or online account is included. Browser data can disappear after clearing site data, using incognito/private browsing, switching host URL, or device failure.

## Testing

From the unzipped folder:

```bash
node tests/test-engine.cjs
node tests/test-project-engine.cjs
python tests/test-browser.py
python tests/test-project-browser.py
```

The browser tests require Python `playwright` with Chromium. The new tests cover **excavation/FFL + hook and splice lengths**, **stock bars 6/9/12 m**, **wire consumption**, **multi-element section project totals**, **editing without duplication**, **price overrides**, **PDF section pages + combined summary**, **backup/restore**, **legacy calculators**, and **375 px mobile overflow**. Sample project PDF from test has three A4 pages (foundation sheet, column sheet, consolidated summary).

## License note

UI uses local **SVG icon paths** from *Font Awesome Free* (Fonticons, Inc.), CC BY 4.0, attribution: https://fontawesome.com/license/free. The resulting website does **not** distribute icon fonts. Includes a locally supplied jsPDF runtime for offline reports.

**Engineering caveat:** All modules are preliminary quantity estimators, not a replacement for approved structural plans, a licensed structural engineer, actual bar fabrication schedules, supplier data, or local applicable design codes.
