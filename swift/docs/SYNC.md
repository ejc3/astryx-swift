# Saved work, sign-in and sync

What a person changes in the app stays changed: after a relaunch, and, when they are signed in,
on their other devices. Sign-in is optional. Signed out, everything works and is kept on the
device; signed in, the same data syncs through [Zero](https://zero.rocicorp.dev) to every device
signed in to that account.

This document is the design. It says what is saved, where the rules live, how a change travels,
how sign-in works, and what runs where.

## What is saved

Only what a person made or changed is saved. Sample data stays sample data, and view state (which
row is selected, which menu or dialog is open, a search being typed, a checkout step, a scroll
position) stays on the device and is never synced. Secrets are never saved: card numbers, CVCs and
passwords live only in the screen that asked for them.

| Screen                                       | Saved and synced                                                                                                                                                                        | Controls that start working                                             |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Kanban template                              | each card's column and place in it; new cards (title, column, priority); who a card is assigned to                                                                                      | Add task, Assign to me, drag and Move to                                |
| Settings template                            | username, first and last name, email; data export, admin members, two-factor                                                                                                            | each section's Save (web); edits apply as made on Apple platforms (HIG) |
| Inbox template                               | read state, archived and deleted threads, sent replies and new messages                                                                                                                 | Archive, Delete, Move to folder, Send                                   |
| Chat template                                | messages the person sends                                                                                                                                                               | Send                                                                    |
| Checkout template                            | the cart (quantities, promo code, delivery choice), the shipping address, and each completed order                                                                                      | Place order makes an order record                                       |
| Order template                               | notes, fulfilment state, likes and replies on the timeline                                                                                                                              | Fulfill item, Like, Reply, Notes                                        |
| Demo screens                                 | inbox read, starred and archived; task columns; sent chat lines; following; profile settings (name, email, bio, notifications, digest, density, reduce motion, theme); cart and address | as today, now kept                                                      |
| Dashboard, invoice, calendar, theme showcase | nothing: they are reports and galleries over sample data                                                                                                                                | none                                                                    |

A person's first view is the sample data, exactly as now. What is drawn is the sample rows with
the person's saved rows laid over them by id: a saved row replaces the sample row with its id, a
deleted sample row is saved as deleted, and new rows are added. Sample rows a person never touched
are never written anywhere.

## Where the rules live

The core stays pure: no Zero, no network, no storage, no clock. Three parts:

1. **Saved data in the core.** Each template's state splits into its saved part (`doc`: plain rows
   in named tables, keyed by id) and its view part, which stays where it is. `view(state, doc, now)`
   draws both. The core holds one `Doc` for all templates.
2. **Mutations, defined once.** Every change to saved data is a named mutation with checked
   arguments (`kanban.move {id, column, order, at}`, `settings.set {field, value}`,
   `inbox.archive {id}`, ...), in `core/src/sync/mutations.ts`. Each one is a pure function from
   its arguments to row writes (insert, patch, delete), with no reads, so the same function runs in
   the core, in Zero's client and on the server and cannot give different answers. A template's
   `reduce` returns its new view state and the mutations to perform; it never edits `doc` itself.
3. **Applying them.** The core applies each mutation to its own `Doc` at once (so the screen moves
   on the same frame), and hands it to the host's sync layer, which persists it:
   - signed out: the core's `Doc` is written to the device after each change;
   - signed in: the sync layer calls the matching Zero mutator, which writes the same rows into
     Zero's local store and sends them to the server. Zero's live queries feed the rows back into
     the core (`{type: "rows", table, rows}`); they replace that table in `Doc`.

Ids for new records are minted by the core from a seed the host gives it (`<seed>-<n>`, as in
constellation's Lattice), so the core stays deterministic. Times are epoch milliseconds from
`now`, never relative ("2 h ago" is worked out when drawn, not stored). Card order is a fractional
key between its neighbours, so two devices moving different cards never rewrite each other's rows.
Conflicts are per field: the last committed write to a field wins.

## The sync layer

A small TypeScript package beside the core (`sync/`), the only code that imports `@rocicorp/zero`:

- `schema.ts`: the Zero tables, made from the core's `SCHEMA` (one per saved table, each with
  `owner`, keyed by `(owner, id)`, every other column optional), shared by client and server; and
  the Postgres tables (`SQL`, and `migration`, which the API runs at start: only what is missing).
  Columns are snake_case in Postgres; a core `number` is `double precision`, `json` is `jsonb`.
