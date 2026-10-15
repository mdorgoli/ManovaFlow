// Deterministic local asset rendering; never imports or changes product code.
async function main() {
  const [
    { default: fs },
    { default: path },
    { default: crypto },
    { default: sharp }
  ] = await Promise.all([
    import("node:fs"),
    import("node:path"),
    import("node:crypto"),
    import("file:///C:/Users/mdorg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.cjs")
  ]);
  const dir = __dirname;
  const source =
    "C:/Users/mdorg/.codex/generated_images/01a06d7e-0e0f-7b31-aed8-5140908f3415/exec-8570c4f8-e694-42d1-91f0-c838b94b51a3.png";
  const box = { left: 680, top: 235, width: 350, height: 250 };
  const hash = (b) => crypto.createHash("sha256").update(b).digest("hex");
  async function render(svg, width, height) {
    return sharp(Buffer.from(svg), { density: 288 })
      .resize(width, height)
      .png()
      .toBuffer();
  }
  async function onBackground(png, background, width, height) {
    return sharp({ create: { width, height, channels: 4, background } })
      .composite([{ input: png, gravity: "centre" }])
      .png()
      .toBuffer();
  }
  const svg = fs.readFileSync(path.join(dir, "manovaflow-mf.svg"), "utf8");
  const inverse = svg
    .replace(
      "Selected MF ligature,",
      "Light-on-dark color variant of the selected MF ligature,"
    )
    .replace("Navy M and flowing blue F", "Light M and pale-blue F")
    .replaceAll("#081D3C", "#F8FAFF")
    .replaceAll("#081F3F", "#F8FAFF")
    .replaceAll("#082751", "#EFF5FF")
    .replaceAll("#0B3B85", "#CADCFF")
    .replaceAll("#0D4CAE", "#A3C3FF")
    .replaceAll("#185ED0", "#82ACFF");
  fs.writeFileSync(path.join(dir, "manovaflow-mf-inverse.svg"), inverse);
  const sourceBytes = fs.readFileSync(source);
  const sourceCrop = await sharp(sourceBytes).extract(box).png().toBuffer();
  fs.writeFileSync(path.join(dir, "reference-selected-mf.png"), sourceCrop);
  const regular = await render(svg, 1400, 1000);
  const reverse = await render(inverse, 1400, 1000);
  fs.writeFileSync(path.join(dir, "manovaflow-mf-transparent.png"), regular);
  fs.writeFileSync(
    path.join(dir, "manovaflow-mf-inverse-transparent.png"),
    reverse
  );
  fs.writeFileSync(
    path.join(dir, "preview-light.png"),
    await onBackground(regular, "#F8F6F2", 1400, 1000)
  );
  fs.writeFileSync(
    path.join(dir, "preview-dark.png"),
    await onBackground(reverse, "#081D3C", 1400, 1000)
  );
  // Square app asset. Geometry remains identical; original viewBox is centered by SVG.
  const square = (s) =>
    s.replace(
      'width="350" height="250" viewBox="680 235 350 250"',
      'width="32" height="32" viewBox="680 185 350 350"'
    );
  const tiny = await render(square(svg), 32, 32);
  const tinyInverse = await render(square(inverse), 32, 32);
  fs.writeFileSync(path.join(dir, "manovaflow-mf-32.png"), tiny);
  fs.writeFileSync(path.join(dir, "manovaflow-mf-inverse-32.png"), tinyInverse);
  const lightTiny = await onBackground(tiny, "#F8F6F2", 32, 32);
  const darkTiny = await onBackground(tinyInverse, "#081D3C", 32, 32);
  fs.writeFileSync(path.join(dir, "preview-32-light.png"), lightTiny);
  fs.writeFileSync(path.join(dir, "preview-32-dark.png"), darkTiny);
  const referenceLarge = await sharp(sourceCrop)
    .resize(700, 500)
    .png()
    .toBuffer();
  const vectorMedium = await render(svg, 700, 500);
  const reverseMedium = await render(inverse, 700, 500);
  const lightMedium = await onBackground(vectorMedium, "#F8F6F2", 700, 500);
  const darkMedium = await onBackground(reverseMedium, "#081D3C", 700, 500);
  const label = (text, color = "#263B50", size = 22) =>
    Buffer.from(
      `<svg width="700" height="54" xmlns="http://www.w3.org/2000/svg"><text x="24" y="36" font-family="Arial" font-size="${size}" fill="${color}">${text}</text></svg>`
    );
  const strip = await sharp({
    create: { width: 1400, height: 140, channels: 4, background: "#F8F6F2" }
  })
    .composite([
      { input: label("32px actual size | light / dark"), left: 0, top: 0 },
      { input: lightTiny, left: 28, top: 74 },
      { input: darkTiny, left: 88, top: 74 },
      {
        input: label("8x nearest-neighbor inspection", "#263B50", 20),
        left: 360,
        top: 0
      }
    ])
    .png()
    .toBuffer();
  const largeTiny = await sharp(lightTiny)
    .resize(256, 256, { kernel: "nearest" })
    .png()
    .toBuffer();
  const largeDarkTiny = await sharp(darkTiny)
    .resize(256, 256, { kernel: "nearest" })
    .png()
    .toBuffer();
  const board = await sharp({
    create: { width: 1400, height: 1460, channels: 4, background: "#F8F6F2" }
  })
    .composite([
      { input: label("SELECTED REFERENCE / upper-center MF"), left: 0, top: 0 },
      { input: label("VECTOR / same view and scale"), left: 700, top: 0 },
      { input: referenceLarge, left: 0, top: 60 },
      { input: lightMedium, left: 700, top: 60 },
      { input: label("LIGHT BACKGROUND"), left: 0, top: 578 },
      { input: label("DARK BACKGROUND / same geometry"), left: 700, top: 578 },
      { input: lightMedium, left: 0, top: 638 },
      { input: darkMedium, left: 700, top: 638 },
      { input: strip, left: 0, top: 1160 },
      { input: largeTiny, left: 380, top: 1200 },
      { input: largeDarkTiny, left: 680, top: 1200 }
    ])
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(dir, "preview-comparison.png"), board);
  fs.writeFileSync(
    path.join(dir, "render-provenance.json"),
    JSON.stringify(
      {
        source,
        sourceSha256: hash(sourceBytes),
        sourceDimensions: { width: 1717, height: 916 },
        crop: box,
        selected:
          "Large upper-center MF in 02 / LIGATURE; not the later generated isolates",
        masterSha256: hash(Buffer.from(svg)),
        inverseSha256: hash(Buffer.from(inverse)),
        renderer: sharp.versions,
        transparentPng: { width: 1400, height: 1000 },
        smallPng: { width: 32, height: 32 },
        geometryPolicy:
          "Same path data for regular and inverse. 32px keeps identical geometry and centers it in a square canvas."
      },
      null,
      2
    ) + "\n"
  );
  console.log("Rendered selected MF package within " + dir);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
