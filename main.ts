// TIDE & THUNDER — the entry program (Node 22, standard library only).
//
// It hands the game in: it copies this repository's game/ (the playable
// open-world game, static files only) and screenshots/ (renders of the game
// itself) into the output directory, then writes /output/dossier.json with
// make.fun's vendored library, so the scorer can check the entry and the
// judge can read it. Outside the grader, MAKEFUN_OUTPUT_DIR stands in for
// /output, e.g.:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The grader runs this program twice and both runs must write the same bytes.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const gameSource = join(repoRoot, 'game');
const shotSource = join(repoRoot, 'screenshots');
const gameDest = join(outputDir, 'game');
const shotDest = join(outputDir, 'screenshots');

mkdirSync(outputDir, { recursive: true });
cpSync(gameSource, gameDest, { recursive: true });
mkdirSync(shotDest, { recursive: true });
if (existsSync(shotSource)) {
  cpSync(shotSource, shotDest, { recursive: true });
}

// The gate's own caps, from the bounty's gate.json: the dossier text is cut
// at 160 KiB, at most 4 screenshots of 256 KiB each, game/ at most 993
// entries and 48 MiB. Passing them here makes this program fail exactly
// where the scorer would refuse the entry.
const dossierBytes = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossierBytes);
