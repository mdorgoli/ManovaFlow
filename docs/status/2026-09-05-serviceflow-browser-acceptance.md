# ServiceFlow real-browser acceptance — 2026-09-05

## Result

Core synthetic lifecycle PASS; acceptance has one P2 presentation finding (hazard displays SAFE). This report describes this execution only, not production readiness.

Executed through Codex In-app Browser using the actual local Next.js UI, not a mocked UI harness. Local URL: `http://127.0.0.1:3105/serviceflow`. Next.js 16.3.4 development server, server-side DEMO_MODE=true, OWNER role, synthetic tenant `99999999-9999-4999-8999-999999999901` and actor ending `9902`. No identity was injected into browser requests. Root AGENTS.md, installed Next installation guide, computer-use skill and prior SF-DEMO-1E report were read.

## Observations

| Check | Observed result |
| --- | --- |
| Initial empty tenant | 0 cases; explicit Reset demo instruction |
| Reset baseline | 2 cases, 1 safety hold, 0 active, 0 closed, 5 audit events |
| Before approval | Recommended synthetic technician; explicit no assignment exists |
| Empty human reason | Approval rejected in UI with DEMO-prefix instruction; state unchanged |
| Human approval | Assigned; separate human-approved assignment ID; 7 audit events |
| Start | In progress; completion disabled without evidence |
| Add evidence | Internal `DEMO_EVIDENCE_FIXTURE_COMPLETION_01`; completion enabled |
| Complete and close | Completed then Closed, revision 6; closed-with-evidence=1; active=0; 11 audit events |
| Pause/resume branch | In progress → Blocked → In progress, human reasons in audit; same assignment retained |
| Hazard | POSSIBLE_EMERGENCY safety lock, disabled lock control, no approve/start/complete/close actions; see finding below |
| Reset after workflow | Deterministic 2/1/0/0/5 baseline restored; Arabic remained selected and reset notice was Arabic |
| EN/FR/AR switching | Closed state, assignment and 11 audit events preserved during language switch; notice translated |
| Desktop | 1440×900; EN and FR screenshots saved; operation controls exercised |
| Mobile | 390×844; EN pause/resume and AR layout exercised; no horizontal overflow (`scrollWidth=clientWidth=390`) |
| Real RTL | DOM main has lang=ar and dir=rtl; document HTML remains en/ltr; scoped Arabic experience visibly right-to-left |
| Console | Browser captured error/warn logs empty at two observations, including after mutations and language changes |
| HTTP evidence | Server log showed reset and all executed command requests returning 200 |

## Timed scenario

Reset → review seeded request → human approval → assignment → start → internal evidence → complete → close took **40.012 seconds** measured with wall-clock timestamps around actual browser tool actions. This includes model/tool round trips. It fits the approximately 90-second interaction budget. It does not measure a spoken presentation, new free-form intake, or the additional language/hazard/pause acceptance checks. Request creation is the deterministic reset fixture; there is no newly entered request in this test.

## Finding SF-BROWSER-01 — P2 contradictory hazard safety detail

Reproduction: reset the demo, select the gas-leak emergency case, inspect Request details / Safety (or Arabic السلامة). The page shows **SAFE**, while its safety banner says **POSSIBLE_EMERGENCY**, its policy safety assessment is FAIL, and lifecycle actions are locked. This creates contradictory operator-facing safety information. No bypass was attempted and none was observed. The lock itself works. Evidence: `artifacts/serviceflow-browser-acceptance-2026-09-05/mobile-ar-hazard.png` and real AX snapshot reporting Safety SAFE alongside the hazard banner. Reported to root for a separately owned fix; this worker changed no product source.

FR/AR render application controls and notices in their selected language, but fixture description, technical codes and technician policy explanation remain English. This is a localization limitation, not a claim of complete content translation.

## Saved artifacts

- `artifacts/serviceflow-browser-acceptance-2026-09-05/desktop-en-baseline.png`
- `artifacts/serviceflow-browser-acceptance-2026-09-05/desktop-fr-baseline.png`
- `artifacts/serviceflow-browser-acceptance-2026-09-05/mobile-en-resumed.png`
- `artifacts/serviceflow-browser-acceptance-2026-09-05/mobile-ar-resumed.png`
- `artifacts/serviceflow-browser-acceptance-2026-09-05/mobile-ar-hazard.png`

Closed-state screenshot was inspected inline in the tool transcript; it was not saved as a standalone file. No full keyboard/screen-reader audit, browser-engine matrix, or network-failure injection was performed. No production build was run by this worker.

## Execution and cleanup boundaries

The first `pnpm exec` invocation attempted registry metadata/supply-chain requests and received ECONNREFUSED; it was interrupted. Direct execution of the installed Next binary initially failed with sandbox spawn EPERM, then ran after approved escalation. No provider, outbound message, payment, upload, deployment, or external operational service was invoked. The failed package metadata attempt is disclosed rather than claimed as zero network attempts.

Only the QA-created server (exec session 19487) was interrupted at completion; port 3105 had no listening entry afterward. Temporary browser viewport override was reset. No user process was stopped, no dirty file was cleaned, and no product source/shared test was edited. A final git-status attempt returned “not a git repository”; therefore this report does not claim Git cleanliness.
