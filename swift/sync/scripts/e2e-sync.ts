// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * Sync end to end, on this machine (docs/SYNC.md, "How it is proved"): a private Postgres
 * (logical replication, 127.0.0.1 only), the API with DEV_IDENTITY, and zero-cache from the
 * installed @rocicorp/zero, then Zero clients through `startSync`. It sets everything up in
 * .scratch/e2e-sync (git-ignored), checks, and tears down only what it started, by pid.
 *
 *   pnpm --filter ./sync e2e
 *
 * Postgres comes from PG_BIN, or the newest /usr/lib/postgresql/<n>/bin. Ports are free ones
 * picked from E2E_PORTS (default 45000-46000). Every secret (the database password, the token
 * signing key, zero-cache's API key) is made fresh for the run and reaches the processes through
 * their environment, never their command line.
 */
import {spawn, spawnSync, type ChildProcess} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import net from 'node:net';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  TABLES,
  createClient,
  readDoc,
  type Action,
  type Doc,
  type Mutation,
  type Row,
} from '@astryx-native/core';
import {mutation} from '@astryx-native/sync';
import {
  readToken,
  startSync,
  type FirstSignIn,
  type SyncHandle,
  type SyncStatus,
} from '@astryx-native/sync/client';
import postgres from 'postgres';
import {newSigningKey, tokenKeys} from '../../server/src/tokens.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const RUN = join(ROOT, '.scratch', 'e2e-sync');
const children: {name: string; proc: ChildProcess; group: boolean}[] = [];
const handles: SyncHandle[] = [];
let proxy: Proxy | null = null;
let db: postgres.Sql | null = null;
let passed = 0;

const log = (m: string) => console.log(`e2e-sync: ${m}`);
const ok = (m: string) => {
  passed++;
  console.log(`  ok ${passed} - ${m}`);
};
class Failure extends Error {}
const check = (cond: unknown, m: string): void => {
  if (!cond) {throw new Failure(m);}
  ok(m);
};
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function until<T>(
  what: string,
  fn: () => T | Promise<T>,
  ms = 30_000,
): Promise<NonNullable<T>> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) {return v as NonNullable<T>;}
    if (Date.now() > end) {throw new Failure(`timed out waiting for ${what}`);}
    await sleep(50);
  }
}
const secret = () => randomBytes(24).toString('hex');

// --- Ports, processes ---------------------------------------------------------------------------

const [PORT_LO, PORT_HI] = (process.env.E2E_PORTS ?? '45000-46000')
  .split('-')
  .map(Number) as [number, number];
const taken = new Set<number>();
const canBind = (port: number) =>
  new Promise<boolean>(r => {
    const s = net
      .createServer()
      .once('error', () => r(false))
      .once('listening', () => s.close(() => r(true)));
    s.listen(port, '127.0.0.1');
  });
/** `count` consecutive free ports (zero-cache uses its port and the next two). */
async function freePorts(count: number): Promise<number> {
  for (let i = 0; i < 200; i++) {
    const p = PORT_LO + Math.floor(Math.random() * (PORT_HI - PORT_LO - count));
    const range = Array.from({length: count}, (_, k) => p + k);
    if (range.some(x => taken.has(x))) {continue;}
    if ((await Promise.all(range.map(canBind))).every(Boolean)) {
      range.forEach(x => taken.add(x));
      return p;
    }
  }
  throw new Failure(`no ${count} free ports in ${PORT_LO}-${PORT_HI}`);
}

