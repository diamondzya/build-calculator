# BuildCalc v6 — Fajardo PDF reference guide

## Source and approach

**Primary source:** The user-provided scanned Max B. Fajardo, *Simplified Construction Estimate*, `351451625-ESTIMATE-by-Max-Fajardo.pdf`. Book page numbers below are **printed page numbers** in the book, not PDF viewer page indices (many scanned PDF pages show two facing book pages).

This release transcribes specific material-estimating constants from the provided pages, adds separate modules, and preserves the older rebar, formwork, tiles, nails and Project Sheets workflow. It **does not** reproduce the whole book or implement every chapter. The PDF itself is **not included** in the software ZIP.

## Formulas directly referenced to the supplied book

### Concrete — Table 1-2, printed book page 8

Values per **1.0 cubic meter of concrete**:

| Mix class | Nominal mix | Cement 40-kg bags | Cement 50-kg bags | Sand (m³) | Gravel (m³) |
|:--|:--|--:|--:|--:|--:|
| AA | 1 : 1.5 : 3 | 12.0 | 9.5 | 0.50 | 1.00 |
| A | 1 : 2 : 4 | 9.0 | 7.0 | 0.50 | 1.00 |
| B | 1 : 2.5 : 5 | 7.5 | 6.0 | 0.50 | 1.00 |
| C | 1 : 3 : 6 | 6.0 | 5.0 | 0.50 | 1.00 |

Volume = geometric volume × identical-elements count. Calculated materials = volume × (1 + separately selected waste allowance) × selected table factor. Cement is displayed as whole bags for purchasing. Sand/gravel remain cubic meters. **This table does not specify structural concrete strength or engineer-approved mix design.** Excavation depth and actual concrete below FFL must be measured separately to avoid counting the same footing volume twice.

### CHB / concrete hollow block wall — Tables 2-2 / 2-3, pages 53–54

For 20 × 40 cm nominal block face: **12.5 blocks/m²** before waste. The Table 2-2 cement and sand factors for **40-kg bags** are:

| CHB wall thickness | Class A (bags/m²) | B | C | D | Sand (m³/m²) |
|:--|--:|--:|--:|--:|--:|
| 10 cm | 0.792 | 0.522 | 0.394 | 0.328 | 0.0435 |
| 15 cm | 1.526 | 1.018 | 0.763 | 0.633 | 0.0844 |
| 20 cm | 2.260 | 1.500 | 1.125 | 0.938 | 0.1250 |

Wall net area = `(length × height − openings per wall) × wall count`. Blocks = `ceil(net area × (1 + waste allowance) × 12.5)`; cement = same adjusted area × selected table factor, purchased whole bags; sand = adjusted area × row factor. **CHB mortar is for laying blocks only**; plastering, core fill, reinforcement, lintels, foundations and concrete are separate quantities.

**Worked example:** 4m × 3m, one wall, no openings or waste, 10-cm CHB Class B: 12m², 150 blocks, cement 6.264 bags → 7 bags purchased for this independent item, sand 0.522m³.

### Palitada / plastering — Table 2-4, printed page 56

Cement in **40-kg bags per m² of face to plaster**:

| Class / thickness | 8mm | 12mm | 16mm | 20mm | 25mm |
|:--|--:|--:|--:|--:|--:|
| A | 0.144 | 0.216 | 0.288 | 0.360 | 0.450 |
| B | 0.096 | 0.144 | 0.192 | 0.240 | 0.300 |
| C | 0.072 | 0.108 | 0.144 | 0.180 | 0.225 |
| D | 0.060 | 0.090 | 0.120 | 0.150 | 0.188 |
| Sand, m³/m² | 0.008 | 0.012 | 0.016 | 0.020 | 0.025 |

Net face area = `(length × height − opening area per face) × wall count × faces (1 or 2)`. Multiply by factor and separately chosen allowance. Do **not** plaster both faces and also enter doubled wall geometry, or the estimate will double count.

### Paint — Chapter 10, printed page 312

