# ManovaFlow Public Site — Engineering Handoff

**Status:** selected visual direction; implementation not authorized in this task  
**Surface:** English public landing page only  
**Selected concept:** `Every request, clearly handled.` / light editorial workflow direction  
**Product boundary:** ServiceFlow is in active development; BeautyFlow and BriefFlow remain in validation; no autonomous or outbound action is represented.

## 1. Exact selected reference

| Field | Value |
|---|---|
| Source file | `C:\Users\mdorg\.codex\generated_images\01a06d7e-0e0f-7b31-aed8-5140908f3415\exec-395f44fa-ca20-457e-8d9a-a2ff36bcf6ab.png` |
| Dimensions | `1536 × 1024 px` |
| Pixel format | `24-bit RGB` |
| File size | `1,783,506 bytes` |
| SHA-256 | `50229FEA5C2224FDDBF78998DF0BCCA740E62C818EFBC403D5608BA22B96726B` |
| Reference role | Visual target for hierarchy, composition, color restraint, responsive relationship, and product storytelling |

The reference is a generated raster concept, not a reusable production UI or a source of extractable assets. Engineering must recreate the interface from semantic components and approved production assets; the screenshot must not be shipped as a flattened page or used as a sprite.

## 2. Product-truth guardrails

These rules override any ambiguity in the visual reference:

- `ServiceFlow` must be labeled **In active development**, not merely **Active**, because it is not proven production-ready.
- `BeautyFlow` and `BriefFlow` must each be labeled **In validation** and must not have purchase, signup, or availability claims.
- The public page must state **Research preview · Human-controlled** in the first viewport.
- AI may be described only as checking context and proposing a next step. A named human approves assignment before work begins.
- The shown workflow is limited to a non-emergency service request: intake → completeness/scope check → proposed assignment → human approval → status → completion evidence → closure.
- Do not claim autonomous execution, emergency diagnosis, GPS/routing, inventory, pricing, payments, CRM/ERP integration, messaging, customer data usage, savings, revenue, customer counts, or production readiness.

## 3. Asset readiness and gaps

| Item | Status | Handoff requirement |
|---|---|---|
| Selected visual reference | Ready as design evidence only | Use the exact file and checksum above for visual comparison. It currently lives outside the repository and is not a production asset. |
| English above-the-fold copy | Ready | Use the approved copy in section 6. Do not broaden the claims. |
| Product workflow and status truth | Ready | The current strategy document defines the state model and the three Flow statuses. |
| Final ManovaFlow logo | **Unresolved blocker** | The raster mark is directional only. A separate logo decision, vector master, clear-space rules, favicon set, monochrome variant, and originality/trademark review are still required. |
| Hero photography | Missing | The person/phone scene is embedded in the generated reference. A licensed or commissioned production image, with desktop and mobile crops and documented usage rights, is required. |
| Workflow icons | Missing | Select one licensed icon family and provide consistent SVG assets; do not trace icons from the raster reference. |
| Display and UI webfonts | Missing | Typeface roles are approved, but exact font families, webfont files, and licenses are not. Do not silently substitute a different brand typeface. |
| Responsive source frames | Partially ready | The reference contains a desktop composition and a mobile preview, but no editable source, tablet frame, or measured component states. This document supplies the behavioral specification. |
| Footer/legal content | Missing from reference | Privacy, terms, contact destination, company identity, and final domain are outside this frame and must be approved before public release. |
| Customer proof and metrics | Intentionally unavailable | Do not add logos, testimonials, ratings, usage totals, or performance claims without evidence and approval. |

## 4. Visual system

Values below are implementation tokens derived from the selected raster. They are the starting target for visual QA, not proof of an existing brand library.

### Color tokens

