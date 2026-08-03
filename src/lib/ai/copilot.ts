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

Always be specific. Reference actual lead names, scores, and signals when discussing them.
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
      if (/score|expliqu|pourquoi|calcul|priorit/.test(lower)) {
        const ref =
          lower.match(
            /pour\s+([^?.]+)/
          )?.[1]?.trim();
        const result = await explainLeadScoreForOrg(orgId, ref ?? undefined);
        if (result.lead) {
          return [
            `**Explication du score de ${result.lead.name}** (${result.lead.company ?? "société inconnue"}) :`,
            "",
            `Score **${result.lead.score}/100** — intent **${result.lead.intent}**.`,
            "",
            result.lead.explanation ??
              "Aucune explication détaillée n'est disponible pour ce lead.",
            "",
            "Souhaitez-vous le détail des facteurs ou une recommandation d'action ?",
          ].join("\n");
        }
        if (result.leads) {
          const lines = result.leads
            .map(
              (l, i) =>
                `${i + 1}. **${l.name}** (${l.company ?? "société inconnue"}) — ${l.score}/100 — ${l.intent}`
            )
            .join("\n");
          return `Voici comment sont répartis vos top leads :\n\n${lines}`;
        }
        return "Je n'ai pas trouvé de lead correspondant à votre demande. Donnez-moi un nom, une société ou un email.";
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
