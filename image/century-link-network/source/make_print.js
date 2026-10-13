const path = '/var/www/hybrid-stack/frontend/node_modules/sharp';
const sharp = require(path);
const fs = require('fs');
const zlib = require('zlib');
const out = '..';
const svg = out + '/century-link-entertainment-poster.svg';

(async () => {
  // 2400 SVG units = 24in. density 108 -> 3600px wide = 150dpi
  const png = await sharp(svg, { density: 108 }).flatten({ background: '#ffffff' })
    .withMetadata({ density: 150 }).png().toBuffer();
  fs.writeFileSync(out + '/century-link-entertainment-poster-24x36in-150dpi.png', png);

  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const img = zlib.deflateSync(data, { level: 6 });

  const pw = 24 * 72, ph = 36 * 72; // 1728 x 2592 pt
  const parts = []; const offs = []; let pos = 0;
  const push = (b) => { const buf = Buffer.isBuffer(b) ? b : Buffer.from(b, 'latin1'); parts.push(buf); pos += buf.length; };
  const obj = (n, body) => { offs[n] = pos; push(`${n} 0 obj\n`); push(body); push('\nendobj\n'); };
  push('%PDF-1.4\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  offs[4] = pos;
  push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${img.length} >>\nstream\n`);
  push(img); push('\nendstream\nendobj\n');
  const content = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  const xref = pos;
  let x = 'xref\n0 6\n0000000000 65535 f \n';
  for (let i = 1; i <= 5; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
  push(x + `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  fs.writeFileSync(out + '/century-link-entertainment-poster-24x36in.pdf', Buffer.concat(parts));

  await sharp(png).resize(1200).jpeg({ quality: 90 }).toFile(out + '/preview-share.jpg');
  for (const n of ['century-link-network-logo', 'century-link-network-mark']) {
    await sharp(out + '/' + n + '.svg', { density: 216 }).png().toFile(out + '/' + n + '.png');
  }
  console.log('png/pdf/preview done', w, h);
})();
