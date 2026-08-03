"use client";

import TopBar from "@/components/dashboard/TopBar";
import { use, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Building2, ExternalLink, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc/client";
import { SIGNAL_TYPES } from "@/lib/ai/interpret";

type CompanyView = {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  employeeCount: number | null;
  fundingStage: string | null;
  fundingAmount: number | null;
  revenueEstimate: number | null;
  headquartersCity: string | null;
  headquartersCountry: string | null;
  techStack: string[];
  lastEnrichedAt: Date | string | null;
  lastVerifiedAt: Date | string | null;
  fitScore: number;
  leads: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    title: string | null;
    score: number;
    intent: string;
  }[];
  buyingSignals: {
    id: string;
    type: string;
    intensity: number;
    source: string | null;
    detectedAt: Date | string;
  }[];
  dataSources: {
    id: string;
    kind: string;
    url: string | null;
    fetchedAt: Date | string;
  }[];
};

const signalKeys: Record<(typeof SIGNAL_TYPES)[number], string> = {
  FUNDING: "signalFunding",
  HIRING: "signalHiring",
  WEBSITE_VISIT: "signalWebsiteVisit",
  EMAIL_OPEN: "signalEmailOpen",
  PRICING_PAGE: "signalPricingPage",
  TECH_MATCH: "signalTechMatch",
  CONTENT_DOWNLOAD: "signalContentDownload",
  MEETING_BOOKED: "signalMeetingBooked",
  NEWS: "signalNews",
  ORG_CHANGE: "signalOrgChange",
};

