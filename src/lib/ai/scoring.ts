import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../generated/prisma/client";

export interface ScoreFactor {
  name: string;
  weight: number;
  contribution: number;
  explanation: string;
}

export interface ScoreResult {
  score: number;
  intent: "COLD" | "WARM" | "HOT";
  factors: ScoreFactor[];
  explanation: string;
}

const SENIOR_TITLES = [
  "CEO",
  "CTO",
  "CFO",
  "CMO",
  "COO",
  "VP",
  "VICE PRESIDENT",
  "DIRECTOR",
  "HEAD",
  "FOUNDER",
  "PRESIDENT",
  "CHIEF",
];

const SIGNAL_LABELS: Record<string, string> = {
  FUNDING: "levée de fonds",
  HIRING: "recrutement actif",
  WEBSITE_VISIT: "visite du site",
  EMAIL_OPEN: "ouverture d'email",
  PRICING_PAGE: "visite page tarifs",
  TECH_MATCH: "stack compatible",
  CONTENT_DOWNLOAD: "téléchargement de contenu",
  MEETING_BOOKED: "réunion planifiée",
  NEWS: "actualité",
  ORG_CHANGE: "changement d'organigramme",
};

function pct(part: number, whole: number) {
  return Math.round((part / Math.max(1, whole)) * 100);
}

