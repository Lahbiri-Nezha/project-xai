import { describe, it, expect } from "vitest";
import {
  getComplianceBlock,
  normalizeValue,
  type ComplianceDb,
} from "@/lib/compliance";

function fakeDb(flag: { type: string; value: string } | null): ComplianceDb {
  return {
    complianceFlag: {
      findFirst: async () => flag,
    },
  } as unknown as ComplianceDb;
}

const lead = {
  id: "lead-1",
  email: "ALI@example.com",
  phone: "+212 6 12 34 56 78",
};

describe("normalizeValue", () => {
  it("normalise les emails en minuscules", () => {
    expect(normalizeValue("OPT_OUT", "  ALI@Example.COM ")).toBe("ali@example.com");
  });

  it("extrait uniquement les chiffres pour les téléphones", () => {
    expect(normalizeValue("DO_NOT_CALL", "+212 6 12 34 56 78")).toBe("+212612345678");
  });
});

describe("getComplianceBlock", () => {
  it("autorise le contact quand aucun flag n'existe", async () => {
    const res = await getComplianceBlock(fakeDb(null), "org-1", lead);
    expect(res.blocked).toBe(false);
  });

  it("bloque un email en opt-out quelle que soit la casse", async () => {
    const res = await getComplianceBlock(
      fakeDb({ type: "OPT_OUT", value: "ali@example.com" }),
      "org-1",
      lead
    );
    expect(res.blocked).toBe(true);
    expect(res.reason).toBe("opt-out email");
  });

  it("bloque un téléphone do-not-call quel que soit le format", async () => {
    const res = await getComplianceBlock(
      fakeDb({ type: "DO_NOT_CALL", value: "+212612345678" }),
      "org-1",
      lead
    );
    expect(res.blocked).toBe(true);
    expect(res.reason).toBe("do-not-call");
  });

  it("bloque via contactId (suppression RGPD)", async () => {
    const db = {
      complianceFlag: {
        findFirst: async ({ where }: { where: { OR: { contactId?: string }[] } }) =>
          where.OR.some((o) => o.contactId === lead.id)
            ? { type: "SUPPRESSED", value: "hashed" }
            : null,
      },
    } as unknown as ComplianceDb;
    const res = await getComplianceBlock(db, "org-1", lead);
    expect(res.blocked).toBe(true);
    expect(res.reason).toBe("supprimé (RGPD)");
  });

  it("est multi-tenant : un flag d'un autre org ne bloque pas", async () => {
    const db = {
      complianceFlag: {
        findFirst: async ({ where }: { where: { organizationId: string } }) =>
          where.organizationId === "org-1"
            ? { type: "OPT_OUT", value: "ali@example.com" }
            : null,
      },
    } as unknown as ComplianceDb;
    const res = await getComplianceBlock(db, "org-999", lead);
    expect(res.blocked).toBe(false);
  });
});
