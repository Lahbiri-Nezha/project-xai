import type { Prisma } from "../../generated/prisma/client";

export const complianceTypes = ["OPT_OUT", "DO_NOT_CALL", "SUPPRESSED"] as const;

export function normalizeValue(type: string, value: string): string {
  const trimmed = value.trim();
  if (type === "OPT_OUT" && trimmed.includes("@")) {
    return trimmed.toLowerCase();
  }
  if (type === "DO_NOT_CALL" || type === "SUPPRESSED") {
    const digits = trimmed.replace(/[^+\d]/g, "");
    if (digits) return digits;
  }
  return trimmed;
}

export type ComplianceDb = {
  complianceFlag: {
    findFirst(
      args: Prisma.ComplianceFlagFindFirstArgs
    ): Promise<{ type: string; value: string } | null>;
  };
};

export async function getComplianceBlock(
  db: ComplianceDb,
  orgId: string,
  lead: { id: string; email: string | null; phone: string | null }
): Promise<{ blocked: boolean; reason?: string }> {
  const flag = await db.complianceFlag.findFirst({
    where: {
      organizationId: orgId,
      OR: [
        { contactId: lead.id },
        ...(lead.email ? [{ value: lead.email.toLowerCase() }] : []),
        ...(lead.phone ? [{ value: lead.phone.replace(/[^+\d]/g, "") }] : []),
      ],
      type: { in: [...complianceTypes] },
    },
    select: { type: true, value: true },
  });
  if (!flag) return { blocked: false };
  const label =
    flag.type === "OPT_OUT"
      ? "opt-out email"
      : flag.type === "DO_NOT_CALL"
        ? "do-not-call"
        : "supprimé (RGPD)";
  return { blocked: true, reason: label };
}
