# Theme/UI update

## Scope and safety

This is a local UI-only update, not a calculator redesign.

- `calc-engine.js` and `project-sheets.js` match their pre-edit snapshots byte for byte.
- In `script.js`, only the old theme-management block and its two initialization/listener calls were removed. Every other line of application logic is unchanged.
- Calculator forms, IDs, defaults, unit conversions, result markup, saved-estimate controls, project controls, and PDF/backup code are unchanged.
- Browser tests use isolated contexts and a temporary loopback server, not the user's browser data.

## What changed

| File | Change |
| --- | --- |
| `theme.js` (new) | Isolated early theme initialization and toggle controller. |
| `index.html` | Load theme before CSS; accessible sun/moon button; illustration in the existing home hero. |
| `style.css` | Semantic foreground/background colors, contrast and control borders, responsive header/hero, focus states, transitions, reduced-motion support, and print-safe colors. |
| `script.js` | Remove the superseded theme code only. |
| `icons.js` | Supply missing local timber/formwork icons. |
| `assets/construction-estimate.svg` (new) | Lightweight, self-contained construction illustration; no network or font dependency. |
| `tests/browser_support.py` (new) | Shared Windows Edge / Playwright Chromium launcher and optional project-local test dependencies. |
| Four existing `tests/test-*-browser.py` files | Inline the new theme script; use the portable launcher. Fajardo source files explicitly use UTF-8. Existing assertions are unchanged. |
| `tests/test-theme-browser.py` (new) | Theme, layout, contrast, state isolation, and before/after calculator checks. |
| `tests/verify-theme-isolation.py` (new) | Compare protected source to the local pre-edit snapshot. |

## Theme behavior

The former button relied on sun/moon names missing from the offline icon registry. Its initialization also accessed storage without error handling, ran after page parsing, and mixed theme wiring into application initialization. Some CSS color pairs became unreadable when surface colors inverted.

The new button uses self-contained SVGs and is not a navigation button. It updates its visible action label, accessible name, tooltip, and icon. Keyboard activation uses normal button behavior; a polite status message announces changes.

Only `buildcalc-theme` is read/written by the theme controller. Valid `light`/`dark` preferences are restored before the stylesheet loads. Without a valid saved preference, the system setting is used and followed until the user chooses a mode. Tabs synchronize via storage events. Failed preference reads/writes do not prevent theme switching; an unsaved choice remains active for the current page.

Browser controls receive the matching `color-scheme`; native confirmation dialogs remain browser-managed. Printing uses a light palette regardless of the screen theme. The illustration scales within the existing hero and stacks below its content on small screens.

## Verification

Passed in Microsoft Edge/Chromium on Windows:

- Four original engine suites: general, Fajardo, formwork, and Project Sheets.
- Four original browser suites: calculations, validation, edits, saved estimates, project pricing, PDF exports, and JSON backup/restore.
- New theme suite: light/dark persistence before stylesheet load, OS preferences, cross-tab events, invalid preference fallback, keyboard activation, preference-storage failures, and reduced motion.
- All 11 calculator/converter outputs compared exactly with the pre-edit application.
- Toggling preserves form values, active view/module, current results, and all non-theme localStorage data.
- All five views and 11 calculator panels checked at 1280, 820, 390, and 320 CSS pixels in both themes; no page-level horizontal overflow.
- Sampled UI text contrast is at least 4.5:1 in both themes; print headings remain dark; no JavaScript page errors.
- Desktop/mobile home, calculator, and project screenshots saved for visual review.
- JavaScript syntax checks and source-boundary verification passed.

This is browser viewport testing, not physical-device or Safari/Firefox testing.

### Rerun

```powershell
rtk proxy node --check theme.js
rtk proxy node --check script.js
rtk proxy node --check icons.js
rtk proxy node tests/test-engine.cjs
rtk proxy node tests/test-fajardo-engine.cjs
rtk proxy node tests/test-formwork-engine.cjs
rtk proxy node tests/test-project-engine.cjs
rtk proxy python tests/test-browser.py
rtk proxy python tests/test-fajardo-browser.py
rtk proxy python tests/test-formwork-browser.py
rtk proxy python tests/test-project-browser.py
rtk proxy python tests/test-theme-browser.py
rtk proxy python tests/verify-theme-isolation.py
```

Python browser tests require Playwright; the existing PDF checks also require PyMuPDF. Windows uses installed Edge by default; `BUILDCALC_BROWSER_CHANNEL` can select another installed Playwright-compatible channel.

Screenshots, sample reports, and the pre-edit snapshot are under `tests/test-output/`. The one-time isolation check requires that snapshot. The new browser suite still runs without it, but explicitly skips the before/after comparison in that case.
