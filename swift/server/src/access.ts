/**
 * Who is signing in, on /native/login (docs/SYNC.md, "Signing in"). That path sits behind a
 * Cloudflare Access application, which does the signing in (one-time PIN, Google, GitHub) and
 * forwards a JWT it signed in `Cf-Access-Jwt-Assertion`. This checks it against the team's keys
 * and the application's audience tag, and takes Access's stable `sub` (and the email, for
 * display). A service token (no person) is refused.
 *
 * Locally, DEV_IDENTITY (an email) stands in for Access; the server refuses to start with it in
 * production.
 */
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { Identity } from "./tokens.ts";

export type Authenticate = (req: Request) => Promise<Identity | null>;
export type AuthKind = "access" | "dev" | "none";

/** `https://<team>.cloudflareaccess.com`, from a bare host or a URL, without a trailing slash. */
export const teamOrigin = (domain: string): string => (/^https?:\/\//.test(domain) ? domain : `https://${domain}`).replace(/\/+$/, "");

export function accessAuth(teamDomain: string, audience: string, keys: JWTVerifyGetKey = createRemoteJWKSet(new URL(`${teamOrigin(teamDomain)}/cdn-cgi/access/certs`))): Authenticate {
  const issuer = teamOrigin(teamDomain);
  return async (req) => {
    const token = req.headers.get("cf-access-jwt-assertion");
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, keys, { issuer, audience, algorithms: ["RS256"], requiredClaims: ["sub", "exp"] });
      if (typeof payload.sub !== "string" || payload.sub === "" || typeof payload.email !== "string") return null;
      return { sub: payload.sub, email: payload.email.toLowerCase() };
    } catch {
      return null;
    }
  };
}

/** Development only: everyone is DEV_IDENTITY. */
export function devAuth(email: string): Authenticate {
  const who = { sub: `dev:${email.toLowerCase()}`, email: email.toLowerCase() };
  return async () => who;
}

export const noAuth: Authenticate = async () => null;

export type AuthEnv = { ACCESS_TEAM_DOMAIN?: string | undefined; ACCESS_AUD?: string | undefined; DEV_IDENTITY?: string | undefined; NODE_ENV?: string | undefined };

/** Access when it is configured; DEV_IDENTITY otherwise, never in production; else nobody can sign in. */
export function chooseAuth(env: AuthEnv): { auth: Authenticate; kind: AuthKind } {
  if (env.DEV_IDENTITY && env.NODE_ENV === "production") throw new Error("DEV_IDENTITY is refused in production (NODE_ENV=production)");
  if (env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD) return { auth: accessAuth(env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD), kind: "access" };
  if (env.DEV_IDENTITY) return { auth: devAuth(env.DEV_IDENTITY), kind: "dev" };
  return { auth: noAuth, kind: "none" };
}
