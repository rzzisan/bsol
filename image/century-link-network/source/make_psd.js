// Builds a layered PSD (24x36in @150dpi) from the poster SVG. Each <!--L:Name--> marker in the SVG
// becomes its own pixel layer, cropped to its own bounds, so elements can be moved/replaced/deleted.
const sharp = require('/var/www/hybrid-stack/frontend/node_modules/sharp');
const fs = require('fs');
const { writePsd } = require('ag-psd');

const out = '..';
const svg = fs.readFileSync(out + '/century-link-entertainment-poster.svg', 'utf8');
const re = /<!--L:(.*?)-->/g;
const marks = [...svg.matchAll(re)];
const head = svg.slice(0, marks[0].index);
const W = 3600, H = 5400;

(async () => {
  const children = [];
  for (let i = 0; i < marks.length; i++) {
    const name = marks[i][1];
    const start = marks[i].index + marks[i][0].length;
    const end = i + 1 < marks.length ? marks[i + 1].index : svg.lastIndexOf('</svg>');
    const part = head + svg.slice(start, end) + '</svg>';
    const png = await sharp(Buffer.from(part), { density: 108 }).ensureAlpha().png().toBuffer();
    const t = await sharp(png).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
    const left = -(t.info.trimOffsetLeft || 0), top = -(t.info.trimOffsetTop || 0);
    const raw = await sharp(t.data).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    children.push({
      name, left, top,
      imageData: { width: raw.info.width, height: raw.info.height, data: new Uint8ClampedArray(raw.data) },
    });
    console.log(name.padEnd(34), `${raw.info.width}x${raw.info.height} @ ${left},${top}`);
  }
  const comp = await sharp(out + '/century-link-entertainment-poster-24x36in-150dpi.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const psd = {
    width: W, height: H,
    imageResources: { resolutionInfo: {
      horizontalResolution: 150, horizontalResolutionUnit: 'PPI', widthUnit: 'Inches',
      verticalResolution: 150, verticalResolutionUnit: 'PPI', heightUnit: 'Inches' } },
    imageData: { width: W, height: H, data: new Uint8ClampedArray(comp.data) },
    children,
  };
  const buf = writePsd(psd, { generateThumbnail: false });
  fs.writeFileSync(out + '/century-link-entertainment-poster-24x36in-layered.psd', Buffer.from(buf));
  console.log('PSD', (buf.byteLength / 1048576).toFixed(1), 'MB');
})().catch(e => { console.error(e); process.exit(1); });