| Token | Value | Use |
|---|---:|---|
| `color-canvas` | `#F8F6F2` | Page background |
| `color-surface` | `#FFFEFC` | Cards and mobile menu surface |
| `color-ink` | `#0A2542` | Headings, primary icons, primary button |
| `color-text` | `#263B50` | Body copy |
| `color-muted` | `#667382` | Supporting copy and disclosure |
| `color-line` | `#DAD7D1` | Dividers and card outlines |
| `color-blue` | `#2166C1` | AI-assisted state and progress signal |
| `color-red` | `#C8101E` | Primary CTA and human-approval signal |
| `color-success` | `#237A52` | Verified completion only |
| `color-focus` | `#0A66D8` | Keyboard focus ring |

Blue and red are sparse functional signals. They must not appear as parallel stripes, a tricolor band, or an institutional/national motif.

### Type tokens

| Token | Desktop | Mobile | Role |
|---|---|---|---|
| `type-display-xl` | `80/0.96`, weight `400` | `44/1.02`, weight `400` | Hero headline; high-contrast editorial serif |
| `type-heading-lg` | `32/1.15`, weight `400` | `28/1.2`, weight `400` | Section heading; same serif |
| `type-body-lg` | `18/1.5`, weight `400` | `16/1.5`, weight `400` | Hero summary; neo-grotesk sans |
| `type-body` | `16/1.5`, weight `400` | `15/1.5`, weight `400` | Product and workflow copy |
| `type-label` | `14/1.3`, weight `600` | `14/1.3`, weight `600` | Navigation, buttons, statuses |

No more than two font families are allowed. The exact licensed serif and sans families remain an asset dependency; fallback stacks are for development only and are not visual acceptance.

### Spacing and shape tokens

| Token | Value | Use |
|---|---:|---|
| `space-1` | `4px` | Fine internal separation |
| `space-2` | `8px` | Icon/label gap |
| `space-3` | `12px` | Compact control gap |
| `space-4` | `16px` | Card padding on mobile |
| `space-6` | `24px` | Standard component spacing |
| `space-8` | `32px` | Mobile section spacing |
| `space-12` | `48px` | Desktop block spacing |
| `space-16` | `64px` | Section padding |
| `space-24` | `96px` | Desktop hero breathing room |
| `radius-control` | `10px` | Buttons and compact controls |
| `radius-panel` | `16px` | Workflow/status panels |
| `border-hairline` | `1px` | Dividers and quiet outlines |

## 5. Page structure

### A. Header

- Desktop: 72px-high single row, brand left, five anchor links centered/right, primary and secondary actions at the end.
- Mobile: 64px-high row with brand and a labeled menu button. The collapsed menu contains the same links and actions in DOM order.
- Navigation labels: `Product`, `Flows`, `How it works`, `About`, `Resources`.
- Header remains visually light. Sticky behavior is optional only after scroll testing; it must not cover anchor targets.

### B. Hero and product statement

- Desktop: copy occupies approximately 34% of the content width; licensed lifestyle image and workflow rail occupy the remaining area.
- Mobile: copy and CTAs appear before the workflow. The image may be removed from the first viewport if retaining it would push product meaning below the fold.
- One primary action and one secondary action only.
- The disclosure remains adjacent to the actions, never hidden in a footer.

### C. Five-step workflow rail

1. `Request received`
2. `AI-assisted review`
3. `Human approval`
4. `Work completed`
5. `Proof of completion`

Desktop uses a horizontal progression with one continuous line. Mobile uses a vertical ordered list. The approval step is the only red state; the AI-assisted step is blue; completion is green only after evidence is shown.

### D. Flow-status strip

- One grouped surface with three equal desktop columns and three mobile rows.
- `ServiceFlow` is first and visually primary, labeled `In active development`.
- `BeautyFlow` and `BriefFlow` are secondary and labeled `In validation`.
- Validation items are informational and non-clickable until an approved destination exists.

### E. Service-business value section

- Heading and one bounded description followed by four lightweight value statements: human control, AI assistance, clear progress, and verifiable outcomes.
- Use dividers rather than four elevated cards.
- Do not add a testimonial or metrics block to fill space.

