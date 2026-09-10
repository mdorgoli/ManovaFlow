# Market Scout source-link usability fix

Date: 2026-09-05. Status: PASS for component regression, TypeScript and scoped lint; browser acceptance evidence is recorded separately by QA.

## Change

- Only an event's source URL can render as a native external `<a>`. The URL must parse successfully with the platform URL parser and have the `https:` protocol; otherwise the original value remains readable text.
- Links preserve the recorded URL as their text and destination, use `target="_blank"` and `rel="noopener noreferrer"`, and retain the existing `bdi` isolation in Arabic RTL.
- A scoped cyan, underlined link style distinguishes sources. The existing panel `:focus-visible` rule applies its 2px outline and 4px offset to these native links. No Next Link, prefetch or navigation handler was added.
- URL-shaped filter, decision and reason text remains plain text. Recorded-event semantics are unchanged.

## Changed files

- `src/components/market-scout/activity-panel.tsx`
- `src/components/market-scout/activity-panel.module.css`
- `tests/component/market-scout-activity-panel.test.tsx`
- This report.

## RED / GREEN evidence

All test runs used the installed binary and this exact command from `D:/ManovaFlow`:

```powershell
node node_modules/vitest/vitest.mjs run tests/component/market-scout-activity-panel.test.tsx
```

| Phase | Observed output | Exit |
| --- | --- | --- |
| RED, before source links (17:32:49) | 2 failed / 4 passed; accessible role `link` named `https://example.com` was missing in the source-link and Arabic assertions | 1 |
| GREEN, source links (17:34:33) | 1 file, 6 tests passed | 0 |
| RED, before HTTPS guard (17:35:14) | 8 failed / 6 passed; invalid or non-HTTPS sources incorrectly rendered an anchor | 1 |
| GREEN, final guard (17:35:51) | 1 file, 14 tests passed; no warnings or errors | 0 |

The first sandboxed test attempt could not load the config because process creation returned `spawn EPERM`. That startup failure was not counted as RED. The same focused command subsequently ran with approved process escalation.

Tests render the real pure component with test-only snapshots. They verify native anchor semantics, destination, tab target/referrer protection, focusability, source-only linking, Arabic isolation, and readable fallback for HTTP, JavaScript, data, malformed, protocol-relative and relative inputs. No source link is clicked or visited.

Scoped lint:

```powershell
node node_modules/eslint/bin/eslint.js src/components/market-scout/activity-panel.tsx tests/component/market-scout-activity-panel.test.tsx
```

Exit 0 with no output. This is the two TSX files' lint result, not a CSS or whole-project lint claim.

## TypeScript follow-up

Root's independent verification found `TS2322` in the test fixture at the previous lines 44 and 69: with `noUncheckedIndexedAccess`, spreading `snapshot.events[0]` made required event fields optional. This worker reproduced the two errors (exit 1, RED) with the newly authorized command:

```powershell
node node_modules/typescript/bin/tsc --noEmit --incremental false
```

The test fixture now captures `sourceEvent` once and throws a descriptive error if the fixture contains no event. Both test variations spread this narrowed, complete event. No blind type assertion, non-null assertion, production-type relaxation or TypeScript suppression was used. This follow-up edited only the test file and this report; product source and CSS were unchanged.

Fresh verification after that fix:

- The same focused component command above: exit 0, 1 file / 14 tests passed at 17:41:30.
- The exact TypeScript command above: exit 0 with no output; no emit or incremental cache write.
- The same two-file scoped lint command above: exit 0 with no output.

## Boundaries and remaining evidence

No build, dev-server launch, restart, stop or process kill was performed. QA retains the previously identified server session 28279 on loopback port 3105. No API, authorization, persistence, runtime fixture or recorded data was edited; no POST, research, payment, message or external website visit occurred. No Git command or other-project edit was performed.

Component evidence does not prove actual browser Tab navigation, visible focus, CSS rendering or source-site availability. QA owns and records that acceptance on the existing populated process separately. No new build or production-readiness claim is made for this limited correction.
