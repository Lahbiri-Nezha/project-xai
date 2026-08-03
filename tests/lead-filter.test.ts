import { describe, it, expect } from "vitest";
import { buildLeadWhere } from "@/lib/lead-filter";

describe("buildLeadWhere — isolement multi-tenant", () => {
  it("impose toujours organizationId", () => {
    const where = buildLeadWhere({ organizationId: "org-a" });
    expect(where.organizationId).toBe("org-a");
  });

  it("applique les filtres d'intention et de vérification", () => {
    const where = buildLeadWhere({
      organizationId: "org-a",
      intent: "HOT",
      verification: "VERIFIED",
    });
    expect(where.intent).toBe("HOT");
    expect(where.verification).toBe("VERIFIED");
  });

  it("applique la plage de score", () => {
    const where = buildLeadWhere({
      organizationId: "org-a",
      scoreMin: 50,
      scoreMax: 90,
    });
    expect(where.score).toEqual({ gte: 50, lte: 90 });
  });

  it("translate les filtres entreprise dans where.company sans perdre l'org", () => {
    const where = buildLeadWhere({
      organizationId: "org-a",
      city: "Casablanca",
      industry: "Fintech",
    });
    expect(where.organizationId).toBe("org-a");
    expect(where.company).toEqual({
      headquartersCity: { contains: "Casablanca", mode: "insensitive" },
      industry: { contains: "Fintech", mode: "insensitive" },
    });
  });

  it("n'ajoute pas de clause company si aucun filtre entreprise", () => {
    const where = buildLeadWhere({ organizationId: "org-a", intent: "WARM" });
    expect(where.company).toBeUndefined();
  });
});
