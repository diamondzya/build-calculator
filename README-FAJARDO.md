# BuildCalc v5 — Max Fajardo–Referenced Formwork Revision

## Use

Extract the ZIP, then open `index.html` in your browser. The Formwork/Porma calculator is integrated into the existing Project Sheets and consolidated material/cost report. Existing JSON backups remain compatible; saved old formwork line items are **not silently recalculated**. Reopen and recalculate an old entry to use the revised method.

## Changes and calculation basis

Max B. Fajardo, *Simplified Construction Estimate*, 2000 edition, Chapter 5 (Forms, Scaffolding and Staging), along with its Table 8-10 (nails):

1. **Rectangular column forms**: total form area = `[2(width + depth) + 0.20 m] × column height × number of columns`. The 0.20 m addition allows for form joints. Only lateral surfaces are counted.
2. **Beam/girder forms**: total form area = `[bottom width + 2 × beam depth + 0.10 m] × beam length × number of beams`. The 0.10 m addition allows for form joints. The top face is open.
3. **Plywood**: default effective coverage is **2.88 m²** for a 1.20 m × 2.40 m sheet in the book. Whole sheets = `ceil((form area × (1 + waste allowance)) / effective coverage)`. An option labeled **Your Site Rule (2.44 m²/sheet)** retains the earlier project requirement (e.g., 2.44 m² = 1 sheet, 2.50 m² = 2 sheets). Modern 1.22 m × 2.44 m gross area and manual coverage are also selectable. Plywood nesting, joints and actual stock format affect real counts.
4. **Column/beam frame board feet**: Fajardo Table 5-1 factors for a 12 mm (1/2 in) plywood form, per **reference 2.88 m² sheet**:

   | Frame stock size | Column, board-ft/sheet | Beam, board-ft/sheet |
   |---|---:|---:|
   | 2×2 in | 20.33 | 18.66 |
   | 2×3 in | 30.50 | 28.00 |

   Frame board feet = `ceil(adjusted area / 2.88) × factor`. Stock purchase-equivalent pieces = `ceil(board feet / (thickness_in × width_in × stock_length_ft / 12))`. **This is NOT a verified cut list.** 2×4 and 3×3 values are transparent cross-section *extrapolations*, not factors printed in the reference. For 3/4 in (18 mm) plywood, the 12 mm framing allowance is retained conservatively because the referenced table provides no verified 18 mm multiplier; it must be approved/overridden to suit the temporary works plan.
5. **Slab forms**: underside surface `length × width × number`; joists/edge runners continue to use the user's separate 40 cm site spacing. This geometric framing estimate is **not** claimed to be the book's sheet-based column/beam factor. Supports and propping are not included; estimate staging separately.
6. **Footing forms**: four exposed sides (`2(length + width) × depth × count`) and direct member counts from chosen spacing; no unverified tabulated multiplier is assumed.
7. **Floor scaffolding/staging**: Fajardo Table 5-3 board feet per m² of floor staging, **without plywood**: 2×2 = 6.10, 2×3 = 9.10, 2×4 = 12.10. The special site slant-brace allowance is **not added again** for staging, to avoid double counting. Other lumber dimensions use an explicitly labeled cross-sectional proxy.
8. **Pako**: Fajardo Table 8-10 lists **0.055 kg of 2d finishing nails per plywood sheet** under the table's stated nailing pattern. Select `Fajardo` + `1-inch (2d finishing)` to use it. The other nail options (1½, 2, 3, 3-in concrete) use the explicitly entered pieces-per-m² allowance and selected nail mass. The 0.055 kg rule is not applicable to other nail kinds.
9. **Slants/braces**: the previously requested **one brace station every 2 m** remains adjustable for form panels (column, beam, footing, slab), but it is the user's *quantity assumption*, **not a structural spacing prescribed by Fajardo**. The same applies to the 40 cm slab joist spacing.
10. **Consolidated BOQ**: phenolic sheets grouped by thickness/coverage, coco lumber by size and stock length, nails by size, with individual project sections and PDF output. Reused sheets and timber across phases are not automatically credited; include reuse plans separately.

## Worked book-style examples

- Six columns, 0.30 m × 0.30 m, 4 m form height: `P = 2(0.30+0.30)+0.20=1.40 m`; area `1.40×4×6=33.6 m²`; at 2.88 m² per sheet = **12 sheets**. With 12 mm plywood and 2×2 framing, estimated wood frame = `12×20.33 = 243.96 bd-ft`. Note: the source illustration's different **6 mm** plywood requires a different frame factor.
- Ten beams, 0.30 m width, 0.60 m depth, 4.50 m length: `P=0.30+2×0.60+0.10=1.60 m`; area `1.60×4.50×10=72 m²`; **25 sheets** at 2.88 m² each. With 12 mm plywood and 2×3 frame: `25×28 = 700 bd-ft`.
- 10 m² of floor staging with 2×3 lumber: `10×9.10=91 bd-ft` (exclusive of slab plywood, nails, specific load-rated supports, or decking if separately specified).

## Verification and limits

Code unit tests and automated Chrome UI tests were run for Fajardo reference examples, 2.44 m² custom coverage, old calculator regression, project editing, costs, PDF, backup and phone layout. Use the source files in `tests/` to repeat the tests.

**Safety:** This tool is a preliminary quantity and purchase estimate only, NOT engineering design of formwork, falsework, scaffolds, staging or concrete pressure/shoring. Fajardo's historical estimating constants are not a substitute for applicable building codes, approved structural drawings, plywood manufacturer capacity ratings or competent temporary-works design. Board-foot volume conversion does not ensure workable lumber lengths or connections. Reused form material, beam-to-slab intersections and form cut waste require site-specific checking.

## Web reference locations reviewed

- Fajardo, *Simplified Construction Estimate* (2000 edition), Chapter 5 and Table 8-10: https://id.scribd.com/document/520794226/Simplified-Construction-Estimate-2000-Edition-Max-B-Fajardo
- Supporting formwork training module with the tabulated 12mm column/beam frame factors: https://www.scribd.com/document/924836462/Module-6-FORMWORKS-SCAFFOLDING-AND-STAGING-1

The `README-CHANGES.md` file retains previous v4/v3 change history. This v5 file supersedes its v4 formwork calculator assumptions.
