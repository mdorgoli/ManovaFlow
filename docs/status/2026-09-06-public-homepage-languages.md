# Public homepage languages — local acceptance

The user's correction was that the public homepage, not only the internal tools, must expose English, French, and Arabic. This supersedes the earlier English-only homepage scope.

## Delivered

- English `/`, French `/fr`, Arabic `/ar`.
- All three choices remain visible in the homepage header, including mobile, without opening its menu. Native links work without JavaScript and the current choice is marked with `aria-current`.
- Full localized homepage copy: navigation, headline, description, calls to action, five workflow stages, flow statuses, values, about, resources, footer, and accessibility labels.
- French and Arabic titles/descriptions are rendered on the server. Arabic document and content have `lang="ar" dir="rtl"` before hydration; no client-only language flash or document-direction patch is used.
- Route-based language selection survives refresh and direct links. It does not add a preference cookie or silently change the internal panels' independent language state.
- Arabic mirrors directional layout and workflow order without mirroring the MF logo or photograph. Latin product names are isolated. Arabic uses the existing system-font stack; no font purchase or new package was needed.
- French headline sizing and Arabic tablet photo framing were corrected after direct visual inspection.

## Architecture and scope

The former root layout and four UI page files were relocated into `src/app/(default)/`; their URLs are unchanged. The localized homepage has a separate root layout under `src/app/[locale]/`, allowing correct HTML language/direction with statically generated French and Arabic pages. Unsupported locale paths return 404. The API routes and database implementation are unchanged.

Homepage dictionaries are typed and centrally maintained in `src/components/public-home/home-copy.ts`. Header copy is passed to its interactive menu as serializable data. Two pre-existing internal anchors were converted to Next Link with prefetch disabled to satisfy routing lint after the route reorganization; their destinations and meanings are unchanged.

## Verification

- Test-first: five new homepage language tests failed against the English-only component, then passed after implementation.
- Route baseline: `/fr` and `/ar` returned 404 before the localized routes were added, then passed the HTTP checks.
- Final application suite: **55 files, 394 tests passed**.
- HTTP suite: **7 passed** — server-rendered language/direction, supported destinations, unsupported locale 404, and all three existing internal views reachable.
- Final production build with TypeScript: passed; `/`, `/fr`, and `/ar` prerendered.
- Final repository ESLint: passed.
- Existing dashboard and Market Scout read APIs both returned HTTP 200. No write request or new research run was made.
- Browser language cycle French → Arabic → English worked through the header. Arabic mobile menu opened, focused Close, dismissed with Escape, restored trigger focus and body scrolling, and cleared inertness.
- All three languages checked at viewport widths **320, 390, 768, 1280, 1440**. Language links remained in bounds. Document scroll width equaled client width at each size (305, 375, 753, 1265, 1425 pixels with the Windows scrollbar).
- After correction, the French headline used two lines at all five checked sizes.
- Fresh-document browser error/warning checks returned empty arrays. An intermediate development HMR mismatch occurred while the route files and CSS were changing; fresh navigation resolved it, and it did not recur in the final checks.

Local PostgreSQL integration tests were not rerun for this UI-only change; the database and persistence code were not edited.

## Visual evidence

Direct viewport images in `artifacts/public-home-languages-2026-09-06/`:

- `ar-desktop.png`
- `ar-tablet.png`
- `ar-mobile.png`
- `fr-desktop.png`
- `fr-mobile.png`

These checks cover local Chromium, not a separate cross-browser certification or native-speaker translation certification. This change does not claim that the internal research dashboard has been localized, nor that this site has been published.

No paid API use, message sending, purchase, deployment, Academy change, AgentSite change, or system power action occurred.