- `mutators.ts`: one Zero mutator per core mutation, by the same name, made from `MUTATIONS`: the
  core's `writesOf` checks the arguments (refused: nothing is written), and each write is an
  upsert of the given fields as `ctx.userID`, the token's subject (never a value from the client).
  Plus `seed {table, rows}`: a device's signed-out rows for one table (at most 2000), checked as
  the core reads a stored doc (unknown fields, an `owner` included, are dropped), taken only while
  the account has no rows in that table (checked in the transaction, under a per-owner lock).
- `queries.ts`: one named query per table, by the table's name, `where owner = ctx.userID`. A
  signed-out caller gets nothing.
- `client.ts`: `startSync({client, cacheURL, auth, userID, kvStore, onStatus})` starts Zero for a
  signed-in user, subscribes to every table's query and dispatches `{type: "rows"}` into the core
  (without `owner`), forwards each mutation from `client.onSave` to its mutator, and reports a
  status: connecting, synced, pending (changes waiting), offline, or signed-out (the server refused
  the token). On a sign-in it also takes the device's doc and seeds (below). No DOM, React Native
  or Node APIs: the host passes Zero's store. Signed out, the host reads and writes the device copy
  instead and does not start sync.

It runs where the core runs:

- **iPhone, iPad and Mac:** in the app's Hermes runtime, next to the core. Hermes has React
  Native's networking, so Zero's WebSocket works there; Zero's local store is SQLite through
  `op-sqlite` (Zero's own provider). The web panes in the app draw the same core and need nothing
  of their own.
- **The standalone web page** (the "web, own core" drawing): in the page, with Zero's IndexedDB
  store, and `localStorage` for the signed-out copy.

## Signing in, and signing out

Sign-in is through Cloudflare Access, as in constellation (its docs/AUTH.md): Access does the
signing in (email one-time PIN, Google, GitHub), and nothing here stores a password.

- **Apple apps:** "Sign in" opens `https://<sync host>/native/login` in
  `ASWebAuthenticationSession`. That path is behind Access; after the Access sign-in the API
  redirects to `astryxswift://signed-in#token=...` (the token in the fragment, so it is never in a
  request line or a log) with a token it signed: an Ed25519 JWT whose subject is Access's stable
  `sub`, valid for one hour, and with it a refresh token. The API redirects only to the app's own
  address (an allow-list), never to one a request names. Both are kept in the Keychain; the token
  is given to Zero as `auth`, and `readToken(token).sub` is Zero's `userID`.
- **Staying signed in:** a sign-in lasts until the person signs out (`server/src/sessions.ts`).
  Shortly before the token expires, and when the app comes back with it run out, the app trades
  the refresh token at `/api/token/refresh` for a new token and a new refresh token, with no
  browser and no prompt. Refresh tokens are random, stored only as a hash, rotated on every use,
  and kept outside the schema zero-cache replicates. A replaced refresh token still works for two
  minutes (an answer lost on the way); presented later, it means someone holds a copy, and the
  session is ended. Signing out ends the session on the server (`/api/token/revoke`).
- **Web page:** the same flow in a pop-up window (`/native/login?redirect=web`), which hands the
  token and refresh token to the page by `postMessage` addressed to the site's own origin
  (`WEB_ORIGIN`) only; the page keeps them in `localStorage` and renews the same way.
- **The API** checks the token on `/api/zero/query` and `/api/zero/mutate` (zero-cache forwards it
  as `Authorization: Bearer`), and zero-cache's own API key (`X-Api-Key`, compared in constant
  time). A missing or expired token is a 401, which Zero shows as signed out until the app gives
  it a new token. `DEV_IDENTITY` stands in for Access in local development only; the API refuses
  to start with it when `NODE_ENV=production`.

**Signing in with work on the device.** If the account has no saved data yet, what was done
signed out is uploaded to it (one mutation per table, `seed`). If the account already has data,
the account's data is shown and the device's signed-out copy is kept untouched for when the person
signs out again. This is decided per table, once that table's rows have come from the server;
changes made in that moment wait until it is decided. The app says which happened
(`onFirstSignIn: {seeded, kept}`). A relaunch while signed in does not pass the device copy.

