#!/usr/bin/env node
// scripts/check-bundle-size.mjs — client bundle budget check
// Session 45 · Build 5 · Wave 5-0
//
// Reads client/dist/assets/*.js (after `vite build`), prints the raw and gzip
// size of every chunk, and fails when the entry chunk is over the budget
// (default 350 kB gzip, build 5 conventions §3). Not wired into `prebuild`;
// session 60 decides after measuring.
//
// Usage: pnpm run check:bundle [-- --dist client/dist] [--budget-kb 350]
// Env:   BUNDLE_BUDGET_KB overrides the budget.
// Exit:  0 within budget, 1 over budget, 2 no build output / entry not found.
// Sizes use kB = 1000 bytes, like Vite's build report.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_BUDGET_KB = 350;

function parseArgs(argv) {
  const opts = { dist: path.join(APP_ROOT, 'client', 'dist'), budgetKb: undefined };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dist') opts.dist = path.resolve(argv[++i] ?? '');
    else if (arg === '--budget-kb') opts.budgetKb = Number(argv[++i]);
  }
  const fromEnv = process.env.BUNDLE_BUDGET_KB ? Number(process.env.BUNDLE_BUDGET_KB) : undefined;
  opts.budgetKb = opts.budgetKb ?? fromEnv ?? DEFAULT_BUDGET_KB;
  if (!Number.isFinite(opts.budgetKb) || opts.budgetKb <= 0) {
    throw new Error(`invalid budget: ${opts.budgetKb}`);
  }
  return opts;
}

const kb = (bytes) => (bytes / 1000).toFixed(2);

/** Entry chunk = the module script referenced by dist/index.html. */
function findEntry(dist, chunks) {
  const html = path.join(dist, 'index.html');
  if (existsSync(html)) {
    const text = readFileSync(html, 'utf8');
    const re = /<script[^>]*type="module"[^>]*src="([^"]+\.js)"/g;
    for (const m of text.matchAll(re)) {
      const base = path.basename(m[1]);
      if (chunks.some((c) => c.file === base)) return base;
    }
  }
  // Fallback: the largest index-*.js chunk.
  const candidates = chunks.filter((c) => /^index[-.]/.test(c.file));
  candidates.sort((a, b) => b.gzip - a.gzip);
  return candidates[0]?.file;
}

function main() {
  const { dist, budgetKb } = parseArgs(process.argv.slice(2));
  const assets = path.join(dist, 'assets');
  if (!existsSync(assets)) {
    console.error(`check-bundle-size: ${assets} not found. Run the client build first (pnpm run build:client).`);
    return 2;
  }
  const chunks = readdirSync(assets)
    .filter((f) => f.endsWith('.js'))
    .map((file) => {
      const buf = readFileSync(path.join(assets, file));
      // Default zlib level, close to the gzip column of Vite's build report.
      return { file, raw: buf.length, gzip: gzipSync(buf).length };
    })
    .sort((a, b) => b.gzip - a.gzip);
  if (chunks.length === 0) {
    console.error(`check-bundle-size: no .js chunks in ${assets}`);
    return 2;
  }

  const entry = findEntry(dist, chunks);
  const width = Math.max(...chunks.map((c) => c.file.length), 5);
  console.log(`${'chunk'.padEnd(width)}  ${'raw kB'.padStart(10)}  ${'gzip kB'.padStart(10)}`);
  for (const c of chunks) {
    const mark = c.file === entry ? '  <- entry' : '';
    console.log(`${c.file.padEnd(width)}  ${kb(c.raw).padStart(10)}  ${kb(c.gzip).padStart(10)}${mark}`);
  }
  const totalGzip = chunks.reduce((s, c) => s + c.gzip, 0);
  console.log(`${chunks.length} chunks, ${kb(totalGzip)} kB gzip total`);

  if (!entry) {
    console.error('check-bundle-size: entry chunk not found (no index.html module script, no index-*.js)');
    return 2;
  }
  const entryGzip = chunks.find((c) => c.file === entry).gzip;
  const budgetBytes = budgetKb * 1000;
  if (entryGzip > budgetBytes) {
    console.error(`FAIL: entry chunk ${entry} is ${kb(entryGzip)} kB gzip, over the ${budgetKb} kB budget`);
    return 1;
  }
  console.log(`OK: entry chunk ${entry} is ${kb(entryGzip)} kB gzip (budget ${budgetKb} kB)`);
  return 0;
}

try {
  process.exitCode = main();
} catch (err) {
  console.error(`check-bundle-size: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 2;
}