export function computeScoreFromLead(lead: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  verification?: string | null;
  confidenceEmail?: number | null;
  confidencePhone?: number | null;
  confidenceTitle?: number | null;
  company?: {
    name?: string | null;
    industry?: string | null;
    employeeCount?: number | null;
    revenueEstimate?: number | null;
    fundingStage?: string | null;
    techStack?: string[] | null;
    buyingSignals?: { type: string; intensity: number }[];
  } | null;
  signals?: { type: string; value: string; weight?: number | null }[];
}): ScoreResult {
  const company = lead.company ?? {};
  // Company signals are the canonical source. Older leads may also have a
  // mirrored Signal record, so retain the highest strength once per type.
  const signalWeights = new Map<string, number>();
  for (const signal of lead.signals ?? []) {
    signalWeights.set(
      signal.type,
      Math.max(signalWeights.get(signal.type) ?? 0, Math.min(10, signal.weight ?? 1))
    );
  }
  for (const signal of company.buyingSignals ?? []) {
    signalWeights.set(
      signal.type,
      Math.max(signalWeights.get(signal.type) ?? 0, Math.min(10, signal.intensity))
    );
  }
  const signals = [...signalWeights.entries()].map(([type, weight]) => ({ type, weight }));
  const title = lead.title ?? "";
  const upperTitle = title.toUpperCase();
  const factors: ScoreFactor[] = [];
  const notes: string[] = [];

  // 1. Taille et profil de l'entreprise (weight 20)
  const emp = company.employeeCount ?? null;
  let sizeContribution = 8;
  let sizeNote = "taille d'entreprise inconnue";
  if (emp != null) {
    if (emp >= 10 && emp <= 500) {
      sizeContribution = 20;
      sizeNote = `PME cible (${emp} employés)`;
    } else if (emp > 0 && emp < 10) {
      sizeContribution = 12;
      sizeNote = `TPE (${emp} employés)`;
    } else if (emp > 500 && emp <= 5000) {
      sizeContribution = 15;
      sizeNote = `grand compte (${emp} employés)`;
    } else if (emp > 5000) {
      sizeContribution = 9;
      sizeNote = `compte de très grande taille (${emp} employés)`;
    }
  }
  factors.push({
    name: "company_size",
    weight: 20,
    contribution: sizeContribution,
    explanation: sizeNote,
  });
  notes.push(sizeNote);

  // 2. Signaux d'achat (weight 30)
  const signalScore = Math.min(
    30,
    signals.reduce((acc, s) => acc + s.weight * 4, 0)
  );
  const signalLabels = signals.map((s) => SIGNAL_LABELS[s.type] ?? s.type);
  const signalNote =
    signalLabels.length > 0
      ? `signaux détectés : ${signalLabels.slice(0, 4).join(", ")}`
      : "aucun signal d'achat détecté";
  factors.push({
    name: "buying_signals",
    weight: 30,
    contribution: signalScore,
    explanation: signalNote,
  });
  notes.push(signalNote);

  // 3. Qualité du contact (weight 15)
  const verified = lead.verification === "VERIFIED";
  const hasEmail = Boolean(lead.email);
  const hasPhone = Boolean(lead.phone);
  const hasTitle = Boolean(title);
  let contactScore = 0;
  let contactNote = "contact très peu complet";
  if (hasEmail && verified) {
    contactScore = 15;
    contactNote = "email présent et vérifié";
  } else if (hasEmail && (lead.confidenceEmail ?? 0) >= 0.7) {
    contactScore = 13;
    contactNote = "email présent avec bonne confiance";
  } else if (hasEmail) {
    contactScore = 10;
    contactNote = "email présent (non vérifié)";
  } else if (hasPhone) {
    contactScore = 7;
    contactNote = "téléphone présent";
  } else if (hasTitle) {
    contactScore = 4;
    contactNote = "seul le poste est connu";
  }
  factors.push({
    name: "contact_quality",
    weight: 15,
    contribution: contactScore,
    explanation: contactNote,
  });
  notes.push(contactNote);

  // 4. Profil de l'entreprise renseigné (weight 15)
  let profileScore = 0;
  const profileNotes: string[] = [];
  if (company.industry) {
    profileScore += 5;
    profileNotes.push("secteur identifié");
  }
  if (company.revenueEstimate != null) {
    profileScore += 5;
    profileNotes.push("CA estimé");
  }
  if (company.fundingStage) {
    profileScore += 5;
    profileNotes.push("stade de financement connu");
  }
  if (!profileNotes.length) profileNotes.push("profil d'entreprise peu renseigné");
  factors.push({
    name: "company_profile",
    weight: 15,
    contribution: profileScore,
    explanation: profileNotes.join(", "),
  });
  notes.push(profileNotes.join(", "));

  // 5. Adéquation technique (weight 10)
  const tech = (company.techStack ?? []).filter(Boolean);
  const techScore = tech.length > 0 ? 10 : 3;
  factors.push({
    name: "tech_fit",
    weight: 10,
    contribution: techScore,
    explanation:
      tech.length > 0
        ? `stack identifiée (${tech.slice(0, 3).join(", ")})`
        : "stack technique inconnue",
  });

  // 6. Seniorité du décideur (weight 10)
  let seniorScore = 4;
  let seniorNote = "poste sans signe de seniorité";
  if (SENIOR_TITLES.some((t) => upperTitle.includes(t))) {
    seniorScore = 10;
    seniorNote = "décideur senior identifié";
  } else if (/manager|lead|responsable|manager/i.test(title)) {
    seniorScore = 7;
    seniorNote = "poste de responsable";
  }
  factors.push({
    name: "seniority",
    weight: 10,
    contribution: seniorScore,
    explanation: seniorNote,
  });

  const score = Math.min(
    100,
    factors.reduce((acc, f) => acc + f.contribution, 0)
  );
  const intent: ScoreResult["intent"] =
    score >= 70 ? "HOT" : score >= 45 ? "WARM" : "COLD";

  const companyName = company.name ?? "Cette entreprise";
  const explanation = `${companyName} est ${intent === "HOT" ? "un excellent" : intent === "WARM" ? "un bon" : "un candidat à suivre"} : ${notes.slice(0, 3).join(" ; ")}. ${score >= 45 ? "Il est pertinent de prioriser la mise en relation." : "Il faut encore réunir des signaux avant de prioriser ce contact."}`;

  return { score, intent, factors, explanation };
}

export async function scoreLead(leadId: string): Promise<ScoreResult> {
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { company: { include: { buyingSignals: true } }, signals: true },
  });

  const result = computeScoreFromLead(lead);

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      score: result.score,
      intent: result.intent,
      scoreExplainability: {
        factors: result.factors,
        explanation: result.explanation,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  return result;
}

export function confidenceFromScore(result: ScoreResult) {
  return pct(result.score, 100);
}
