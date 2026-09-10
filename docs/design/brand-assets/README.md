# ManovaFlow MF — selected web asset package

Date: 2026-09-04. Status: completed web exports of the user's selected **large MF mark at the top of the middle column**, labeled `02 / LIGATURE` in the shortlist. This package contains the symbol only, without a wordmark.

## Deliverables

All files are in `D:\ManovaFlow\docs\design\brand-assets`.

| File | Purpose |
|---|---|
| [manovaflow-mf.svg](./manovaflow-mf.svg) | Master vector for light backgrounds; two editable paths and one navy-to-blue gradient. |
| [manovaflow-mf-transparent.png](./manovaflow-mf-transparent.png) | 1400 × 1000 RGBA PNG, rendered directly from the master SVG, with real alpha. |
| [manovaflow-mf-inverse.svg](./manovaflow-mf-inverse.svg) | Light/pale-blue color variant for dark backgrounds; exactly the same path geometry. |
| [manovaflow-mf-inverse-transparent.png](./manovaflow-mf-inverse-transparent.png) | 1400 × 1000 RGBA PNG rendered from the inverse SVG. |
| [manovaflow-mf-32.png](./manovaflow-mf-32.png) | 32 × 32 transparent square web icon, same master geometry centered with padding. |
| [manovaflow-mf-inverse-32.png](./manovaflow-mf-inverse-32.png) | Corresponding transparent 32 × 32 icon for dark backgrounds. |
| [preview-light.png](./preview-light.png) | Master rendered over warm ivory `#F8F6F2`. |
| [preview-dark.png](./preview-dark.png) | Inverse rendered over navy `#081D3C`. |
| [preview-32-light.png](./preview-32-light.png), [preview-32-dark.png](./preview-32-dark.png) | Actual-size 32 × 32 opaque previews on the two backgrounds. |
| [preview-comparison.png](./preview-comparison.png) | Reference beside vector at equal scale, light/dark applications, actual-size and enlarged 32px inspection. |
| [reference-selected-mf.png](./reference-selected-mf.png) | Exact, unretouched crop from the selected original shortlist; comparison evidence only. |
| [verification.json](./verification.json) | Machine-readable alpha, shape, geometry, and contrast measurements. |
| [render-provenance.json](./render-provenance.json) | Source/master hashes, crop coordinates, dimensions, renderer versions. |
| `render-assets.cjs`, `verify-assets.py` | Local reproducible rendering and verification helpers; no product imports or network operations. |

## Source and preservation

The source is `C:\Users\mdorg\.codex\generated_images\01a06d7e-0e0f-7b31-aed8-5140908f3415\exec-8570c4f8-e694-42d1-91f0-c838b94b51a3.png`, a 1717 × 916 raster board. Source SHA-256: `6944629763ed407605e75ac4ab08ad5a71ed69bfe2bcfedb757cc927e63b20f3`.

Crop: x=680, y=235, width=350, height=250. The visible source mark spans x=705–1007 and y=258–459. The later generated standalone images are **not** the tracing source.

The vector preserves the angular M, curved upper exit, curved lower F arm, blue terminal, open diagonal separation, and the relative positions/proportions of both components. The inverse and 32px variants reuse identical path data. The inverse changes only fill colors for dark-surface contrast; the 32px export centers the unchanged geometry inside a square canvas.

## Verification results

| Criterion | Result |
|---|---|
| Real transparency | PASS. All four asset PNGs are RGBA with alpha min=0, max=255, and partially transparent antialiased edges. No painted checkerboard. |
| Transparent master | 926,712 fully transparent pixels, 469,768 opaque pixels, 3,520 partial-alpha pixels in the 1400 × 1000 image. All corners are transparent. |
| Geometry preservation | PASS. Both SVG color variants contain the same two paths; no embedded raster, scripts, fonts, or external resources. |
| Shape overlap | 98.9738% binary-mask intersection-over-union versus the selected source crop. |
| Boundary distance | Mean 0.1963 source pixels; 95th percentile 1px; maximum 2px. Source/render silhouette bounds match. |
| Color fidelity | Mean interior RGB absolute error 2.36 levels out of 255 per channel, excluding the antialiased boundary. |
| Small-size integrity | PASS. Both 32 × 32 PNGs retain two separate components at alpha ≥128. The M silhouette, F arm and separation remain visible in actual-size visual inspection. |
| Light-surface contrast | Minimum opaque-fill contrast 5.48:1 over `#F8F6F2`. |
| Dark-surface contrast | Minimum opaque-fill contrast 7.43:1 for the inverse over `#081D3C`. |

Shape measurement uses source red <120 and rendered alpha ≥128, aligned in the same 350 × 250 coordinate frame. IoU is a silhouette measurement, not a claim of exact pixel reproduction or brand-recognition testing. Contrast values cover opaque fills; antialiased edge pixels naturally blend with the background.

The final comparison sheet was visually inspected at full size and with 32px previews. The contours and separation follow the selected design. Small raster antialiasing softens the pointed inner detail but does not merge the two primary components.

## Usage and limits

- Prefer the SVG for responsive web display. Preserve its aspect ratio; do not stretch it.
- Use the navy/blue master over light backgrounds and the inverse over dark backgrounds. The navy master alone has poor contrast on a navy surface.
- Use the supplied 32 × 32 PNGs at 32 CSS pixels. Smaller sizes were not accepted or optimized in this package.
- The original is a raster concept with no editable mathematical source. This is a faithful traced vector, with up to 2 source pixels of measured boundary deviation; faint raster texture and rendering noise are replaced with clean fills.
- The symbol is self-contained and has no font dependency. Wordmark typography and new logo compositions are not part of this delivery.

## Reproduction

Run `render-assets.cjs` with Node and then `verify-assets.py` with the bundled Python environment. The helper paths are recorded in those files and require the existing local Sharp, Pillow and NumPy installations. Rendering reads the selected original source and master SVG, writes only within this directory, and uses Sharp/librsvg for PNG conversion. Verification checks the master hashes against render provenance and exits unsuccessfully if any acceptance check fails.

No image-generation model, network request, purchase, deployment, product-code edit, or product-UI change was used for this package.
