# Design QA — Public homepage, 2026-09-06

## Latest amendment: homepage languages

The homepage now includes English, French, and Arabic in its visible header. Full localized copy, server-rendered language/direction, Arabic RTL layout, and French line wrapping were verified. All three languages were checked at 320, 390, 768, 1280, and 1440 pixels without horizontal overflow or clipped language controls. Final verification: 394 application tests, 7 HTTP checks, production build/TypeScript, and ESLint passed. [Language acceptance and screenshot evidence](docs/status/2026-09-06-public-homepage-languages.md).

The English-only scope and earlier test counts below describe the preceding implementation checkpoint, not the current language coverage.

Current scope: the user-authorized light public homepage at `/`, approved MF ligature, and relocation of the existing internal console to `/dashboard`. The earlier dashboard QA is preserved below as history.

## Source and comparison method

- Reference: `C:/Users/mdorg/.codex/generated_images/01a06d7e-0e0f-7b31-aed8-5140908f3415/exec-395f44fa-ca20-457e-8d9a-a2ff36bcf6ab.png` (1536 x 1024 desktop/mobile board).
- Desktop target: the approximately 1238-pixel-wide left-hand panel of that board. The 1238 x 1024 browser viewport has a 1223-pixel client area when the Windows scrollbar is present. The board's phone panel is not stretched into desktop content.
- Mobile: reference right-hand phone panel compared with 390 x 1000 and 320 x 844 layouts. The browser gutter is excluded from content-width comparisons. Touch controls deliberately retain a minimum 48-pixel height rather than copying the board's smaller drawn buttons.
- The original board and actual browser captures were opened together in the same image-comparison input during the initial and refined passes. No screenshot was used as the website itself.
- Accepted differences: the subsequently approved MF logo replaces the board's loop; ServiceFlow says “In active development” instead of “Active”; the new generated photograph follows the source's mood/composition but is not the identical photograph. About/resources copy makes the research-preview boundary explicit.

## Findings and correction loop

1. Initial desktop: Instrument Serif was too condensed; stage labels wrapped awkwardly; the straight connector lost the reference's flow rhythm. Replaced the font with Cormorant Garamond, adjusted stage padding/type, and used licensed Phosphor WaveSine connectors.
2. Responsive pass: the 768-pixel layout put text over the photograph and broke the headline into three lines. Moved the tablet photograph into the right half and scaled tablet typography. Rechecked: two headline lines, no overlap with the subject.
3. Narrow mobile pass: the legacy global `body { min-width: 320px }` caused 15 pixels of overflow when the viewport included a scrollbar. Applied a public-home-only body override; the internal console's styles remain unchanged. Rechecked 320: client 305, scroll width 305.
4. Refined desktop/mobile comparisons: correct light palette, navy editorial headline/red period, MF symbol, paired CTAs, five-stage order, three flow statuses, and four value columns. Mobile retains the vertical numbered sequence without the decorative desktop photograph. No remaining actionable P0/P1/P2 finding in this scope.

## Browser evidence

Reliable direct viewport captures under `artifacts/public-home-2026-09-06/`:

- `desktop-final.png`, `desktop-bottom.png`: full desktop coverage through overlapping viewport captures.
- `final-768.png`: tablet after overlap correction.
- `final-320.png`: narrow mobile after overflow correction.
- `final-390.png`, `mobile-middle.png`, `mobile-bottom.png`: mobile top, flow/status/value region, and footer/resources.
- `mobile-menu.png`: open navigation dialog.
- `dashboard-preserved.png`, `scout-preserved.png`: existing internal views remain available.

The experimental `desktop-full.png` and `mobile-full.png` outputs have browser stitching artifacts (black padding/duplicated strips) and are **not acceptance evidence**. Direct viewport images were captured and inspected instead. The live DOM has exactly one footer and correct document bounds.

Fresh interaction checks:

- Both primary CTA anchors scroll to their actual targets (target top approximately 24 CSS pixels).
- Menu opens, focuses Close, marks the page behind it inert, and locks background scrolling. Escape and clicking outside close it; focus returns to the trigger. Choosing Flows closes the dialog, restores scrolling, and lands on `#flows`.
- Keyboard Tab/Shift+Tab focus wrapping and photograph-error fallback are covered by component tests.
- Resource links open the preserved `/dashboard`, `/market-scout`, and `/serviceflow` pages. ServiceFlow currently shows its honest empty synthetic-case state; no Reset or write command was executed.
- Browser warning/error log checks returned empty arrays after homepage interactions and internal-route navigation.
- No horizontal overflow at the checked final widths: 1238, 768, 390, 320 (client widths account for scrollbars). Five stages remain in the DOM throughout. Decorative photo hidden below 768.
- Normal links and buttons have visible focus outlines. Reduced-motion CSS disables transitions/animations; the activity sequence is static, not a simulated live run.

## Build and data preservation

