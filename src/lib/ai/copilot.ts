import { openai } from "@ai-sdk/openai";
import { streamText, tool } from "ai";
import { zodSchema } from "@ai-sdk/provider-utils";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { ToolSet } from "ai";

export interface CopilotMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface CopilotStream {
  textStream: AsyncIterable<string>;
}

// ─── Outils (partagés LLM + mode local) ─────────────────────────

async function getLeadsForOrg(
  orgId: string,
  params: { intent?: "COLD" | "WARM" | "HOT"; limit: number }
) {
  return prisma.lead.findMany({
    where: {
      organizationId: orgId,
      ...(params.intent ? { intent: params.intent } : {}),
    },
    include: { company: true, signals: true },
    orderBy: { score: "desc" },
    take: params.limit,
  });
}

async function getLeadDetailsForOrg(orgId: string, leadId: string) {
  return prisma.lead.findFirst({
    where: { id: leadId, organizationId: orgId },
    include: { company: true, signals: true, activities: true },
  });
}

async function getPipelineStatsForOrg(orgId: string) {
  const [total, hot, warm, cold, avg] = await Promise.all([
    prisma.lead.count({ where: { organizationId: orgId } }),
    prisma.lead.count({ where: { organizationId: orgId, intent: "HOT" } }),
    prisma.lead.count({ where: { organizationId: orgId, intent: "WARM" } }),
    prisma.lead.count({ where: { organizationId: orgId, intent: "COLD" } }),
    prisma.lead.aggregate({
      where: { organizationId: orgId },
      _avg: { score: true },
    }),
  ]);
  return { total, hot, warm, cold, avgScore: Math.round(avg._avg.score ?? 0) };
}

async function explainLeadScoreForOrg(
  orgId: string,
  ref?: string
) {
  const where = { organizationId: orgId };
  if (ref) {
    const match = await prisma.lead.findFirst({
      where: {
        organizationId: orgId,
        OR: [
          { email: { contains: ref, mode: "insensitive" } },
          { firstName: { contains: ref, mode: "insensitive" } },
          { lastName: { contains: ref, mode: "insensitive" } },
          { title: { contains: ref, mode: "insensitive" } },
          { company: { name: { contains: ref, mode: "insensitive" } } },
        ],
      },
      include: { company: true, signals: true },
    });
    if (!match) return { lead: null };
    return {
      lead: {
        id: match.id,
        name: `${match.firstName ?? ""} ${match.lastName ?? ""}`.trim(),
        company: match.company?.name ?? null,
        score: match.score,
        intent: match.intent,
        explanation:
          (match.scoreExplainability as { explanation?: string } | null)?.explanation ??
          null,
        factors:
          (match.scoreExplainability as { factors?: unknown } | null)?.factors ??
          [],
      },
    };
  }
  const leads = await prisma.lead.findMany({
    where,
    include: { company: true, signals: true },
    orderBy: { score: "desc" },
    take: 5,
  });
  return {
    leads: leads.map((l) => ({
      id: l.id,
      name: `${l.firstName ?? ""} ${l.lastName ?? ""}`.trim(),
      company: l.company?.name ?? null,
      score: l.score,
      intent: l.intent,
      explanation:
        (l.scoreExplainability as { explanation?: string } | null)?.explanation ??
        null,
    })),
  };
}

const FACTOR_LABELS: Record<string, string> = {
  company_size: "Taille de l'entreprise",
  buying_signals: "Signaux d'achat",
  contact_quality: "Qualité du contact",
  company_profile: "Profil de l'entreprise",
  tech_fit: "Adéquation technique",
  seniority: "Seniorité du décideur",
};

