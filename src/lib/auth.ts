import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization, twoFactor } from "better-auth/plugins";
import {
  adminAc,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";
import { getPrisma } from "./prisma";

/**
 * Origines autorisées pour les requêtes cross-origin.
 * En local on garde `localhost` par défaut, sinon on dérive de l'URL publique
 * afin que les vérifications CSRF de better-auth restent valides en production.
 */
function buildTrustedOrigins(): string[] {
  const configured = [
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  const origins = new Set<string>([
    ...configured,
    "http://localhost:3000",
  ]);

  for (const value of configured) {
    try {
      const url = new URL(value);
      // Autorise aussi les sous-domaines wildcard style https://*.sales-insight.ma
      origins.add(`https://*.${url.hostname.replace(/^www\./, "")}`);
    } catch {
      // URL invalide dans l'environnement : on l'ignore, BETTER_AUTH_URL
      // triggers déjà une erreur explicite plus bas si elle est absente.
    }
  }

  return [...origins];
}

function createAuthInstance() {
  const baseURL =
    process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL;

  if (!baseURL) {
    throw new Error(
      "BETTER_AUTH_URL or NEXT_PUBLIC_APP_URL must be defined (see .env.example)."
    );
  }

  return betterAuth({
    database: prismaAdapter(getPrisma(), { provider: "postgresql" }),
    baseURL,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: {
        // 5 min : évite un aller-retour base à chaque requête tout en
        // révoquant rapidement une session après changement de mot de passe.
        enabled: true,
        maxAge: 60 * 5,
      },
    },
    // Limitation de débit : sans cela, /api/auth/* est ouvert au brute-force.
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      customRules: {
        // Les endpoints sensibles ont leur propre budget, plus strict.
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 3 },
        "/forget-password": { window: 60, max: 3 },
        "/reset-password": { window: 60, max: 5 },
        "/two-factor/verify-totp": { window: 60, max: 5 },
      },
    },
    advanced: {
      //Cookies de session : httpOnly + sameSite lax + secure en production.
      // (better-auth applique ces drapeaux par défaut, on les explicite car
      // la configuration de déploiement est variable.)
      useSecureCookies: process.env.NODE_ENV === "production",
    },
    trustedOrigins: buildTrustedOrigins(),
    plugins: [
      organization({
        // better-auth cherche par défaut un modèle Prisma nommé `member`,
        // mais notre schéma l'appelle `OrganizationMembership`.
        schema: {
          member: { modelName: "OrganizationMembership" },
        },
        // better-auth écrit "owner" en minuscules par défaut alors que notre
        // enum OrgRole est en majuscules : on aligne le rôle du créateur et
        // les rôles reconnus pour que la création et les vérifications de
        // permission internes restent cohérentes avec notre schéma.
        creatorRole: "OWNER",
        roles: {
          OWNER: ownerAc,
          ADMIN: adminAc,
          MEMBER: memberAc,
          VIEWER: memberAc,
        },
      }),
      twoFactor({ issuer: "Sales Insight" }),
    ],
  });
}

type AuthInstance = ReturnType<typeof createAuthInstance>;

let cachedAuth: AuthInstance | undefined;

/**
 * Instance better-auth initialisée à la première utilisation, pas à
 * l'import : `next build` collecte les routes sans variables
 * d'environnement, et un throw au chargement du module ferait échouer
 * le build (ainsi que tout `clone → build` sans `.env`). Sans config,
 * l'erreur survient à la première requête — la route `[...all]`
 * la convertit en 503 « Auth service not configured ».
 */
function getAuth(): AuthInstance {
  cachedAuth ??= createAuthInstance();
  return cachedAuth;
}

export const auth: AuthInstance = new Proxy({} as AuthInstance, {
  get(_target, property) {
    return Reflect.get(getAuth(), property);
  },
});

export type Session = AuthInstance["$Infer"]["Session"];
