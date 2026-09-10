# SF-BROWSER-01 correction and verification

Date: 2026-09-05. Scope: ServiceFlow safety detail display and its dedicated UI regression tests only.

The prior P2 is corrected. The UI used the original intake `safetyAssessment`, even though the policy deliberately overrides a submitted SAFE assessment when the description contains gas-leak/emergency indicators. The display now gives the evaluated safety-lock reason precedence: POSSIBLE_EMERGENCY or SAFETY_UNKNOWN. Safe requests retain SAFE. No policy, identity, lifecycle, reset, network or security-lock behavior was changed.

Changed product file: `src/components/serviceflow-demo.tsx` (Safety detail expression). Regression: `tests/unit/serviceflow-demo-ui.test.tsx` covers both safety-lock reasons with conflicting SAFE input, all three language selections, absence of SAFE in hazard details and retained disabled action lock. Tests failed twice before the fix with `SafetySAFE` and passed afterward: 11/11, direct installed Vitest CLI. Sandbox initially denied a child process (EPERM); approved escalation allowed execution. No package install or global build was run.

Real-browser verification used Chrome through the available browser extension, not a mocked harness. QA-created dev server: `127.0.0.1:3105`, Next 16.3.4, session 82838, start approximately 07:42 local. Existing synthetic server-side OWNER/tenant configuration was used. The fresh in-memory tenant was empty, so the demo's Reset button initialized the deterministic fixtures once; no Git reset/clean/stash occurred.

Observed EN/FR/AR: safe case details SAFE; gas-leak case details POSSIBLE_EMERGENCY, matching banner; disabled safety lock, no lifecycle action controls. Arabic mobile 390×844 remained RTL with scrollWidth=clientWidth=390. Browser warning/error log list was empty. Four screenshots saved in `artifacts/serviceflow-safety-fix-2026-09-05/`: `en-hazard.png`, `fr-hazard.png`, `mobile-ar-safe.png`, `mobile-ar-hazard.png`. The UNKNOWN branch was tested in the regression fixture, not seeded into the real browser.

The QA-created tab was closed, viewport override restored, QA server interrupted and no listener remained on port 3105. No external service, real data, transaction, message, deployment or source outside the assigned component/test was used. The earlier acceptance report remains the historical pre-fix observation; this document records resolution of SF-BROWSER-01.
