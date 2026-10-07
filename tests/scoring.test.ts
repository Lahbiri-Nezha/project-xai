import { describe, it, expect } from "vitest";
import { computeScoreFromLead } from "@/lib/ai/scoring";

const SIGNAL_TYPES = [
  "FUNDING",
  "HIRING",
  "WEBSITE_VISIT",
  "EMAIL_OPEN",
  "PRICING_PAGE",
  "TECH_MATCH",
  "CONTENT_DOWNLOAD",
  "MEETING_BOOKED",
  "NEWS",
] as const;

function baseLead() {
  return {
    firstName: "Ayoub",
    lastName: "Naciri",
    email: "ayoub.naciri@soukonline.ma",
    phone: "+212661000000",
    title: "CTO",
    verification: "VERIFIED",
    confidenceEmail: 0.95,
    confidencePhone: 0.9,
    confidenceTitle: 0.95,
    company: {
      name: "SoukOnline",
      industry: "E-commerce",
      employeeCount: 110,
      revenueEstimate: 18,
      fundingStage: "Série B",
      techStack: ["Shopify", "Klaviyo", "HubSpot"],
    },
    signals: [],
  };
}

describe("computeScoreFromLead — déterminisme et cohérence", () => {
  it("est déterministe : mêmes données d'entrée → même score", () => {
    const lead = {
      ...baseLead(),
      signals: [
        { type: "HIRING", value: "HIRING", weight: 3 },
        { type: "TECH_MATCH", value: "TECH_MATCH", weight: 2 },
        { type: "FUNDING", value: "FUNDING", weight: 2 },
      ],
    };

    const first = computeScoreFromLead(lead);
    const second = computeScoreFromLead(lead);

    expect(first.score).toBe(second.score);
    expect(first.intent).toBe(second.intent);
    expect(first.factors).toEqual(second.factors);
  });

  it("des signaux détectés alimentent le facteur buying_signals (28 pts pour le cas rapporté)", () => {
    const lead = {
      ...baseLead(),
      signals: [
        { type: "HIRING", value: "HIRING", weight: 3 },
        { type: "TECH_MATCH", value: "TECH_MATCH", weight: 2 },
        { type: "FUNDING", value: "FUNDING", weight: 2 },
      ],
    };

    const result = computeScoreFromLead(lead);
    const buying = result.factors.find((f) => f.name === "buying_signals");

    expect(buying?.contribution).toBe(28);
    expect(buying?.explanation).not.toContain("aucun signal");
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  it("utilise les signaux de la société même quand le miroir lead est absent", () => {
    const lead = {
      ...baseLead(),
      company: {
        ...baseLead().company,
        buyingSignals: [
          { type: "HIRING", intensity: 3 },
          { type: "TECH_MATCH", intensity: 2 },
          { type: "FUNDING", intensity: 2 },
        ],
      },
    };

    const result = computeScoreFromLead(lead);
    const buying = result.factors.find((f) => f.name === "buying_signals");

    expect(buying?.contribution).toBe(28);
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  it("ne compte pas deux fois un signal miroir et son signal société", () => {
    const lead = {
      ...baseLead(),
      signals: [{ type: "HIRING", value: "HIRING", weight: 3 }],
      company: { ...baseLead().company, buyingSignals: [{ type: "HIRING", intensity: 3 }] },
    };

    const buying = computeScoreFromLead(lead).factors.find((f) => f.name === "buying_signals");
    expect(buying?.contribution).toBe(12);
  });

  it("le poids des signaux est plafonné à 30 pour le facteur buying_signals", () => {
    const lead = {
      ...baseLead(),
      signals: SIGNAL_TYPES.slice(0, 5).map((type) => ({
        type,
        value: type,
        weight: 10,
      })),
    };

    const result = computeScoreFromLead(lead);
    const buying = result.factors.find((f) => f.name === "buying_signals");

    expect(buying?.contribution).toBe(30);
    expect(result.score).toBe(100);
  });
});
