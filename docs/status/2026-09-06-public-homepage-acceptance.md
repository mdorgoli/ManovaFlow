# Public homepage — completed local implementation

Date: 2026-09-06, Asia/Tehran.

Update: the later user correction has been implemented as a [three-language public homepage](2026-09-06-public-homepage-languages.md). The English-only scope and counts below are retained as the earlier checkpoint.

The user authorized implementation after the earlier status report distinguished the approved homepage image from the still-internal root route.

## Delivered

- `/`: the light English public homepage, selected MF ligature, generated lifestyle photograph, local licensed fonts, five-stage workflow, honest flow statuses, values, working navigation, and research-resource links.
- `/dashboard`: the existing GrowthDashboard, unchanged internally, with separate research-only/noindex metadata.
- `/market-scout` and `/serviceflow`: preserved. Public homepage rendering no longer fetches the internal dashboard API.
- Mobile navigation supports focus trapping, Escape, outside-click close, background inertness/scroll locking, and restored focus.
- Public styles are scoped. A public-only narrow-screen fix does not change the legacy dark console's body layout.
- Built-in Next development badge hidden using the supported configuration; compile/runtime error reporting remains enabled.

## Verification

| Check | Result |
| --- | --- |
| Component baseline before implementation | 6 expected failures against the old root dashboard |
| Final application tests | 389 passed across 54 files |
| Guarded isolated PostgreSQL tests | 9 passed |
| Production build, including TypeScript | Passed; static `/`, dynamic `/dashboard` |
| ESLint | Passed |
| Direct browser QA | Desktop, tablet, 390- and 320-pixel mobile; interaction checks passed |
| Existing read APIs | Both HTTP 200; Scout READY |
| Stored snapshot and website evidence | Byte-equivalent JSON serialization to retained baseline |

Preserved evidence hash: `d4ad61555a5c14a6db4698a0f44cb4c4f7a843b39bf0b1484c1ea9f156edbe68`.

The existing local WSL database service needed to be made available again after the preview had been offline. No credentials were changed or exposed, and no application data was rewritten. A WSL keepalive and local Next preview are left running.

Full visual comparison, correction history, reliable screenshot paths, and known screenshot-stitching limitation: [design-qa.md](../../design-qa.md).

Asset provenance and exact image generation prompt: [asset record](../design/2026-09-06-public-home-assets.md).

## Local preview

- Homepage: http://127.0.0.1:3105/
- Internal dashboard: http://127.0.0.1:3105/dashboard
- Recorded marketing workflow: http://127.0.0.1:3105/market-scout#marketing-workflow

If the machine or preview process is stopped, these local links will stop responding until the existing services are restarted. They are not public hosting URLs.

No new research run, sending, purchase, paid API use, deployment, Academy change, AgentSite change, or power action was performed. Public launch, legal business details, and fuller autonomous marketing capabilities are not part of this completion claim.