## 6. Approved English copy

### Header and hero

- Brand: `MANOVAFLOW`
- Headline: `Every request, clearly handled.`
- Summary: `ManovaFlow brings structure to incoming work. AI-assisted review. Human approval. Verified outcomes. Every time.`
- Primary CTA: `See the workflow`
- Secondary CTA: `Meet ServiceFlow`
- Disclosure: `Research preview · Human-controlled`

### Workflow

| Step | Label | Supporting copy |
|---:|---|---|
| 1 | `Request received` | `Captured with the context your team needs.` |
| 2 | `AI-assisted review` | `Checks context and proposes the next step.` |
| 3 | `Human approval` | `A person reviews and approves every assignment.` |
| 4 | `Work completed` | `Progress stays visible through completion.` |
| 5 | `Proof of completion` | `Evidence is attached before the request is closed.` |

### Product statuses

- `ServiceFlow` — `In active development`
- `BeautyFlow` — `In validation`
- `BriefFlow` — `In validation`

### Value section

- Heading: `Built for service businesses`
- Summary: `A focused workflow for non-emergency service requests, from intake to verified closure.`
- `Human in control` — `People approve every assignment before work begins.`
- `AI-assisted` — `AI helps check context and propose the next step.`
- `Clear progress` — `Teams can see what is next, in progress, and complete.`
- `Verifiable outcomes` — `Completion evidence stays linked to the request.`

## 7. Components and interactions

| Element | Default behavior | Hover/focus | Mobile behavior | Disabled/error behavior |
|---|---|---|---|---|
| Header anchors | Scroll to the matching page section | Underline or color shift; 2px visible focus ring | Close menu, then move focus to the target heading | No dead links; omit destinations that do not exist |
| `See the workflow` | Scroll to the five-step rail | Red darkens slightly; no scale jump | Full-width, minimum 48px height | If the target is unavailable, do not render the CTA |
| `Meet ServiceFlow` | Scroll to the ServiceFlow status/value content | Ink outline strengthens; visible focus | Full-width below primary CTA | No external route is inferred in this handoff |
| Mobile menu button | Toggle one navigation panel; update accessible expanded state | Focus ring encloses full 44px target | Escape and outside tap close; focus returns to button | Page scrolling is locked only while panel is open |
| Workflow step | Static explanatory state; no required click | Hover/focus highlights its line segment and supporting copy | All details remain visible; no hover dependency | Missing optional imagery never removes the label or step order |
| Flow status | Informational status row | ServiceFlow may reveal an underline only if it has a valid target | Full-width rows with status beside or below name | Validation rows remain non-interactive |

## 8. Responsive behavior

| Range | Layout behavior |
|---|---|
| `≥ 1200px` | Maximum content width `1440px`; 48px outer gutters; hero uses text/image split; workflow is horizontal; statuses are three columns. |
| `768–1199px` | 32px gutters; hero image reduces before text; workflow may wrap to `3 + 2` only if the continuous order remains obvious; statuses remain grouped. |
| `< 768px` | 20px gutters; collapsed navigation; single-column hero; two full-width CTAs; workflow becomes vertical; statuses become rows; value statements stack. |
| `< 360px` | 16px gutters; no horizontal scrolling; labels wrap naturally; logo wordmark may reduce but must not crop or collapse into an unapproved icon-only state. |

Long English strings may wrap to two lines. Navigation, CTA, and status text must not truncate. Reserve image dimensions before load to prevent layout shift. If hero photography fails, keep the product workflow and copy fully usable on `color-canvas`; never show a broken-image icon.

## 9. Motion

- On first entry, the workflow line may draw once over `600ms` using a standard ease-out curve; step labels fade in without translation greater than 8px.
- Hover/focus state transitions use `150ms`; menu open/close uses `200ms`.
- No infinite animation, parallax, autoplay carousel, or decorative motion is allowed.
- Under `prefers-reduced-motion: reduce`, all states appear immediately and scrolling is not forced to animate.

