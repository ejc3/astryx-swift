// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * Makes a token signing key for local use and writes it to a file (mode 0600), never to the
 * terminal: `pnpm --filter ./server run key <file>` (default `.scratch/token-signing-key` at the
 * repository root, which git ignores). Load it into the environment when starting the API:
 *   TOKEN_SIGNING_KEY="$(cat .scratch/token-signing-key)" ...
 * Staging and production keys are made the same way, straight into Secrets Manager, by the infra.
 */
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {newSigningKey} from '../src/tokens.ts';

const file = resolve(
  process.argv[2] ??
    new URL('../../.scratch/token-signing-key', import.meta.url).pathname,
);
if (existsSync(file)) {
  console.error(
    `signing-key: ${file} exists; remove it first to make a new key`,
  );
  process.exit(1);
}
mkdirSync(dirname(file), {recursive: true});
writeFileSync(file, newSigningKey(), {mode: 0o600});
console.log(`signing-key: wrote a new Ed25519 key to ${file}`);
