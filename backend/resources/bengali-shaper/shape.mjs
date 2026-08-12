#!/usr/bin/env node
// HarfBuzz-based Bengali (and any complex-script) text shaper.
// See courier_waybill_context.md §4.5/§4.7 for the full writeup of *why*
// this exists: dompdf has no OpenType shaping engine at all (no GSUB
// ligature substitution, no GPOS mark positioning) — it draws one glyph
// per Unicode codepoint via a plain cmap lookup, left-to-right. For
// Bengali this breaks in two ways: (1) pre-base vowel signs are stored
// *after* their consonant but must display *before* it, and (2) conjunct
// consonant clusters (virama-joined, extremely common — উদ্দিন, স্বাস্থ্য,
// মনিরুজ্জামান, etc.) never form their compact ligature glyph, rendering
// instead as visibly separate letters with a stray hasant mark between
// them. A regex-based pre-base-vowel reorder (the old approach) could
// only ever address (1); (2) requires an actual shaping engine, which is
// what this script provides via harfbuzzjs (a WASM build of the real
// HarfBuzz library — the same engine Chrome/Android/etc. use).
//
// Reads one JSON object from stdin: { "jobs": [ { id, text, fontPath,
// latinFontPath, fontSizePx, maxWidthPx, color }, ... ] }. Writes one JSON
// object to stdout: { "results": [ { id, success, svg, widthPx, heightPx,
// lines } or { id, success: false, error } ] }.
//
// `fontPath` (NotoSansBengali) is used for Bengali-script runs;
// `latinFontPath` (DejaVu Sans, same font dompdf already uses as its base
// font elsewhere in this project) is used for everything else in the
// string. This split exists because NotoSansBengali-*.ttf is a
// script-specific subset with NO Latin alphabet glyphs at all (confirmed:
// every ASCII letter maps to .notdef/glyph 0 in its cmap) — real addresses
// routinely mix Bengali with Latin words (thana/district names are stored
// in English in this app), so a single-font approach can't cover them.
//
// Output is an SVG string (not a rasterized image) — dompdf embeds inline
// SVG data URIs natively and at full vector quality (confirmed directly;
// see §4.7), so there's no rasterization/DPI tradeoff to make here.

import * as hb from 'harfbuzzjs';
import fs from 'fs';

const LINE_HEIGHT_FACTOR = 1.35;
const BASELINE_FACTOR = 0.78; // fraction of line-height down from the line's top; approximate, not a real ascent-metric lookup

const fontCache = new Map(); // fontPath -> { face, font, upem }

function loadFont(fontPath) {
  if (fontCache.has(fontPath)) return fontCache.get(fontPath);
  const data = fs.readFileSync(fontPath);
  const blob = new hb.Blob(data);
  const face = new hb.Face(blob);
  const font = new hb.Font(face);
  const entry = { face, font, upem: face.upem ?? 1000 };
  fontCache.set(fontPath, entry);
  return entry;
}

/**
 * Splits mixed-script text into script-homogeneous runs (Bengali vs.
 * everything else). This matters for two independent reasons: (1)
 * HarfBuzz's own `guessSegmentProperties()` picks ONE script for the
 * *whole* buffer (from the first strongly-scripted character), so a
 * Bengali address followed by a Latin thana/district name would get the
 * Latin tail run through Bengali GSUB, which has no mapping for it; (2)
 * each run needs a different actual font file (see the file-level comment
 * on `latinFontPath`) since NotoSansBengali has no Latin glyphs at all.
 */
function segmentRuns(text) {
  const runs = [];
  let currentScript = null;
  let currentText = '';
  for (const ch of text) {
    const script = /\p{Script=Bengali}/u.test(ch) ? 'Beng' : 'Latn';
    if (script !== currentScript && currentText !== '') {
      runs.push({ script: currentScript, text: currentText });
      currentText = '';
    }
    currentScript = script;
    currentText += ch;
  }
  if (currentText !== '') runs.push({ script: currentScript, text: currentText });
  return runs;
}

