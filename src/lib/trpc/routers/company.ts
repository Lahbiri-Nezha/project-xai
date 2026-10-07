import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../server";
import { prisma } from "@/lib/prisma";
import { sendEvent } from "@/lib/inngest/client";
import { interpretQuery, SIGNAL_TYPES } from "@/lib/ai/interpret";
import { uploadExportToStorage } from "@/lib/export-storage";
import type { Prisma } from "../../../../generated/prisma/client";

export const companyFiltersSchema = z.object({
  employeesMin: z.number().int().min(0).optional(),
  employeesMax: z.number().int().min(0).optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  industry: z.string().optional(),
  techStack: z.array(z.string()).optional(),
  signalTypes: z.array(z.enum(SIGNAL_TYPES)).optional(),
});

export type CompanyFilters = z.infer<typeof companyFiltersSchema>;

function mergeFilters(
  explicit: CompanyFilters,
  interpreted: Partial<CompanyFilters>
): CompanyFilters {
  return {
    employeesMin: explicit.employeesMin ?? interpreted.employeesMin,
    employeesMax: explicit.employeesMax ?? interpreted.employeesMax,
    city: explicit.city ?? interpreted.city,
    country: explicit.country ?? interpreted.country,
    industry: explicit.industry ?? interpreted.industry,
    techStack: explicit.techStack ?? interpreted.techStack,
    signalTypes: explicit.signalTypes ?? interpreted.signalTypes,
  };
}

const KEYWORD_STOPWORDS = new Set([
  "a",
  "au",
  "aux",
  "avec",
  "ce",
  "ces",
  "dans",
  "de",
  "des",
  "du",
  "en",
  "et",
  "la",
  "le",
  "les",
  "pour",
  "que",
  "qui",
  "sur",
  "un",
  "une",
]);

function buildWhere(
  organizationId: string,
  filters: CompanyFilters,
  keyword?: string
): Prisma.CompanyWhereInput {
  const where: Prisma.CompanyWhereInput = { organizationId };

  if (filters.employeesMin != null || filters.employeesMax != null) {
    where.employeeCount = {
      gte: filters.employeesMin,
      lte: filters.employeesMax,
    };
  }
  if (filters.city) {
    where.headquartersCity = { contains: filters.city, mode: "insensitive" };
  }
  if (filters.country) {
    where.headquartersCountry = { contains: filters.country, mode: "insensitive" };
  }
  if (filters.industry) {
    where.industry = { contains: filters.industry, mode: "insensitive" };
  }
  if (filters.techStack?.length) {
    where.techStack = { hasEvery: filters.techStack };
  }
  if (filters.signalTypes?.length) {
    where.buyingSignals = { some: { type: { in: filters.signalTypes } } };
  }
  if (keyword) {
    const tokens = keyword
      .split(/[^a-z0-9àâäéèêëîïôöùûüç]+/i)
      .map((t) => t.toLowerCase())
      .filter((t) => t.length > 2 && !KEYWORD_STOPWORDS.has(t));
    if (tokens.length > 0) {
      where.OR = tokens.flatMap((token) => [
        { name: { contains: token, mode: "insensitive" } },
        { domain: { contains: token, mode: "insensitive" } },
        { industry: { contains: token, mode: "insensitive" } },
        { headquartersCity: { contains: token, mode: "insensitive" } },
      ]);
    }
  }

  return where;
}

function computeFitScore(company: {
  employeeCount: number | null;
  industry: string | null;
  revenueEstimate: number | null;
  techStack: string[];
  buyingSignals: { intensity: number }[];
}): number {
  let score = 0;

  const emp = company.employeeCount ?? 0;
  if (emp >= 10 && emp <= 500) score += 30; // PME cible
  else if (emp > 0 && emp < 10) score += 18; // TPE
  else if (emp > 500 && emp <= 5000) score += 15;
  else if (emp > 5000) score += 8;

  if (company.industry) score += 15;

  const signalScore = Math.min(
    30,
    company.buyingSignals.reduce((acc, s) => acc + s.intensity * 6, 0)
  );
  score += signalScore;

  if (company.techStack.length > 0) score += 10;
  if (company.revenueEstimate != null) score += 10;

  return Math.round(Math.min(100, score));
}

