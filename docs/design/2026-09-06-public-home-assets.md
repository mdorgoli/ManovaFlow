# Public homepage asset record

Date: 2026-09-06. Scope: local ManovaFlow implementation only; no publication or purchase.

## Reference and brand

- Approved visual reference: `C:/Users/mdorg/.codex/generated_images/01a06d7e-0e0f-7b31-aed8-5140908f3415/exec-395f44fa-ca20-457e-8d9a-a2ff36bcf6ab.png`.
- Approved MF ligature copied without modification from `docs/design/brand-assets/manovaflow-mf.svg` to `public/assets/brand/manovaflow-mf.svg`. The loop in the original board is deliberately not used, following the user's subsequent MF selection.
- Cormorant Garamond 400 and Barlow 400/500/600 are bundled locally from pinned Fontsource packages, with SIL OFL licenses in `docs/design/homepage-licenses/`. No Google Fonts runtime request.
- Phosphor React 2.1.10 thin icons, including the decorative WaveSine connectors, are used under the copied MIT license. No hand-drawn SVG assets.
- Instrument Serif was evaluated in the first comparison, rejected as too condensed, and removed from dependencies. Its retained license is a record of the comparison, not an active font.

Sources: [Cormorant](https://github.com/CatharsisFonts/Cormorant), [Barlow](https://github.com/jpt/barlow), [Phosphor React](https://github.com/phosphor-icons/react). Exact distributed licenses are retained alongside this record.

## Generated hero photograph

- Mode: built-in image generation, one fresh photograph with the approved board as a visual reference. Not iterative editing of the screenshot.
- Native output: `C:/Users/mdorg/.codex/generated_images/01a07768-7d94-73f1-a811-43a6e3744617/exec-0f81b6ef-8195-4a5f-96ec-82f882099677.png`.
- Workspace copy: `public/assets/home/hero-lifestyle-v1.png`.
- Actual dimensions: 1672 x 941; PNG, 1,955,587 bytes. The requested 2048 x 1152 was not returned; no larger resolution is claimed.
- SHA-256: `D804287E1DC63001E40EAD2909C7094FAEF9EA7571683ABB95C0B131728888BF`.
- Inspected as a standalone image and in the running page. It is decorative, not a customer testimonial or a photograph of an actual ManovaFlow customer.
- Next Image serves responsive optimized derivatives; the full original remains available. The photograph is hidden in the mobile layout; the small mobile source selection does not download the desktop-sized derivative.

### Exact generation prompt

```text
Use case: photorealistic-natural
Asset type: one standalone landscape lifestyle photograph for the PublicHomepage hero, displayed about 860 x 480 CSS pixels.
Primary request: Generate a fresh high-quality photorealistic photograph inspired by the lifestyle photo and warm ivory palette in the supplied reference image. The reference is composition and mood guidance only.
Input images: Image 1 is a website screenshot used only as a visual reference for the woman, pale sofa, soft light, and room palette. Create a photograph, not a screenshot or a website.
Scene/backdrop: A very bright warm ivory minimalist living room. A pale cream sofa spans the lower frame. The right half is predominantly quiet light ivory wall and sofa, with one subtly blurred leafy plant and exactly two small pale ceramic objects placed far to the right.
Subject: One adult woman in her early thirties with dark hair in a casual loose bun. She wears a cream knitted sweater and dark indigo jeans, sitting comfortably on the pale cream sofa. She smiles gently while looking down at a dark smartphone she naturally holds with both hands. Natural skin texture, fine dark flyaway hair, realistic knitted fabric, believable hands and fingers.
Composition/framing: Landscape 16:9, target 2048 x 1152 pixels. Eye-level relaxed editorial framing. Woman left of center, centered around 37 percent of the image width. Her full head including bun, upper body, both hands, smartphone, and seated knees are all visible without cropping. Her seated body occupies approximately the left-middle third of the frame. The right half remains airy and quiet. Comfortable margin above her bun and around her hands.
Lighting/mood: Very bright soft natural daylight, gentle realistic shadows, relaxed warm approachable mood, natural photographic depth of field.
Color palette: Restrained warm beige, cream, and ivory, with dark hair, phone, and jeans providing soft contrast. Match the reference's creamy light appearance.
Constraints: Exactly one continuous standalone photograph. No text, no letters, no icons, no cards, no logo, no user interface, no watermark, no borders, no collage, no dark vignette. Do not reproduce any website elements from the reference. Preserve the complete head and hands.
```