Source-referenced **one-coat coverage** by surface texture: coarse/rough 30m², medium 35m², smooth 40m² **per nominal 4-liter gallon**. Select a preset texture to populate **liters per m²** (`4/30`, `4/35`, or `4/40`), or choose Manual supplier coverage. Existing paint type, coats, openings, waste and purchasing container inputs still control finished quantities. Manufacturer datasheets, coating type and coats take precedence.

### Coco lumber — Chapter 4, printed page 151

Board feet = `thickness_in × width_in × length_ft / 12`. Added a standalone timber calculation with stock size, cut-member length, count, and waste. It uses a greedy first-fit cut packing estimate against selected 8ft/10ft/12ft stocks. A nominal board-foot total is a **quantity/volume unit, not a certified cut layout or capacity calculation**.

### Reinforcing tie-wire — Chapter 3, printed pages 110 and 118

The book examples use approximately **53 linear meters of No. 16 GI tie-wire per kg**, equivalent to `1000/53 ≈ 18.87 g/m`. The user-entered tie length, quantity of intersections and waste still determine actual estimate. Splice overlaps, development lengths, hooks, stirrup spacing, bar grades, cover and reinforcement quantities still require approved structural drawings; the book's historic detailing examples must not be treated as current engineering-code compliance defaults.

### Formwork / porma — Chapter 5 (existing v5 feature)

See **`README-FAJARDO.md`** for column joint allowances, beam joint allowances, 12mm plywood framing board-foot factors, plywood sheet coverage, floor staging and a source-specific 2d finishing nail factor. Per-user **2.44m² effective coverage**, **40cm slab framing spacing** and **2m brace stations** remain selectable *site estimates* and are not represented as Max Fajardo structural requirements. Joist load capacity, shoring, scaffold strength and working-platform safety are **not** designed by BuildCalc.

## Project Sheet / consolidation

- `Calculate` then **Add to Project Sheet**. CHB and plaster are two separate lines, grouped by selected section.
- In Consolidated BOQ, each CHB thickness is separately counted. Quantities of the **same cement bag size** and sand aggregate across concrete/CHB/plaster. 40-kg and 50-kg cement remain separate purchasing lines and prices. Aggregate cement before rounding whole purchased bags.
- Lumber cut take-off and formwork coco lumber with matching **size and length** are consolidated as stock requirements, with approximate common-cut optimization where both offer actual cut groups.
- Edit prices in Cost / Project Sheets. Save and reopen sections, export full report PDF, and backup/restore JSON.
- Old saved entries retain their stored quantities. **Recalculate** old results to use v6 defaults or tables. Always make a backup before importing saved data from another device.

## Important distinctions and missing coverage

**Direct source-specific tables in v6:** concrete Table 1-2, laying mortar Table 2-2, plaster Table 2-4, paint p312 and board-feet p151, No.16 GI wire p110/118; existing source-referenced formwork Tables 5-1/5-3 and finishing nail factor.

**Assumptions entered by the user or retained from the site/v5 design:** waste percentage, bar lap/development/hook lengths, steel cutoff optimization, joist & brace station spacing, manually chosen lumber cuts and nail rates, tile adhesive and grout use, paint containers, local material prices. Steel take-off is based on entered layout geometry, **not fully generated from every structural reinforcement table in Chapter 3**.

**Not fully imported from the book:** specialized reinforced-concrete shapes, comprehensive scaffolding/staging design, all roofing types/truss layouts, wall finishes and non-CHB masonry materials, stair stringers, doors, gutters, specialty painting systems, labor productivity and chapter-by-chapter costing. Those require additional modules and design inputs rather than extrapolated constants. The PDF's old instructional table values may not match current Philippine codes, suppliers or material dimensions.

## Verification commands

With Node.js and Python Playwright installed, run:

```bash
node tests/test-engine.cjs
node tests/test-project-engine.cjs
node tests/test-formwork-engine.cjs
node tests/test-fajardo-engine.cjs
python tests/test-browser.py
python tests/test-project-browser.py
python tests/test-formwork-browser.py
python tests/test-fajardo-browser.py
```

The program is a **preliminary material estimator only**, not a professional BOQ sign-off, structural design, temporary works design, or purchasing guarantee. Verify every calculated result against approved drawings, specifications, actual supplier products, and qualified professional review.
