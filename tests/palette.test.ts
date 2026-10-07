import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Accessibilité de la palette de marque.
 *
 * Ce test lit les vraies valeurs déclarées dans src/app/globals.css : il ne
 * peut donc pas passer si quelqu'un modifie une couleur sans vérifier le
 * contraste. Toute régression WCAG AA échoue la CI.
 */

const globalsCss = readFileSync(
  path.join(__dirname, "..", "src", "app", "globals.css"),
  "utf8"
);

/** Extrait la valeur d'une variable déclarée dans le bloc `:root`. */
function token(name: string): string {
  const rootBlock = globalsCss.slice(globalsCss.indexOf(":root"));
  const match = rootBlock.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`Token --${name} introuvable dans :root`);
  return match[1];
}

/** Résout les alias `var(--x)` jusqu'à une couleur hexadécimale. */
function resolve(name: string, depth = 0): string {
  if (depth > 10) throw new Error(`Alias circulaire sur --${name}`);
  const raw = token(name);
  const alias = raw.match(/var\(--([a-z-]+)\)/);
  return alias ? resolve(alias[1], depth + 1) : raw;
}

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
  );
}

/** Rapport de contraste WCAG entre deux couleurs (1 → 21). */
function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)];
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** Texte normal : 4.5:1 minimum (WCAG 2.2 AA, 1.4.3). */
const AA_TEXT = 4.5;
/** Élément d'interface et bordure de champ : 3:1 minimum (WCAG 1.4.11). */
const AA_NON_TEXT = 3;

const TEXT_PAIRS: Array<[string, string, string]> = [
  ["foreground", "background", "texte courant sur le fond de page"],
  ["foreground", "surface", "texte courant sur une carte"],
  ["foreground", "surface-elevated", "texte courant sur une surface surélevée"],
  ["foreground", "surface-warm", "texte courant sur un bandeau alterné"],
  ["text-secondary", "background", "texte secondaire sur le fond"],
  ["text-secondary", "surface", "texte secondaire sur une carte"],
  ["text-secondary", "surface-elevated", "texte secondaire surélevé"],
  ["text-muted", "background", "légende / placeholder sur le fond"],
  ["text-muted", "surface", "légende / placeholder sur une carte"],
  ["text-muted", "surface-elevated", "légende sur surface surélevée"],
  ["text-muted", "brand-soft", "légende sur carte brand-soft (badge Intent)"],
  ["text-secondary", "brand-soft", "texte secondaire sur brand-soft"],
  ["foreground", "brand-soft", "texte courant sur brand-soft"],
  ["lead-excellent", "surface", "badge lead HOT"],
  ["lead-medium", "surface", "badge lead WARM"],
  ["lead-low", "surface", "badge lead COLD"],
  ["teal", "surface", "accent sarcelle sur carte"],
  ["teal", "background", "accent sarcelle sur le fond"],
  ["brand-strong", "surface", "lien de marque sur une carte"],
  ["brand-strong", "background", "lien de marque sur le fond"],
];

const NON_TEXT_PAIRS: Array<[string, string, string]> = [
  ["border-default", "background", "bordure de champ sur le fond"],
  ["border-default", "surface", "bordure de champ sur une carte"],
  ["brand", "background", "bouton / élément de marque sur le fond"],
  ["brand", "surface", "bouton / élément de marque sur une carte"],
  ["teal", "surface", "élément d'interface sarcelle"],
];

describe("Palette « Majorelle » — contraste WCAG AA", () => {
  describe.each(TEXT_PAIRS)("%s sur %s (%s)", (fg, bg, label) => {
    it(`doit atteindre ${AA_TEXT}:1`, () => {
      const ratio = contrast(resolve(fg), resolve(bg));
      expect(
        ratio,
        `${label} : ${ratio.toFixed(2)}:1 (requis ${AA_TEXT}:1)`
      ).toBeGreaterThanOrEqual(AA_TEXT);
    });
  });

  describe.each(NON_TEXT_PAIRS)("%s sur %s (%s)", (fg, bg, label) => {
    it(`doit atteindre ${AA_NON_TEXT}:1`, () => {
      const ratio = contrast(resolve(fg), resolve(bg));
      expect(
        ratio,
        `${label} : ${ratio.toFixed(2)}:1 (requis ${AA_NON_TEXT}:1)`
      ).toBeGreaterThanOrEqual(AA_NON_TEXT);
    });
  });

  it("le texte blanc sur le bouton principal reste lisible", () => {
    const ratio = contrast(resolve("brand"), "#FFFFFF");
    expect(ratio, `blanc sur marque : ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
      AA_TEXT
    );
  });

  it("expose une variante de survol plus contrastée que la base", () => {
    const base = luminance(resolve("brand"));
    const strong = luminance(resolve("brand-strong"));
    expect(strong, "brand-strong doit être plus sombre que brand").toBeLessThan(base);
  });

  it("n'expose plus aucun jeton « lime » hérité de l'ancienne palette", () => {
    expect(globalsCss).not.toMatch(/--color-lime/);
    expect(globalsCss).not.toMatch(/--lime:/);
  });
});