## 10. Accessibility requirements

- Use semantic `header`, `nav`, `main`, ordered workflow content, sections with headings, and a real `button` for the mobile menu.
- DOM and keyboard order: brand → navigation → primary CTA → secondary CTA → disclosure → workflow steps → statuses → value statements.
- Minimum contrast: `4.5:1` for body/control text and `3:1` for large display text and meaningful icons.
- Minimum pointer target: `44 × 44px`; primary mobile CTAs target `48px` height.
- Visible focus must not rely on red/blue color alone. Step numbers, labels, and status text carry the meaning.
- The hero photo is decorative when the adjacent copy and workflow communicate the same meaning; use empty alternative text. Product icons require accessible names only when they are independent controls.
- At 200% zoom, all content remains available without horizontal scrolling at a 1280px desktop viewport.

## 11. Explicit logo decision gap

The selected screenshot contains a thin blue flow-loop with a red endpoint and a `MANOVAFLOW` wordmark. This is **not the final logo**. It is an image-generation artifact and currently has:

- no editable vector master or deterministic geometry;
- no approved font or custom wordmark drawing;
- no small-size, monochrome, dark-background, print, or favicon variants;
- no documented clear space, minimum size, or color rules;
- no completed originality, WIPO/EUIPO trademark, domain, or confusing-similarity review.

Engineering may reserve a semantic brand slot using the full word `MANOVAFLOW`, but must not trace, extract, or ship the raster symbol. Final logo production and legal/name clearance require separate owner approval before public release.

## 12. Five acceptance criteria

| # | Desktop acceptance | Mobile acceptance |
|---:|---|---|
| 1 | At `1440 × 1024`, the header, headline, both CTAs, disclosure, all five ordered workflow states, and all three Flow statuses are visible without overlap or clipping; the visual hierarchy matches the selected reference. | At `390 × 844` and `360 × 800`, the first viewport contains the brand, headline, summary, both CTAs, and disclosure; the workflow continues in one readable vertical order with no horizontal scroll. |
| 2 | Product meaning is explicit in the first viewport: request intake → AI-assisted proposal → human approval → completion evidence; `ServiceFlow — In active development` and both `In validation` labels use the approved English copy. | The same meaning and statuses remain textually present; no essential explanation depends on the desktop photo, line geometry, hover, or color alone. |
| 3 | Every rendered navigation item and CTA reaches an existing in-page target; keyboard order is logical; Enter/Space operate controls; focus is always visible; the menu is absent from desktop navigation state. | The menu opens and closes by tap, Enter/Space, Escape, and outside tap; focus is contained while open and returns to the trigger; targets are at least `44 × 44px`. |
| 4 | With production assets, the page meets LCP `≤ 2.5s`, CLS `≤ 0.1`, and INP `≤ 200ms` under the agreed test profile; image dimensions are reserved and the page remains usable if the hero image fails. | Responsive images do not download the desktop crop unnecessarily; the same LCP/CLS/INP budgets apply under the agreed mobile test profile, with no layout jump when the menu or workflow appears. |
| 5 | Automated and manual checks confirm WCAG 2.1 AA contrast, semantic landmarks/headings, correct accessible names, 200% zoom without content loss, and reduced-motion support. | Screen-reader order follows the visual order, status meaning is announced in text, all content is reachable at 200% zoom, and reduced-motion removes line drawing and animated scrolling. |

## 13. Scope boundary for the next authorized phase

Implementation can begin only after the owner separately authorizes code changes and resolves or explicitly defers the production hero image, icon family, and font licenses. Public release additionally requires the final logo decision and footer/legal destinations. This handoff does not authorize purchasing, deployment, outreach, external integrations, Apollo usage, or any change outside `D:\ManovaFlow`.
