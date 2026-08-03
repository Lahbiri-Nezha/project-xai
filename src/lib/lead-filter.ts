import type { Prisma } from "../../generated/prisma/client";

export type LeadFilterInput = Omit<
  {
    intent?: "COLD" | "WARM" | "HOT";
    status?:
      | "NEW"
      | "CONTACTED"
      | "QUALIFIED"
      | "UNQUALIFIED"
      | "CONVERTED"
      | "LOST";
    title?: string;
    companyName?: string;
    companyId?: string;
    city?: string;
    industry?: string;
    techStack?: string[];
    hasEmail?: boolean;
    hasPhone?: boolean;
    verification?: "UNVERIFIED" | "PENDING" | "VERIFIED" | "INVALID";
    scoreMin?: number;
    scoreMax?: number;
    limit?: number;
    offset?: number;
  },
  "limit" | "offset"
> & { organizationId: string; limit?: number; offset?: number };

export function buildLeadWhere(input: LeadFilterInput): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = { organizationId: input.organizationId };

  if (input.intent) where.intent = input.intent;
  if (input.status) where.status = input.status;
  if (input.verification) where.verification = input.verification;
  if (input.title) {
    where.title = { contains: input.title, mode: "insensitive" };
  }
  if (input.hasEmail) where.email = { not: null };
  if (input.hasPhone) where.phone = { not: null };
  if (input.scoreMin != null || input.scoreMax != null) {
    where.score = { gte: input.scoreMin, lte: input.scoreMax };
  }
  if (input.companyId) {
    where.companyId = input.companyId;
  }
  const companyFilter = {
    ...(input.companyName
      ? { name: { contains: input.companyName, mode: "insensitive" as const } }
      : {}),
    ...(input.city
      ? {
          headquartersCity: {
            contains: input.city,
            mode: "insensitive" as const,
          },
        }
      : {}),
    ...(input.industry
      ? {
          industry: { contains: input.industry, mode: "insensitive" as const },
        }
      : {}),
    ...(input.techStack?.length ? { techStack: { hasEvery: input.techStack } } : {}),
  };
  if (Object.keys(companyFilter).length > 0) {
    where.company = companyFilter;
  }

  return where;
}