**Signing out** stops sync, removes the token, and shows the signed-out copy again. Zero keeps each
user's local store separately (by `userID`), so signing back in starts from what was already on the
device.

**Offline:** Zero keeps changes made offline and sends them when the connection comes back. A
"Not synced" status shows while changes are waiting.

## What runs where

| Piece                                | Runs                                                                                                                     | Notes                                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Postgres 17                          | Amazon RDS (`db.t4g.micro`), `rds.logical_replication = 1`                                                               | the source of truth; zero-cache replicates it                                                                |
| zero-cache                           | Fargate, image `rocicorp/zero` (pinned), with a small disk for its replica                                               | long-running; never a Worker                                                                                 |
| API                                  | Fargate, same task: Node, Hono, `/native/login`, `/api/zero/query`, `/api/zero/mutate`, `/healthz` (`server/Dockerfile`) | `/healthz` says whether sync is on (`DATABASE_URL` and `ZERO_API_KEY` set)                                   |
| Cloudflare connector                 | Fargate, same task                                                                                                       | nothing listens on a public address                                                                          |
| Hostname, tunnel, Access application | Cloudflare                                                                                                               | `/native/login` behind Access; `/api/zero/*` and the zero-cache socket bypass Access and check the API token |

It lives in its own AWS account, made by `ejc3/aws`, with its own Terraform repository
(`ejc3/astryx-infra`): the RDS instance, the task, secrets (in Secrets Manager, read when used),
image registry and a budget alarm. Staging starts at zero tasks, so it costs only the database
until it is turned on.

## How it is proved

- **Core:** each mutation's rows, the doc split for every saved template, id minting, fractional
  order, and the rule that `reduce` never edits `doc`. Parity for the ten templates stays 1216 of
  1216: the first view is unchanged, and the harness loads the page with the new behaviours off
  (`?stock=1`), so a step that presses a control stock leaves inert (the chat's Send) still
  compares like with like. The new behaviours are covered by their own scenarios, replayed on the
  web and natively.
- **Sync and the API, unit tests** (`pnpm --filter ./sync test`, `pnpm --filter ./server test`): the Zero schema and
  SQL match `SCHEMA`; a mutator exists for every mutation and writes as the signer; refused
  arguments write nothing; `seed`'s checks and its refusal on a table with rows; the status; the
  token (expiry, another key, issuer, audience); Access JWTs (team keys, audience, service tokens);
  `/native/login`'s allow-list and the web pop-up's target origin; the API key and bearer checks;
  the refusal to start with `DEV_IDENTITY` in production.
- **Sync, end to end, locally:** `pnpm --filter ./sync e2e` (`sync/scripts/e2e-sync.ts`) makes a private
  Postgres (`initdb` into `.scratch/e2e-sync`, `wal_level=logical`, 127.0.0.1 only, a free port in
  45000-46000; Postgres from `PG_BIN` or `/usr/lib/postgresql/<n>/bin`), starts the API with
  `DEV_IDENTITY` and zero-cache from the installed `@rocicorp/zero` (fresh secrets for the run, in
  the processes' environment only), runs Zero clients through `startSync` (memory store, tokens
  signed with the run's key), and stops what it started, by pid. It proves: the API's key and token
  checks (a signed-out caller reads nothing) and `/native/login`'s redirect; a change on one device
  reaches another device of the same account; another account sees none of it, and its write to
  the same id is its own row; an `owner` in the arguments is refused, and one in a seeded row is
  ignored (the row is the signer's); a refused mutation writes nothing; an offline change shows at
  once, waits as pending, and is sent on reconnect; a new account is seeded from the device, an
  account with data keeps it, and `seed` is refused once a table has rows; an expired token shows
  signed-out until a new one is given.
- **Apple:** the Hermes bundle starts Zero against the local stack in the simulator; sign-in is
  checked by hand against staging, then on TestFlight on two devices.

## Order of work

1. This document.
2. Core: `Doc`, mutations, ids and order keys; templates and demo screens read saved data from
   `Doc`; the new working controls; signed-out persistence on every host.
3. `sync/` and the API, with the local end-to-end test.
4. Apple: Zero in Hermes (op-sqlite), sign-in, Keychain, the sync status.
5. `ejc3/astryx-infra` (Terraform) and the `ejc3/aws` pull request that makes the account,
   hostname, tunnel and Access application; then staging, and a TestFlight build with sign-in.