function start(
  name: string,
  cmd: string,
  args: string[],
  env: Record<string, string>,
  group = false,
): ChildProcess {
  const out = openSync(join(RUN, `${name}.log`), 'a');
  const proc = spawn(cmd, args, {
    env: {PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', ...env},
    stdio: ['ignore', out, out],
    detached: group,
  });
  closeSync(out);
  children.push({name, proc, group});
  proc.once('exit', (code, signal) => {
    if (!stopping)
      {console.error(
        `e2e-sync: ${name} exited (${signal ?? code}); see ${join(RUN, `${name}.log`)}`,
      );}
  });
  return proc;
}

let stopping = false;
async function teardown() {
  stopping = true;
  for (const h of handles.splice(0)) {await h.stop().catch(() => {});}
  proxy?.close();
  await db?.end({timeout: 2}).catch(() => {});
  // The newest first: zero-cache, then the API, then Postgres (SIGINT is its fast shutdown).
  for (const {proc, group} of children.splice(0).reverse()) {
    if (
      proc.exitCode !== null ||
      proc.signalCode !== null ||
      proc.pid === undefined
    )
      {continue;}
    const gone = new Promise(r => proc.once('exit', r));
    const signal = proc === pg ? 'SIGINT' : 'SIGTERM';
    try {
      process.kill(group ? -proc.pid : proc.pid, signal);
    } catch {
      /* already gone */
    }
    await Promise.race([gone, sleep(10_000)]);
    if (proc.exitCode === null && proc.signalCode === null)
      {try {
        process.kill(group ? -proc.pid : proc.pid, 'SIGKILL');
      } catch {
        /* gone */
      }}
  }
  for (const f of ['pgdata', 'replica.db', 'replica.db-wal', 'replica.db-shm'])
    {rmSync(join(RUN, f), {recursive: true, force: true});}
}

// --- A socket proxy that can go offline ----------------------------------------------------------

type Proxy = {port: number; offline(): void; online(): void; close(): void};
async function makeProxy(target: number): Promise<Proxy> {
  const port = await freePorts(1);
  const live = new Set<net.Socket>();
  let up = true;
  const server = net.createServer(client => {
    if (!up) {
      client.destroy();
      return;
    }
    const upstream = net.connect(target, '127.0.0.1');
    live.add(client).add(upstream);
    const drop = () => {
      client.destroy();
      upstream.destroy();
      live.delete(client);
      live.delete(upstream);
    };
    client.on('error', drop).on('close', drop);
    upstream.on('error', drop).on('close', drop);
    client.pipe(upstream).pipe(client);
  });
  await new Promise<void>(r => server.listen(port, '127.0.0.1', r));
  return {
    port,
    offline() {
      up = false;
      for (const s of live) {s.destroy();}
    },
    online() {
      up = true;
    },
    close() {
      for (const s of live) {s.destroy();}
      server.close();
    },
  };
}

// --- The stack -----------------------------------------------------------------------------------

function pgBin(): string {
  if (process.env.PG_BIN) {return process.env.PG_BIN;}
  const base = '/usr/lib/postgresql';
  const versions = existsSync(base)
    ? readdirSync(base)
        .filter(v => /^\d+$/.test(v))
        .sort((a, b) => Number(b) - Number(a))
    : [];
  if (!versions[0])
    {throw new Failure(
      'no Postgres: install it (apt-get install postgresql) or set PG_BIN',
    );}
  return join(base, versions[0], 'bin');
}

let pg: ChildProcess | null = null;

async function startPostgres(): Promise<{url: string; sql: postgres.Sql}> {
  const bin = pgBin();
  const data = join(RUN, 'pgdata');
  const password = secret();
  const pwfile = join(RUN, 'pgpass');
  writeFileSync(pwfile, password, {mode: 0o600});
  const init = spawnSync(
    join(bin, 'initdb'),
    [
      '-D',
      data,
      '-U',
      'astryx',
      '--pwfile',
      pwfile,
      '--auth=scram-sha-256',
      '-E',
      'UTF8',
      '--no-instructions',
    ],
    {encoding: 'utf8'},
  );
  rmSync(pwfile);
  if (init.status !== 0) {throw new Failure(`initdb failed: ${init.stderr}`);}
  const port = await freePorts(1);
  const sock = join(RUN, 'sock');
  mkdirSync(sock, {recursive: true});
  pg = start(
    'postgres',
    join(bin, 'postgres'),
    [
      '-D',
      data,
      '-p',
      String(port),
      '-c',
      'listen_addresses=127.0.0.1',
      '-c',
      `unix_socket_directories=${sock}`,
      '-c',
      'wal_level=logical',
      '-c',
      'max_wal_senders=10',
      '-c',
      'max_replication_slots=10',
      '-c',
      'fsync=off',
    ],
    {},
  );
  const admin = `postgres://astryx:${encodeURIComponent(password)}@127.0.0.1:${port}`;
  await until('Postgres', async () => {
    const s = postgres(`${admin}/postgres`, {
      max: 1,
      connect_timeout: 2,
      onnotice: () => {},
    });
    try {
      await s`SELECT 1`;
      await s.unsafe('CREATE DATABASE astryx');
      return true;
    } catch {
      return false;
    } finally {
      await s.end();
    }
  });
  const url = `${admin}/astryx`;
  return {url, sql: postgres(url, {max: 2, onnotice: () => {}})};
}

async function healthy(url: string): Promise<unknown> {
  try {
    const r = await fetch(url);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

// --- Clients -------------------------------------------------------------------------------------

/** A core client as a host has it, with the rows it was given kept for checking. */
function core() {
  const real = createClient(
    () => ({epochMs: Date.now(), utcOffsetMinutes: 0}),
    {seed: 'e2e0'},
  );
  const tables = new Map<string, Row[]>();
  const savers = new Set<(m: readonly Mutation[], d: Doc) => void>();
  return {
    dispatch(a: Action) {
      real.dispatch(a); // the core takes the rows as it would in an app
      if (a.type === 'rows') {tables.set(a.table, a.rows as Row[]);}
    },
    onSave(l: (m: readonly Mutation[], d: Doc) => void) {
      savers.add(l);
      return () => savers.delete(l);
    },
    /** As if the core had saved these (a person acted). */
    save(...ms: Mutation[]) {
      for (const s of savers) {s(ms, readDoc({}));}
    },
    rows: (table: string) => tables.get(table) ?? null,
    row: (table: string, id: string) =>
      tables.get(table)?.find(r => r.id === id) ?? null,
  };
}

type Device = {
  core: ReturnType<typeof core>;
  sync: SyncHandle;
  statuses: SyncStatus[];
  firstSignIn: FirstSignIn | null;
  refused: string[];
};

function device(cacheURL: string, token: string, deviceDoc?: Doc): Device {
  const c = core();
  const d: Device = {
    core: c,
    sync: null as unknown as SyncHandle,
    statuses: [],
    firstSignIn: null,
    refused: [],
  };
  d.sync = startSync({
    client: c,
    cacheURL,
    auth: token,
    userID: readToken(token)!.sub,
    kvStore: 'mem',
    onStatus: s => d.statuses.push(s),
    ...(deviceDoc ? {deviceDoc} : {}),
    onFirstSignIn: r => (d.firstSignIn = r),
    onRefused: (name, message) => d.refused.push(`${name}: ${message}`),
    // Refusals are reported through onRefused; Zero's own log would repeat them with stacks.
    zeroOptions: {
      onUpdateNeeded: () => {},
      onClientStateNotFound: () => {},
      logSink: {log: () => {}},
    },
  });
  handles.push(d.sync);
  return d;
}

const synced = (d: Device) =>
  until(
    'synced',
    () => d.sync.status().state === 'synced' && d.sync.status().pending === 0,
  );
/** Sends one mutation through Zero and waits for the server's answer. */
async function serverResult(
  d: Device,
  name: string,
  args: unknown,
): Promise<{type: string; error?: {message: string}}> {
  return (
    d.sync.zero.mutate(mutation(name, args)) as {
      server: Promise<{type: string; error?: {message: string}}>;
    }
  ).server;
}

// --- The run -------------------------------------------------------------------------------------

async function main() {
  rmSync(RUN, {recursive: true, force: true});
  mkdirSync(RUN, {recursive: true});

  log('starting Postgres');
  const {url, sql} = await startPostgres();
  db = sql;
  const signingKey = newSigningKey();
  const keys = tokenKeys(signingKey);
  const zeroKey = secret();
  const apiPort = await freePorts(1);
  const api = `http://127.0.0.1:${apiPort}`;

  log('starting the API');
  start('api', process.execPath, [join(ROOT, 'server/src/main.ts')], {
    PORT: String(apiPort),
    DATABASE_URL: url,
    ZERO_API_KEY: zeroKey,
    TOKEN_SIGNING_KEY: signingKey,
    DEV_IDENTITY: 'dev@example.com',
    NODE_ENV: 'development',
  });
  const health = await until('the API', () => healthy(`${api}/healthz`));
  check(
    JSON.stringify(health) ===
      JSON.stringify({ok: true, sync: 'on', auth: 'dev'}),
    `/healthz says sync on, auth dev: ${JSON.stringify(health)}`,
  );
  const tables = await sql<
    {table_name: string}[]
  >`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1`;
  check(
    tables.length > 0,
    `the API made the tables at start: ${tables.map(t => t.table_name).join(', ')}`,
  );

  log('starting zero-cache');
  const cachePort = await freePorts(3);
  start(
    'zero-cache',
    join(ROOT, 'node_modules/.bin/zero-cache'),
    [],
    {
      ZERO_UPSTREAM_DB: url,
      ZERO_CVR_DB: url,
      ZERO_CHANGE_DB: url,
      ZERO_REPLICA_FILE: join(RUN, 'replica.db'),
      ZERO_PORT: String(cachePort),
      ZERO_QUERY_URL: `${api}/api/zero/query`,
      ZERO_MUTATE_URL: `${api}/api/zero/mutate`,
      ZERO_QUERY_API_KEY: zeroKey,
      ZERO_MUTATE_API_KEY: zeroKey,
      ZERO_ADMIN_PASSWORD: secret(),
      ZERO_ENABLE_CRUD_MUTATIONS: 'false',
      ZERO_NUM_SYNC_WORKERS: '1',
      ZERO_LOG_LEVEL: 'warn',
    },
    true,
  );
  const cache = `http://127.0.0.1:${cachePort}`;
  await until(
    'zero-cache',
    async () => {
      try {
        return (await fetch(`${cache}/keepalive`)).ok;
      } catch {
        return false;
      }
    },
    120_000,
  );
  log('stack up');

  // The API's own checks, called as zero-cache would (and as nothing else may).
  const now = Math.floor(Date.now() / 1000);
  const token = (sub: string, at = now) =>
    keys.sign({sub, email: `${sub}@example.com`}, at);
  const [tokA, tokB, tokC] = await Promise.all([
    token('user-a'),
    token('user-b'),
    token('user-c'),
  ]);
  const transform = (headers: Record<string, string>) =>
    fetch(`${api}/api/zero/query?schema=zero_0&appID=zero`, {
      method: 'POST',
      headers: {'content-type': 'application/json', ...headers},
      body: JSON.stringify([
        'transform',
        [{id: 'q1', name: 'kanban_card', args: []}],
      ]),
    });
  check(
    (await transform({authorization: `Bearer ${tokA}`})).status === 401,
    "/api/zero/query without zero-cache's key: 401",
  );
  check(
    (await transform({'x-api-key': 'wrong', authorization: `Bearer ${tokA}`}))
      .status === 401,
    '/api/zero/query with a wrong key: 401',
  );
  check(
    (await transform({'x-api-key': zeroKey})).status === 401,
    '/api/zero/query signed out (no token): 401, nothing read',
  );
  check(
    (
      await transform({
        'x-api-key': zeroKey,
        authorization: `Bearer ${await token('user-a', now - 7200)}`,
      })
    ).status === 401,
    '/api/zero/query with an expired token: 401',
  );
  const foreign = tokenKeys(newSigningKey());
  check(
    (
      await transform({
        'x-api-key': zeroKey,
        authorization: `Bearer ${await foreign.sign({sub: 'user-a', email: ''}, now)}`,
      })
    ).status === 401,
    '/api/zero/query with a token another key signed: 401',
  );
  const ast = JSON.stringify(
    await (
      await transform({'x-api-key': zeroKey, authorization: `Bearer ${tokA}`})
    ).json(),
  );
  check(
    ast.includes('"owner"') && ast.includes('"user-a"'),
    "/api/zero/query turns a table's query into owner = the token's subject",
  );

  const login = await fetch(
    `${api}/native/login?redirect=${encodeURIComponent('astryxswift://signed-in')}`,
    {redirect: 'manual'},
  );
  const location = login.headers.get('location') ?? '';
  const fragment = new URLSearchParams(location.split('#')[1] ?? '');
  const minted = await keys.verify(
    fragment.get('token') ?? '',
    Math.floor(Date.now() / 1000),
  );
  check(
    login.status === 302 &&
      location.startsWith('astryxswift://signed-in#token=') &&
      minted?.sub === 'dev:dev@example.com',
    "/native/login redirects to the app's scheme with a token in the fragment, for the signed-in identity",
  );
  const evil = await fetch(
    `${api}/native/login?redirect=${encodeURIComponent('https://attacker.example/')}`,
    {redirect: 'manual'},
  );
  check(
    evil.status === 400 && !evil.headers.get('location'),
    '/native/login refuses any other redirect',
  );

  // Staying signed in: the refresh token from sign-in, against the sessions kept in Postgres.
  const tokenRoute = (path: string, refresh: unknown) =>
    fetch(`${api}/api/token/${path}`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({refresh}),
    });
  const firstRefresh = fragment.get('refresh') ?? '';
  check(
    /^rt1\./.test(firstRefresh),
    '/native/login also hands out a refresh token',
  );
  const traded = await tokenRoute('refresh', firstRefresh);
  const pair = (await traded.json()) as {token?: string; refresh?: string};
  check(
    traded.status === 200 &&
      (await keys.verify(pair.token ?? '', Math.floor(Date.now() / 1000)))
        ?.sub === 'dev:dev@example.com' &&
      pair.refresh !== firstRefresh,
    'a refresh token is traded for a new access token and a new refresh token',
  );
  const sessionRows =
    await sql`SELECT count(*)::int AS n FROM astryx_auth.session`;
  const publicCopy =
    await sql`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'session'`;
  check(
    sessionRows[0]!.n >= 1 && publicCopy[0]!.n === 0,
    'sessions are kept outside the replicated schema',
  );
  check(
    (await tokenRoute('revoke', pair.refresh)).status === 204 &&
      (await tokenRoute('refresh', pair.refresh)).status === 401,
    'signing out ends the session: its refresh token is refused',
  );

  log('clients');
  const a = device(cache, tokA);
  const b = device(cache, tokA);
  const c = device(cache, tokC);
  await Promise.all([synced(a), synced(b), synced(c)]);
  ok('three clients synced (two as user-a, one as user-c)');

  // A change on one device reaches the other.
  const at = Date.now();
  a.core.save({
    name: 'kanban.place',
    args: {id: 'e2e-card', column: 'done', order: 'm', at},
  });
  const seen = await until('the change on client B', () =>
    b.core.row('kanban_card', 'e2e-card'),
  );
  check(
    seen.column === 'done' && !('owner' in seen),
    `a mutation on client A reaches client B's core: ${JSON.stringify(seen)}`,
  );
  const owners =
    await sql`SELECT owner, "column" FROM kanban_card WHERE id = 'e2e-card'`;
  check(
    owners.length === 1 && owners[0]!.owner === 'user-a',
    "in Postgres the row's owner is the signer (user-a)",
  );

  // Another user sees none of it, and their own write to the same id is theirs alone.
  await sleep(1000);
  check(
    !c.core.row('kanban_card', 'e2e-card'),
    "the other user (user-c) sees none of user-a's rows",
  );
  c.core.save({
    name: 'kanban.place',
    args: {id: 'e2e-card', column: 'todo', order: 'a', at},
  });
  await until(
    "user-c's own row",
    () => c.core.row('kanban_card', 'e2e-card')?.column === 'todo',
  );
  await synced(c);
  const both =
    await sql`SELECT owner, "column" FROM kanban_card WHERE id = 'e2e-card' ORDER BY owner`;
  check(
    both.length === 2 &&
      both[0]!.column === 'done' &&
      both[1]!.owner === 'user-c',
    "the same id written by user-c is a separate row; user-a's is untouched",
  );
  check(
    b.core.row('kanban_card', 'e2e-card')?.column === 'done',
    "user-a's devices never see user-c's write",
  );

  // A forged owner: refused as an argument, dropped from a seeded row.
  const forged = await serverResult(c, 'kanban.place', {
    id: 'e2e-card',
    column: 'in-review',
    order: 'b',
    at,
    owner: 'user-a',
  });
  check(
    forged.type === 'error',
    `a mutation naming an owner is refused by the server: ${forged.error?.message}`,
  );
  const seedForged = await serverResult(c, 'seed', {
    table: 'settings_value',
    rows: [{id: 'account.username', owner: 'user-a', value: 'forged'}],
  });
  const forgedRows =
    await sql`SELECT owner FROM settings_value WHERE id = 'account.username'`;
  check(
    seedForged.type === 'success' &&
      forgedRows.length === 1 &&
      forgedRows[0]!.owner === 'user-c',
    `an owner inside a seeded row is ignored: the row is the signer's (user-c): ${JSON.stringify({seed: seedForged, rows: forgedRows})}`,
  );
  check(
    (
      await sql`SELECT 1 FROM kanban_card WHERE owner = 'user-a' AND "column" = 'in-review'`
    ).length === 0,
    "user-a's rows are unchanged",
  );

  // A refused mutation writes nothing.
  const bad = await serverResult(a, 'kanban.place', {
    id: 'e2e-bad',
    column: 'no-such-column',
    order: 'm',
    at,
  });
  check(
    bad.type === 'error',
    `a mutation with bad arguments is refused: ${bad.error?.message}`,
  );
  check(
    (await sql`SELECT 1 FROM kanban_card WHERE id = 'e2e-bad'`).length === 0,
    'and nothing was written',
  );

  // Offline, then back: the change waits, then is sent.
  proxy = await makeProxy(cachePort);
  const d = device(`http://127.0.0.1:${proxy.port}`, tokA);
  await synced(d);
  proxy.offline();
  await until('client D offline', () => d.sync.status().state === 'offline');
  d.core.save({
    name: 'kanban.place',
    args: {id: 'e2e-offline', column: 'in-review', order: 'n', at: Date.now()},
  });
  await until('the change shown on D', () =>
    d.core.row('kanban_card', 'e2e-offline'),
  );
  check(
    d.sync.status().state === 'offline' && d.sync.status().pending === 1,
    `offline, the change shows at once on D and waits: ${JSON.stringify(d.sync.status())}`,
  );
  await sleep(1500);
  check(
    !b.core.row('kanban_card', 'e2e-offline') &&
      (await sql`SELECT 1 FROM kanban_card WHERE id = 'e2e-offline'`).length ===
        0,
    'nothing reached the server while D was offline',
  );
  proxy.online();
  await until(
    'the offline change on B',
    () => b.core.row('kanban_card', 'e2e-offline'),
    60_000,
  );
  await synced(d);
  check(
    true,
    'back online, D sends its change; B receives it and D is synced again',
  );

  // Seeding: a new account takes the device's work; an account with data keeps its own.
  const device1 = readDoc({
    kanban_card: {
      'e2e-new-1': {
        id: 'e2e-new-1',
        title: 'From the device',
        column: 'todo',
        order: 'c',
        priority: 'low',
        ref: 'N-1',
        createdAt: at,
        editedAt: at,
      },
    },
    settings_value: {
      'account.firstName': {id: 'account.firstName', value: 'Sam'},
    },
  });
  const e = device(cache, await token('user-e'), device1);
  await until("user-e's first sign-in", () => e.firstSignIn);
  check(
    JSON.stringify(e.firstSignIn) ===
      JSON.stringify({
        seeded: TABLES.filter(
          t => t === 'kanban_card' || t === 'settings_value',
        ),
        kept: [],
      }),
    `a new account is seeded from the device: ${JSON.stringify(e.firstSignIn)}`,
  );
  check(
    (
      await sql`SELECT 1 FROM kanban_card WHERE owner = 'user-e' AND id = 'e2e-new-1' AND title = 'From the device'`
    ).length === 1,
    "the device's rows are the account's rows in Postgres",
  );
  const f = device(cache, tokA, device1);
  await until("user-a's sign-in on a device with work", () => f.firstSignIn);
  check(
    JSON.stringify(f.firstSignIn) ===
      JSON.stringify({seeded: ['settings_value'], kept: ['kanban_card']}),
    `an account with cards keeps its own; its empty settings take the device's: ${JSON.stringify(f.firstSignIn)}`,
  );
  check(
    !f.core.row('kanban_card', 'e2e-new-1') &&
      f.core.row('kanban_card', 'e2e-card')?.column === 'done',
    "the core shows the account's cards, not the device's",
  );
  const reseed = await serverResult(a, 'seed', {
    table: 'kanban_card',
    rows: [{id: 'e2e-reseed', title: 'late'}],
  });
  check(
    reseed.type === 'error',
    `seed is refused when the account already has rows: ${reseed.error?.message}`,
  );
  check(
    (await sql`SELECT 1 FROM kanban_card WHERE id = 'e2e-reseed'`).length === 0,
    'and wrote nothing',
  );

  // A token the server refuses: the status says signed out until a new token comes.
  const g = device(cache, await token('user-b', now - 7200));
  await until(
    'signed out by the server',
    () => g.sync.status().state === 'signed-out',
  );
  ok(`an expired token shows "signed-out": ${JSON.stringify(g.sync.status())}`);
  await g.sync.setAuth(tokB);
  await synced(g);
  ok('a new token signs it back in, and it syncs');

  check(
    a.refused.length === 0 && b.refused.length === 0 && d.refused.length === 0,
    "nothing user-a's devices sent through the core was refused",
  );
}

let code = 0;
const interrupted = () => {
  void teardown().then(() => process.exit(130));
};
process.once('SIGINT', interrupted).once('SIGTERM', interrupted);
try {
  await main();
  log(`all ${passed} checks passed`);
} catch (e) {
  code = 1;
  console.error(
    `e2e-sync: FAIL ${e instanceof Failure ? e.message : (e as Error).stack}`,
  );
  console.error(`e2e-sync: logs in ${RUN}`);
} finally {
  await teardown();
}
process.exit(code);
