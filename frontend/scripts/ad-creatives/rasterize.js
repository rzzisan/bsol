// Rasterizes every SVG in ./svg (written by gen_ads.py) into ./png at its
// declared width/height. Run from this directory: `node rasterize.js`.
// `require("sharp")` resolves via frontend/node_modules by walking up from
// here — no separate install needed, sharp is already a Next.js dependency.
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const SVG_DIR = path.join(ROOT, "svg");
const PNG_DIR = path.join(ROOT, "png");

const sizeFromName = (name) => {
  // Filenames encode nothing about size directly; read the svg's width/height attrs.
  const svg = fs.readFileSync(path.join(SVG_DIR, name), "utf8");
  const w = parseInt(svg.match(/width="(\d+)"/)[1], 10);
  const h = parseInt(svg.match(/height="(\d+)"/)[1], 10);
  return { w, h };
};

(async () => {
  fs.mkdirSync(PNG_DIR, { recursive: true });
  const files = fs.readdirSync(SVG_DIR).filter((f) => f.endsWith(".svg"));
  for (const file of files) {
    const { w, h } = sizeFromName(file);
    const outName = file.replace(/\.svg$/, ".png");
    await sharp(path.join(SVG_DIR, file), { density: 96 })
      .resize(w, h)
      .png()
      .toFile(path.join(PNG_DIR, outName));
    console.log(`OK ${outName} (${w}x${h})`);
  }
})().catch((err) => {
  console.error("FAIL", err);
  process.exit(1);
});