export async function searchCompanies(params: {
  organizationId: string;
  query?: string;
  filters: CompanyFilters;
  limit: number;
  offset: number;
}) {  let filters = params.filters;
  let keyword: string | undefined;

  if (params.query?.trim()) {
    const interpreted = await interpretQuery(params.query);
    const hasInterpreted = Object.values(interpreted).some((v) =>
      Array.isArray(v) ? v.length > 0 : v != null
    );
    if (hasInterpreted) {
      filters = mergeFilters(filters, interpreted);
    } else {
      keyword = params.query.trim();
    }
  }

  const where = buildWhere(params.organizationId, filters, keyword);

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      include: { buyingSignals: { take: 3, orderBy: { detectedAt: "desc" } } },
      take: params.limit,
      skip: params.offset,
    }),
    prisma.company.count({ where }),
  ]);

  return {
    total,
    companies: companies.map((c) => ({
      ...c,
      fitScore: computeFitScore(c),
    })),
    filtersApplied: filters,
  };
}

export const companyRouter = router({
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().max(300).optional(),
        filters: companyFiltersSchema.optional(),
        limit: z.number().int().min(1).max(50).default(20),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      return searchCompanies({
        organizationId: ctx.orgId,
        query: input.query,
        filters: input.filters ?? {},
        limit: input.limit,
        offset: input.offset,
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const company = await ctx.prisma.company.findFirst({
        where: { id: input.id, organizationId: ctx.orgId },
        include: {
          leads: { where: { organizationId: ctx.orgId }, include: { signals: true } },
          buyingSignals: { orderBy: { detectedAt: "desc" } },
          dataSources: { orderBy: { fetchedAt: "desc" } },
        },
      });
      if (!company) throw new Error("Company not found");
      return { ...company, fitScore: computeFitScore(company) };
    }),

  triggerEnrich: protectedProcedure
    .input(z.object({ companyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const company = await ctx.prisma.company.findFirst({
        where: { id: input.companyId, organizationId: ctx.orgId },
        select: { id: true },
      });
      if (!company) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Entreprise introuvable dans cet espace.",
        });
      }
      await sendEvent(
        "companies.created",
        { companyId: input.companyId },
        async () => {
          const { enrichCompany } = await import("@/lib/ai/enrichment");
          await enrichCompany(input.companyId);
        }
      );
      return { scheduled: true };
    }),

  exportCsv: protectedProcedure
    .input(
      z.object({
        query: z.string().max(300).optional(),
        filters: companyFiltersSchema.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { companies } = await searchCompanies({
        organizationId: ctx.orgId,
        query: input.query,
        filters: input.filters ?? {},
        limit: 500,
        offset: 0,
      });

      const header =
        "name,domain,industry,city,country,employees,revenue_estimate,tech_stack,fit_score,top_signal";
      const rows = companies.map((c) =>
        [
          `"${(c.name ?? "").replace(/"/g, '""')}"`,
          `"${(c.domain ?? "").replace(/"/g, '""')}"`,
          `"${(c.industry ?? "").replace(/"/g, '""')}"`,
          `"${(c.headquartersCity ?? "").replace(/"/g, '""')}"`,
          `"${(c.headquartersCountry ?? "").replace(/"/g, '""')}"`,
          c.employeeCount ?? "",
          c.revenueEstimate ?? "",
          `"${c.techStack.join(";")}"`,
          c.fitScore,
          `"${c.buyingSignals[0]?.type ?? ""}"`,
        ].join(",")
      );
      const csv = [header, ...rows].join("\n");
      const url = await uploadExportToStorage("prospector-companies.csv", csv);
      return { url, csv: url ? null : csv };
    }),
});
