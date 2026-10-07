import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Les trois locales doivent exposer exactement les mêmes clés.
 * Une clé manquante fait planter le rendu (next-intl) ou affiche
 * silencieusement l'ID de clé ; les deux sont des régressions.
 */

const LOCALES = ["fr", "en", "ar"] as const;
type Locale = (typeof LOCALES)[number];

const MESSAGES_DIR = path.join(__dirname, "..", "messages");

const messages = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    JSON.parse(
      readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), "utf8")
    ) as Record<string, unknown>,
  ])
) as Record<Locale, Record<string, unknown>>;

function flatten(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key)
  );
}

const frKeys = flatten(messages.fr).sort();

describe("i18n — parité des locales", () => {
  it("chaque locale contient au moins une clé", () => {
    for (const locale of LOCALES) {
      expect(flatten(messages[locale]).length).toBeGreaterThan(100);
    }
  });

  it("le nombre de clés est identique dans les trois locales", () => {
    const counts = LOCALES.map(
      (locale) => `${locale}=${flatten(messages[locale]).length}`
    );
    expect(counts.join(" ")).toBe(
      LOCALES.map((locale) => `${locale}=${frKeys.length}`).join(" ")
    );
  });

  it.each(LOCALES.filter((l) => l !== "fr"))(
    "%s ne définit aucune clé absente de fr",
    (locale) => {
      const other = new Set(flatten(messages[locale as Locale]));
      const missing = frKeys.filter((key) => !other.has(key));
      expect(missing, `clés absentes en ${locale}`).toEqual([]);
    }
  );

  it.each(LOCALES.filter((l) => l !== "fr"))(
    "%s ne définit aucune clé inconnue de fr",
    (locale) => {
      const other = flatten(messages[locale as Locale]);
      const extra = other.filter((key) => !frKeys.includes(key));
      expect(extra, `clés en trop en ${locale}`).toEqual([]);
    }
  );

  it("aucune valeur n'est vide", () => {
    const empty: string[] = [];
    for (const locale of LOCALES) {
      const walk = (value: unknown, prefix: string) => {
        if (typeof value === "string") {
          if (value.trim() === "") empty.push(`${locale}:${prefix}`);
          return;
        }
        if (value && typeof value === "object") {
          for (const [key, child] of Object.entries(value)) {
            walk(child, `${prefix}.${key}`);
          }
        }
      };
      walk(messages[locale], "");
    }
    expect(empty).toEqual([]);
  });

  it("les valeurs arabes ne contiennent pas de texte français résiduel", () => {
    // Garde-fou contre une chaîne française oubliée lors d'une copie.
    // Les expressions ICU ({count}, {name, plural, ...}) et les noms
    // propres / marques sont exclus : ils ne sont pas traduisibles.
    const ALLOWED = new Set([
      "Sales",
      "Insight",
      "MediPay",
      "Maroc",
      "Atlass",
      "Logistique",
      "PortTech",
      "Tanger",
      "RGPD",
      "GROW",
      "entreprise",
      "contact",
      // Catégories de pluriel ICU, résolues à l'exécution.
      "zero",
      "one",
      "two",
      "few",
      "many",
      "other",
      // Balises ICU rendues via t.rich() (jamais du dangerouslySetInnerHTML).
      "strong",
      "em",
      "b",
      "i",
      "br",
      "link",
      // Termes de conformité RGPD, volontairement laissés en anglais.
      "opt",
      "out",
      "not",
      "call",
    ]);

    const suspicious: string[] = [];
    const walk = (value: unknown, prefix: string) => {
      if (typeof value === "string") {
        // On retire d'abord les placeholders ICU puis les URL/email.
        const stripped = value
          .replace(/\{[^}]*\}/g, " ")
          .replace(/\S+@\S+/g, " ")
          .replace(/https?:\/\/\S+/g, " ");
        const found = (stripped.match(/[A-Za-zÀ-ÿ]{3,}/g) ?? []).filter((word) => {
          if (ALLOWED.has(word)) return false;
          // Les sigles techniques (CSV, API, RSS, CTO, SLA...) sont
          // volontairement conservés en langeret dans toutes les locales.
          return !/^[A-Z0-9]{2,}$/.test(word);
        });
        if (found.length > 0) suspicious.push(`${prefix} -> ${found.join(", ")}`);
        return;
      }
      if (value && typeof value === "object") {
        for (const [key, child] of Object.entries(value)) {
          walk(child, `${prefix}.${key}`);
        }
      }
    };

    walk(messages.ar, "");
    expect(suspicious).toEqual([]);
  });
});