export default function CompanyDetailPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const t = useTranslations("companyDetail");
  const signalLabels: Record<string, string> = Object.fromEntries(
    Object.entries(signalKeys).map(([type, key]) => [type, t(key as keyof typeof signalKeys)])
  ) as Record<string, string>;
  const sourceLabels: Record<string, string> = {
    website: t("sourceWebsite"),
    dns: t("sourceDns"),
    job_board: t("sourceJobBoard"),
    public_api: t("sourcePublicApi"),
    heuristic: t("sourceHeuristic"),
  };
  const { companyId } = use(params);
  const [copy, setCopy] = useState(false);
  const utils = trpc.useUtils();

  const { data: raw, isLoading } = trpc.company.getById.useQuery({ id: companyId });
  const company = raw as unknown as CompanyView | undefined;

  const enrich = trpc.company.triggerEnrich.useMutation({
    onSuccess: async () => {
      await utils.company.getById.invalidate({ id: companyId });
    },
  });

  const copyEmail = async (email: string | null) => {
    if (!email) return;
    await navigator.clipboard.writeText(email).catch(() => {});
    setCopy(true);
    setTimeout(() => setCopy(false), 1500);
  };

  if (isLoading) {
    return (
      <>
        <TopBar title={t("title")} />
        <div className="flex-1 p-6 space-y-6">
          <div className="h-16 bg-surface rounded-xl animate-pulse" />
          <div className="h-96 bg-surface rounded-xl animate-pulse" />
        </div>
      </>
    );
  }

  if (!company) {
    return (
      <>
        <TopBar title={t("title")} />
        <div className="flex-1 p-12 text-center">
          <p className="text-sm text-text-muted">{t("notFound")}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title={t("title")} />
      <div className="flex-1 p-6 overflow-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/prospector"
            className="p-2 rounded-lg hover:bg-surface-elevated transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-text-secondary" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-lime/10 flex items-center justify-center shrink-0">
                <Building2 className="h-5 w-5 text-lime-dark" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-foreground truncate">{company.name}</h2>
                <p className="text-xs text-text-muted">
                  {company.domain ?? t("domainUnknown")} ·{" "}
                  {[company.headquartersCity, company.headquartersCountry].filter(Boolean).join(", ") || t("locationUnknown")}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold font-data ${
              company.fitScore >= 70 ? "bg-lead-excellent/10 text-lead-excellent" :
              company.fitScore >= 40 ? "bg-lead-medium/10 text-lead-medium" :
              "bg-lead-low/10 text-lead-low"
            }`}>
              {t("fit", { score: company.fitScore })}
            </span>
            {company.domain && (
              <a
                href={`https://${company.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-medium text-lime hover:text-lime-dark inline-flex items-center gap-1"
              >
                {t("visitSite")} <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <button
              onClick={() => enrich.mutate({ companyId })}
              disabled={enrich.isPending}
              className="inline-flex items-center gap-1 rounded-lg bg-lime px-2.5 py-1 text-[11px] font-bold text-surface hover:bg-lime-dark disabled:opacity-60 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              {enrich.isPending ? t("enriching") : t("enrich")}
            </button>
            {enrich.isError && (
              <span className="text-[10px] text-lead-low">
                {enrich.error.message || t("enrichError")}
              </span>
            )}
            {enrich.isSuccess && !enrich.isPending && (
              <span className="text-[10px] text-lead-excellent">{t("enrichPlanned")}</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-surface border border-border p-6"
            >
              <h3 className="text-sm font-bold text-foreground mb-4">{t("profileTitle")}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {[
                  { label: t("fieldIndustry"), value: company.industry ?? "—" },
                  { label: t("fieldEmployees"), value: company.employeeCount ? String(company.employeeCount) : "—" },
                  { label: t("fieldRevenue"), value: company.revenueEstimate != null ? `${(company.revenueEstimate / 1_000_000).toFixed(1)}M MAD` : "—" },
                  { label: t("fieldFunding"), value: company.fundingStage ? `${company.fundingStage}${company.fundingAmount ? ` (${company.fundingAmount}M MAD)` : ""}` : "—" },
                  { label: t("fieldLastEnriched"), value: company.lastEnrichedAt ? new Date(company.lastEnrichedAt).toLocaleDateString("fr-FR") : "—" },
                  { label: t("fieldLastVerified"), value: company.lastVerifiedAt ? new Date(company.lastVerifiedAt).toLocaleDateString("fr-FR") : "—" },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between gap-2 border-b border-border/50 pb-2">
                    <span className="text-xs text-text-muted">{item.label}</span>
                    <span className="text-xs font-semibold text-foreground text-right">{item.value}</span>
                  </div>
                ))}
              </div>
              {company.techStack.length > 0 && (
                <div className="mt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">{t("techLabel")}</p>
                  <div className="flex flex-wrap gap-1">
                    {company.techStack.map((t) => (
                      <span key={t} className="inline-flex items-center rounded-md bg-surface-elevated px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>

            <div className="rounded-xl bg-surface border border-border p-6">
              <h3 className="text-sm font-bold text-foreground mb-4">{t("signalsTitle")}</h3>
              {company.buyingSignals.length === 0 ? (
                <p className="text-xs text-text-muted">{t("noSignals")}</p>
              ) : (
                <div className="space-y-2">
                  {company.buyingSignals.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-lg bg-surface-elevated p-3">
                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          {signalLabels[s.type as keyof typeof signalLabels] ?? s.type}
                        </p>
                        <p className="text-[10px] text-text-muted">
                          {s.source ?? t("sourceUnknown")} · {new Date(s.detectedAt).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                      <span className={`text-xs font-bold font-data ${s.intensity >= 4 ? "text-lead-excellent" : s.intensity >= 2 ? "text-lead-medium" : "text-lead-low"}`}>
                        x{s.intensity}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl bg-surface border border-border p-6">
              <h3 className="text-sm font-bold text-foreground mb-4">{t("sourcesTitle")}</h3>
              {company.dataSources.length === 0 ? (
                <p className="text-xs text-text-muted">{t("noSources")}</p>
              ) : (
                <div className="space-y-2">
                  {company.dataSources.map((ds) => (
                    <div key={ds.id} className="flex items-center justify-between gap-3 rounded-lg bg-surface-elevated p-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground">{sourceLabels[ds.kind] ?? ds.kind}</p>
                        {ds.url && (
                          <a href={ds.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-lime hover:text-lime-dark truncate block">
                            {ds.url}
                          </a>
                        )}
                      </div>
                      <span className="text-[10px] text-text-muted shrink-0">
                        {new Date(ds.fetchedAt).toLocaleString("fr-FR")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl bg-surface border border-border p-6">
              <h3 className="text-sm font-bold text-foreground mb-4">{t("contactsTitle", { count: company.leads.length })}</h3>
              {company.leads.length === 0 ? (
                <p className="text-xs text-text-muted">{t("noContacts")}</p>
              ) : (
                <div className="space-y-2">
                  {company.leads.map((l) => (
                    <Link
                      key={l.id}
                      href={`/dashboard/leads/${l.id}`}
                      className="block rounded-lg bg-surface-elevated p-3 hover:bg-lime/5 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-foreground">
                          {l.firstName} {l.lastName}
                        </p>
                        <span className={`text-[10px] font-bold ${l.intent === "HOT" ? "text-lead-excellent" : l.intent === "WARM" ? "text-lead-medium" : "text-lead-low"}`}>
                          {l.score}
                        </span>
                      </div>
                      {l.title && <p className="text-[10px] text-text-muted truncate">{l.title}</p>}
                      {l.email && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            copyEmail(l.email);
                          }}
                          className="mt-1 text-[10px] font-medium text-lime hover:text-lime-dark"
                        >
                          {copy ? t("copied") : t("copyEmail")}
                        </button>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