/**
 * Shapes one line of (possibly mixed-script) text at a given output
 * font-size, picking `bengFont`/`latnFont` per run and scaling each run's
 * glyph coordinates independently by ITS OWN font's upem (two fonts in one
 * line can have different upem values, e.g. NotoSansBengali is 1000,
 * DejaVu Sans is 2048 — a single shared scale factor would be wrong for
 * one of them). Returns glyphs already in final output-pixel coordinates
 * and the total advance in output pixels.
 */
function shapeLine(bengFont, latnFont, text, fontSizePx) {
  let cursorX = 0;
  const glyphs = [];

  for (const run of segmentRuns(text)) {
    const { font, upem } = run.script === 'Beng' ? bengFont : latnFont;
    const scale = fontSizePx / upem;

    const buffer = new hb.Buffer();
    buffer.addText(run.text);
    buffer.guessSegmentProperties();
    buffer.setScript(run.script);
    hb.shape(font, buffer);
    const infos = buffer.getGlyphInfos();
    const positions = buffer.getGlyphPositions();

    for (const [i, info] of infos.entries()) {
      const pos = positions[i];
      const path = font.glyphToPath(info.codepoint);
      if (path) {
        glyphs.push({
          x: cursorX + pos.xOffset * scale,
          y: pos.yOffset * scale,
          scale,
          path,
        });
      }
      cursorX += pos.xAdvance * scale;
    }
  }

  return { glyphs, advancePx: cursorX };
}

/** Greedy word-wrap using real shaped advances (not a character-count estimate — conjuncts compress width unpredictably, and Bengali/Latin runs have different metrics). */
function wrapText(bengFont, latnFont, text, fontSizePx, maxWidthPx) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  if (!maxWidthPx || maxWidthPx <= 0) return [words.join(' ')];

  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const { advancePx } = shapeLine(bengFont, latnFont, candidate, fontSizePx);
    if (advancePx <= maxWidthPx || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function renderJob(job) {
  const { text, fontPath, latinFontPath, fontSizePx, maxWidthPx, color } = job;
  const bengFont = loadFont(fontPath);
  const latnFont = loadFont(latinFontPath || fontPath);
  const fillColor = color || '#101418';

  const lines = wrapText(bengFont, latnFont, text, fontSizePx, maxWidthPx);
  const lineHeightPx = fontSizePx * LINE_HEIGHT_FACTOR;

  let maxLineWidthPx = 0;
  const lineGroups = [];
  for (const line of lines) {
    const { glyphs, advancePx } = shapeLine(bengFont, latnFont, line, fontSizePx);
    maxLineWidthPx = Math.max(maxLineWidthPx, advancePx);
    const paths = glyphs
      .map((g) => `<g transform="translate(${g.x},${-g.y}) scale(${g.scale},${-g.scale})"><path d="${g.path}"/></g>`)
      .join('');
    lineGroups.push(paths);
  }

  const widthPx = Math.max(maxLineWidthPx, 1);
  const heightPx = lineHeightPx * lines.length;

  const lineSvgs = lineGroups.map((paths, i) => {
    const baselineY = lineHeightPx * (i + BASELINE_FACTOR);
    return `<g transform="translate(0,${baselineY})">${paths}</g>`;
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}" viewBox="0 0 ${widthPx} ${heightPx}"><g fill="${fillColor}">${lineSvgs.join('')}</g></svg>`;

  return { svg, widthPx, heightPx, lines: lines.length };
}

async function main() {
  const raw = fs.readFileSync(0, 'utf8'); // read all of stdin
  const input = JSON.parse(raw);
  const results = [];

  for (const job of input.jobs || []) {
    try {
      const { svg, widthPx, heightPx, lines } = renderJob(job);
      results.push({ id: job.id, success: true, svg, widthPx, heightPx, lines });
    } catch (err) {
      results.push({ id: job.id, success: false, error: String(err && err.message || err) });
    }
  }

  process.stdout.write(JSON.stringify({ results }));
}

main();
