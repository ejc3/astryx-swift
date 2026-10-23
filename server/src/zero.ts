/**
 * What zero-cache calls (ZERO_QUERY_URL, ZERO_MUTATE_URL): /api/zero/query turns a named query
 * into the query this person may run, and /api/zero/mutate runs mutators in a Postgres
 * transaction. Two checks, both required:
 *
 * - zero-cache's own key (`X-Api-Key`, ZERO_QUERY_API_KEY / ZERO_MUTATE_API_KEY on zero-cache,
 *   ZERO_API_KEY here), compared in constant time: nothing but zero-cache may call these.
 * - the person's token, which zero-cache forwards from the client as `Authorization: Bearer`:
 *   `ctx.userID` is its subject. A missing, expired or foreign token is a 401, which Zero's client
 *   shows as signed out (`needs-auth`) until it is given a new token.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { mutators, queries, schema } from "@astryx-native/sync";
import { mustGetMutator, mustGetQuery } from "@rocicorp/zero";
import { handleMutateRequest, handleQueryRequest } from "@rocicorp/zero/server";
import type { Identity, TokenKeys } from "./tokens.ts";

export type ZeroDeps = {
  /** The key zero-cache sends as X-Api-Key. */
  apiKey: string;
  /** Zero's Postgres provider (zeroPostgresJS(schema, url)). */
  dbProvider: unknown;
};

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Whether `given` is `expected`, in time that does not depend on where they differ (or their lengths). */
export function sameSecret(given: string | null | undefined, expected: string): boolean {
  if (!given || !expected) return false;
  return timingSafeEqual(digest(given), digest(expected));
}

export const keyOk = (req: Request, deps: ZeroDeps): boolean => sameSecret(req.headers.get("x-api-key"), deps.apiKey);

/** The person a request's bearer token names, or null. */
export async function bearer(req: Request, keys: TokenKeys, nowSeconds: number): Promise<Identity | null> {
  const m = /^Bearer ([^\s]+)$/.exec(req.headers.get("authorization") ?? "");
  return m ? keys.verify(m[1]!, nowSeconds) : null;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- Zero's registry types are erased at this boundary */
export function zeroQuery(req: Request, who: Identity) {
  const ctx = { userID: who.sub };
  return handleQueryRequest({
    handler: (name: string, args: any) => (mustGetQuery(queries, name) as any).fn({ args, ctx }),
    schema,
    request: req,
    userID: who.sub,
  });
}

export function zeroMutate(req: Request, who: Identity, deps: ZeroDeps) {
  const ctx = { userID: who.sub };
  return handleMutateRequest({
    dbProvider: deps.dbProvider as any,
    handler: (transact: any) => transact((tx: any, name: string, args: any) => (mustGetMutator(mutators, name) as any).fn({ args, tx, ctx })),
    request: req,
    userID: who.sub,
  });
}
/* eslint-enable @typescript-eslint/no-explicit-any */