- Final app suite: **54 files / 389 tests passed**.
- Guarded, isolated PostgreSQL suite: **9 tests passed** against the existing test database, not the application database.
- Final Next production build: exit 0, including TypeScript; `/` is statically prerendered and `/dashboard` remains dynamic.
- Final ESLint: exit 0.
- Fresh GET `/api/dashboard`: HTTP 200; GET `/api/market-scout/activity`: HTTP 200 / READY / activity-feed.v3.
- Saved snapshot and website-review evidence exactly match the retained pre-restart artifact. Both SHA-256 values: `d4ad61555a5c14a6db4698a0f44cb4c4f7a843b39bf0b1484c1ea9f156edbe68`.
- No new discovery, outbound request, paid API action, application-database migration/seed/reset, or public deployment was performed.

## Residual P3 / release boundary

- The licensed connector glyph is a close visual substitute, not the board's exact continuous curve; free serif/icon glyph details are not pixel-identical.
- Browser acceptance is Chromium in the Codex in-app browser, not a full cross-browser certification.
- This is a local research preview. The build is not a claim of autonomous customer acquisition, legal approval, production readiness, or public deployment. Legal business/footer details and a release review remain separate.
- Asset provenance, actual dimensions, exact image prompt, and copied font/icon licenses: `docs/design/2026-09-06-public-home-assets.md`.

final result: passed

---

# Historical Design QA — Dashboard Phase 2A.1

## Comparison target

- Source visual truth: `C:\Users\mdorg\.codex\generated_images\01a06994-b7ad-7a23-af88-5957b9da21c5\exec-7dadf589-bdc6-48b9-9a5c-c539c87be0ba.png`
- Final implementation screenshot: `D:\ManovaFlow\docs\status\2026-09-04-dashboard-phase-2a1-english-implementation.jpg`
- Rendered route: `http://127.0.0.1:3000/`
- Comparison viewport: `1487 × 1058` CSS pixels with device pixel ratio `1`
- Density normalization: none; source and implementation were compared together at the same pixel dimensions.
- Scope: the Safety Context, compact control header, and the three parallel lane columns only. The source's lower market, evidence, audit, and action regions remain outside Phase 2A.1.
- Owner-directed normalization: the source is Persian/RTL, while the accepted implementation is intentionally English-only/LTR. Language, direction, and the resulting mirrored text flow are therefore not fidelity defects.

## Final findings

No actionable P0, P1, or P2 mismatch remains inside the Phase 2A.1 scope.

- Layout and density: the full-width safety boundary, compact context row, equal three-column lane grid, square borders, dense ledger rows, and phase boundary preserve the reference control-plane structure.
- Color and hierarchy: the near-black canvas, graphite dividers, cyan ServiceFlow accent, amber backlog accents, and red safety/`MISSING` treatment retain the reference hierarchy and semantics.
- English/LTR conversion: the document and main surface are both LTR; all visible labels, loading copy, error copy, pack-state copy, and accessibility names are English. English strings fit without clipping at the target viewport.
- Honest data semantics: every unavailable observation remains visibly `MISSING`; cap values continue to come from the Phase 1 read model. No missing value is converted to zero or fabricated remaining capacity.
- Safety semantics: `DEMO`, `SYNTHETIC DATA`, `RESEARCH-ONLY`, `Outbound = 0`, and the explicit no-external-actions explanation remain prominent.
- Assets: Phase 2A.1 contains no raster content. Reference line icons remain intentionally omitted because no approved source assets or icon library were supplied; no emoji, handcrafted SVG, CSS drawing, or placeholder icon was substituted.

## Browser evidence

- The accessibility tree exposed a named main surface, a named Safety Context region, a named three-agent region, and three independently named lane articles.
- At `1487 × 1058`, the browser reported `lang=en`, document `dir=ltr`, main `dir=ltr`, three lane panels, 27 explicit `MISSING` values, zero Persian characters in visible text, zero buttons, and no horizontal overflow.
- At `1280 × 720`, all three desktop columns remained visible with no horizontal overflow and no Persian visible text.
- A temporary pre-hydration console probe captured zero warnings, errors, page errors, or unhandled rejections through ready state. The probe was removed, and the final uninstrumented page was reloaded and checked again.
- The local Next.js runtime recorded successful `200` responses for `/` and `/api/dashboard`; no runtime error overlay was present.

## Direct visual comparison

The source and final screenshot were opened in one comparison input at original resolution. Within the accepted scope, both preserve the red safety band first, compact brand/context/date row second, ServiceFlow/BeautyFlow/BriefFlow in equal left-to-right columns, cyan/amber lane accents, horizontal ledger dividers, and red missing-data emphasis. The implementation intentionally stops after the lane grid because the lower source regions belong to later phases.

## Comparison history

- Phase 2A Pass 1: blocked for an oversized header and excessive vertical spacing; fixed by compacting the shell and ledger.
- Phase 2A Pass 2: blocked for reversed lane-heading placement and overly subdued ledger text; fixed before the prior RTL acceptance.
- Phase 2A Pass 3: passed for the original RTL scope.
- Phase 2A.1 English pass: the owner-directed English-only/LTR conversion preserved the accepted structure and semantics; no new P0/P1/P2 mismatch was found.

## Residual P3 polish

- Add consistent lane icons only after an approved icon library or source assets are available.
- Run a dedicated mobile visual acceptance pass when a mobile reference or approved responsive direction exists.

final result: passed
