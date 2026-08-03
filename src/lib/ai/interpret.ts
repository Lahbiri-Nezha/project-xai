import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { zodSchema } from "@ai-sdk/provider-utils";
import { z } from "zod";

export const SIGNAL_TYPES = [
  "FUNDING",
  "HIRING",
  "WEBSITE_VISIT",
  "EMAIL_OPEN",
  "PRICING_PAGE",
  "TECH_MATCH",
  "CONTENT_DOWNLOAD",
  "MEETING_BOOKED",
  "NEWS",
  "ORG_CHANGE",
] as const;

export const InterpretedFiltersSchema = z.object({
  employeesMin: z.number().int().min(0).optional(),
  employeesMax: z.number().int().min(0).optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  industry: z.string().optional(),
  techStack: z.array(z.string()).optional(),
  signalTypes: z.array(z.enum(SIGNAL_TYPES)).optional(),
});

export type InterpretedFilters = z.infer<typeof InterpretedFiltersSchema>;

const empty = {};

/**
 * Étape 1 du pipeline IA : traduit une requête en langage naturel
 * en filtres structurés (équivalent AI Search de Cognism).
 * Sans clé OpenAI, retourne des filtres vides (fallback = recherche par mots-clés).
 */
export async function interpretQuery(
  query: string
): Promise<InterpretedFilters> {
  if (!process.env.OPENAI_API_KEY) return empty;

  try {
    const { object } = await generateObject({
      model: openai("gpt-4o"),
      schema: zodSchema(InterpretedFiltersSchema),
      prompt: `Tu es l'interpréteur de recherche d'une plateforme de sales intelligence ciblant le marché marocain/MENA.

Convertis la requête ci-dessous en filtres structurés pour une recherche d'entreprises (B2B, PME/TPE).

- Traduis les villes/pays en valeurs simples ("casa" -> Casablanca, "rabat" -> Rabat, "tanger" -> Tanger).
- "série a", "série b", "levée" ne sont PAS représentés par les filtres (garde-les vides).
- "logistique", "fintech", "banque", "agro" -> champ industry.
- "pmé", "petites entreprises", "startup" -> employeesMin/employeesMax (PME ≈ 10-500, TPE ≈ 1-10, ETI ≈ 500-5000, grand compte > 5000).
- Les technologies ("salesforce", "aws", "sap", "react", "oracle") -> techStack.
- Signaux ("recrute", "embauche" -> HIRING ; "levée de fonds", "financement" -> FUNDING ; "actualité", "news" -> NEWS ; "visite page tarifs" -> PRICING_PAGE).
- N'invente jamais de valeur : si un élément est ambigu ou absent, omets le champ.

Requête : "${query}"

Réponds uniquement avec le JSON des filtres structurés.`,
    });
    return object;
  } catch {
    return empty;
  }
}