function extractLeadRef(message: string): string | null {
  const patterns = [
    /(?:explique|expliquer|pourquoi|score\s+(?:de|pour))\s+(?:moi\s+)?(?:le\s+score\s+)?(?:de\s+)?([a-zàâäéèêëîïôöùûüç][a-zàâäéèêëîïôöùûüç'’ -]{1,40})/i,
    /(?:notes?\s+de|points\s+de)\s+([a-zàâäéèêëîïôöùûüç][a-zàâäéèêëîïôöùûüç'’ -]{1,40})/i,
  ];
  let ref: string | null = null;
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      ref = match[1].trim();
      break;
    }
  }
  if (!ref) return null;
  const generic = new Set([
    "moi",
    "la",
    "le",
    "les",
    "des",
    "du",
    "de",
    "ce",
    "cette",
    "ces",
    "son",
    "sa",
    "ses",
    "mon",
    "ma",
    "mes",
    "score",
    "notes",
    "note",
    "repartition",
    "repartition",
    "pipeline",
    "liste",
    "top",
    "leads",
    "client",
    "clients",
    "pour",
  ]);
  const clean = ref
    .split(/[\s-]+/)
    .filter((word) => !generic.has(word.toLowerCase()))
    .join(" ");
  return clean.trim().length >= 2 ? clean : null;
}

function formatLeadExplanation(lead: {
  name: string | null;
  company: string | null;
  score: number;
  intent: string;
  explanation: string | null;
  factors?: unknown;
}): string {
  const lines = [
    `**Explication du score de ${lead.name ?? "ce lead"}** (${lead.company ?? "société inconnue"}) :`,
    "",
    `Score **${lead.score}/100** — intent **${lead.intent}**.`,
  ];
  const factors = (lead.factors as { name: string; weight: number; contribution: number; explanation: string }[] | undefined) ?? [];
  if (factors.length > 0) {
    lines.push("", "Décomposition du score :");
    for (const factor of factors) {
      lines.push(
        `- ${FACTOR_LABELS[factor.name] ?? factor.name} (poids ${factor.weight}) : ${factor.contribution} pts — ${factor.explanation}`
      );
    }
  }
  if (lead.explanation) {
    lines.push("", lead.explanation);
  }
  lines.push("", "Souhaitez-vous une recommandation d'action pour ce lead ?");
  return lines.join("\n");
}

function formatLeads(leads: {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  score: number;
  intent: string;
  company: { name: string | null } | null;
}[]) {
  if (leads.length === 0) {
    return "Aucun lead ne correspond à ce critère pour le moment.";
  }
  const lines = leads.map(
    (l, i) =>
      `${i + 1}. **${l.firstName ?? ""} ${l.lastName ?? ""}** (${l.company?.name ?? "société inconnue"}) — score ${l.score} — ${l.intent}`
  );
  return `Voici vos leads prioritaires :\n\n${lines.join("\n")}`;
}

function formatPipeline(stats: Awaited<ReturnType<typeof getPipelineStatsForOrg>>) {
  return [
    "Voici l'état de votre pipeline :",
    "",
    `- **Total de leads** : ${stats.total}`,
    `- **Chauds (HOT)** : ${stats.hot}`,
    `- **Tièdes (WARM)** : ${stats.warm}`,
    `- **Froids (COLD)** : ${stats.cold}`,
    `- **Score moyen** : ${stats.avgScore}/100`,
    "",
    stats.hot > 0
      ? `Vous avez ${stats.hot} leads chauds à traiter en priorité. Souhaitez-vous que je vous liste les plus prometteurs ?`
      : "Aucun lead chaud pour l'instant. Pensez à élargir la recherche ou à enrichir vos comptes.",
  ].join("\n");
}

// ─── Mode LLM (OPENAI_API_KEY requise) ─────────────────────────

function buildLLMTools(orgId: string): ToolSet {
  return {
    getLeads: tool({
      description: "Get leads for the current organization",
      inputSchema: zodSchema(
        z.object({
          intent: z.enum(["COLD", "WARM", "HOT"]).optional(),
          limit: z.number().default(10),
        })
      ),
      execute: (params) => getLeadsForOrg(orgId, params),
    }),
    getLeadDetails: tool({
      description: "Get detailed info about a specific lead",
      inputSchema: zodSchema(z.object({ leadId: z.string() })),
      execute: (params) => getLeadDetailsForOrg(orgId, params.leadId),
    }),
    getPipelineStats: tool({
      description: "Get overall pipeline statistics",
      inputSchema: zodSchema(z.object({ dummy: z.string().optional() })),
      execute: () => getPipelineStatsForOrg(orgId),
    }),
    explainLeadScore: tool({
      description:
        "Explain why a lead has its score (factor breakdown and natural language explanation). Pass an optional reference (lead name, email or company).",
      inputSchema: zodSchema(z.object({ ref: z.string().optional() })),
      execute: (params) => explainLeadScoreForOrg(orgId, params.ref),
    }),
  };
}

function createLLMStream(orgId: string, messages: CopilotMessage[]): CopilotStream {
  const result = streamText({
    model: openai("gpt-4o"),
    system: `You are an AI sales copilot for Sales Insight. You help sales reps understand their pipeline,
analyze leads, and get actionable recommendations. You have access to the organization's lead data.

Always answer the exact question in the user's LATEST message. If the user names or asks about a
specific lead (for example "explique Majda" or "pourquoi Karim a un score de 95"), call the
explainLeadScore tool with that lead's reference (name, email or company) and explain WHY that
specific lead got its score, using its factor breakdown and explanation. Do not reply with the same
ranked list a second time.

Reference actual lead names, scores, and signals when discussing them.
Keep responses concise and actionable. Respond in French by default.`,
    messages,
    tools: buildLLMTools(orgId),
  });
  return { textStream: result.textStream };
}

// ─── Mode local (déterministe, sans clé API) ───────────────────

function createLocalStream(orgId: string, messages: CopilotMessage[]): CopilotStream {
  const lastUser =
    [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const lower = lastUser.toLowerCase();

  const answer = (async (): Promise<string> => {
    try {
      if (/(top|chauds?|hot|meilleur|priorit)/.test(lower)) {
        const leads = await getLeadsForOrg(orgId, { intent: "HOT", limit: 5 });
        if (leads.length === 0) {
          return "Aucun lead chaud pour le moment. Je peux vous lister vos leads les mieux notés globalement ?";
        }
        return formatLeads(leads);
      }
      if (/pipeline|stats|statistiques|mois|combien/.test(lower)) {
        return formatPipeline(await getPipelineStatsForOrg(orgId));
      }
      if (/score|expliqu|pourquoi|calcul|priorit|notes/.test(lower)) {
        const ref = extractLeadRef(lastUser);
        if (ref) {
          const result = await explainLeadScoreForOrg(orgId, ref);
          if (result.lead) {
            return formatLeadExplanation(result.lead);
          }
          if (!/\b(repartition|pipeline|liste|top|mois|pipeline)\b/.test(ref)) {
            const top5 = await explainLeadScoreForOrg(orgId);
            const lines = (top5.leads ?? [])
              .map(
                (l, i) =>
                  `${i + 1}. **${l.name}** (${l.company ?? "société inconnue"}) — ${l.score}/100 — ${l.intent}`
              )
              .join("\n");
            return `Je n'ai trouvé aucun lead correspondant à « ${ref} ». Voici la répartition de vos top leads :\n\n${lines}`;
          }
        }
        const top5 = await explainLeadScoreForOrg(orgId);
        const lines = (top5.leads ?? [])
          .map(
            (l, i) =>
              `${i + 1}. **${l.name}** (${l.company ?? "société inconnue"}) — ${l.score}/100 — ${l.intent}`
          )
          .join("\n");
        return `Voici la répartition des scores de vos leads prioritaires :\n\n${lines}`;
      }
      return [
        "Je suis votre **Copilot Sales Insight**. Je peux :",
        "",
        "- Lister vos **top leads chauds** (score élevé, signaux d'achat)",
        "- Analyser votre **pipeline** (répartition HOT/WARM/COLD, score moyen)",
        "- **Expliquer un score** : dites-moi par exemple \"explique le score de Karim\"",
        "",
        "Que souhaitez-vous analyser ?",
      ].join("\n");
    } catch {
      return "Une erreur est survenue en interrogeant vos données. Réessayez dans un instant.";
    }
  })();

  return {
    textStream: {
      async *[Symbol.asyncIterator]() {
        yield await answer;
      },
    } as AsyncIterable<string>,
  };
}

export function createCopilotStream(
  orgId: string,
  messages: CopilotMessage[]
): CopilotStream {
  if (process.env.OPENAI_API_KEY) {
    return createLLMStream(orgId, messages);
  }
  return createLocalStream(orgId, messages);
}
