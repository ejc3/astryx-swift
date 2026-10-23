/**
 * The API's own sign-in token (docs/SYNC.md, "Signing in"): an Ed25519 JWT the API signs after
 * Cloudflare Access has signed the person in, for clients that cannot carry the Access cookie (the
 * Apple apps, and Zero's socket from the web page). One hour; the app renews it by repeating the
 * sign-in silently while the Access session lasts. zero-cache forwards it to /api/zero/* as
 * `Authorization: Bearer`, where it is checked here.
 *
 * The signing key is TOKEN_SIGNING_KEY: an Ed25519 private key, PKCS8 DER, base64
 * (`npm run key -w server` makes one for local use).
 */
import { createPrivateKey, createPublicKey, generateKeyPairSync, type KeyObject } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

export const TOKEN_ISSUER = "astryx-swift-api";
export const TOKEN_AUDIENCE = "astryx-swift-sync";
export const TOKEN_SECONDS = 3600;

/** A signed-in person: Access's stable subject, and the email for display. */
export type Identity = { sub: string; email: string };

export type TokenKeys = {
  sign(who: Identity, nowSeconds: number): Promise<string>;
  /** The identity in a token this API signed and that has not expired; null for anything else. */
  verify(token: string, nowSeconds: number): Promise<Identity | null>;
};

/** A new signing key, as TOKEN_SIGNING_KEY holds it. */
export function newSigningKey(): string {
  const { privateKey } = generateKeyPairSync("ed25519");
  return privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
}

export function tokenKeys(pkcs8Base64: string): TokenKeys {
  let signing: KeyObject;
  try {
    signing = createPrivateKey({ key: Buffer.from(pkcs8Base64.trim(), "base64"), format: "der", type: "pkcs8" });
  } catch {
    throw new Error("TOKEN_SIGNING_KEY is not a PKCS8 key in base64");
  }
  if (signing.asymmetricKeyType !== "ed25519") throw new Error("TOKEN_SIGNING_KEY is not an Ed25519 key");
  const verifying = createPublicKey(signing);
  return {
    async sign(who, now) {
      return new SignJWT({ email: who.email })
        .setProtectedHeader({ alg: "EdDSA", typ: "JWT" })
        .setSubject(who.sub)
        .setIssuer(TOKEN_ISSUER)
        .setAudience(TOKEN_AUDIENCE)
        .setIssuedAt(now)
        .setExpirationTime(now + TOKEN_SECONDS)
        .sign(signing);
    },
    async verify(token, now) {
      try {
        const { payload } = await jwtVerify(token, verifying, {
          algorithms: ["EdDSA"],
          issuer: TOKEN_ISSUER,
          audience: TOKEN_AUDIENCE,
          requiredClaims: ["sub", "exp"],
          currentDate: new Date(now * 1000),
        });
        if (typeof payload.sub !== "string" || payload.sub === "") return null;
        return { sub: payload.sub, email: typeof payload.email === "string" ? payload.email : "" };
      } catch {
        return null;
      }
    },
  };
}
