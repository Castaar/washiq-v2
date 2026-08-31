// Scans app/ and components/ for hardcoded Dutch UI text (JSX text nodes +
// common label props) and writes them to a CSV for translation.
//
// Usage: node scripts/extract-strings.mjs > strings.csv

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCAN_DIRS = ['app', 'components'];

const LABEL_PROPS = ['placeholder', 'aria-label', 'title'];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (entry.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

const JS_SYNTAX_MARKERS = ['===', '!==', '&&', '||', '=>', ');', '() ', '.map(', '.filter(', 'const ', 'return ', 'as number', 'as string', 'as Record'];

function looksLikeText(s) {
  const trimmed = s.trim();
  if (!trimmed) return false;
  if (!/[a-zA-ZÀ-ÿ]/.test(trimmed)) return false; // must contain a letter
  if (/^\{.*\}$/.test(trimmed)) return false; // pure JS expression
  if (trimmed.startsWith('/') || trimmed.startsWith('http')) return false; // paths/urls
  if (/^[A-Z0-9_]+$/.test(trimmed)) return false; // CONST_NAMES
  if (JS_SYNTAX_MARKERS.some((m) => trimmed.includes(m))) return false; // leaked JS expression
  if (trimmed.length > 140) return false; // unlikely to be a UI label
  return true;
}

const seen = new Map(); // text -> { file, line, count }

for (const dir of SCAN_DIRS) {
  const files = walk(join(ROOT, dir));
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    const lines = src.split('\n');
    const relPath = relative(ROOT, file);

    lines.forEach((line, idx) => {
      // JSX text content between tags: >text<
      const jsxTextMatches = line.matchAll(/>([^<>{}\n]+)</g);
      for (const m of jsxTextMatches) {
        const text = m[1].trim();
        if (looksLikeText(text)) record(text, relPath, idx + 1);
      }

      // Known label-ish string props: placeholder="...", aria-label="...", title="..."
      for (const prop of LABEL_PROPS) {
        const re = new RegExp(`${prop}=["']([^"']+)["']`, 'g');
        const propMatches = line.matchAll(re);
        for (const m of propMatches) {
          const text = m[1].trim();
          if (looksLikeText(text)) record(text, relPath, idx + 1);
        }
      }
    });
  }
}

function record(text, file, line) {
  if (!seen.has(text)) {
    seen.set(text, { file, line, count: 1 });
  } else {
    seen.get(text).count += 1;
  }
}

// ── CSV output ──────────────────────────────────────────────────
function csvEscape(s) {
  return `"${String(s).replace(/"/g, '""')}"`;
}

const rows = [['nl', 'fr', 'aantal_keer', 'eerste_bestand', 'regel']];
for (const [text, info] of [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  rows.push([text, '', info.count, info.file, info.line]);
}

process.stdout.write(rows.map((r) => r.map(csvEscape).join(',')).join('\n') + '\n');
