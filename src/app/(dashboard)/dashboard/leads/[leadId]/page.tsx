"use client";

import TopBar from "@/components/dashboard/TopBar";
import { motion } from "framer-motion";
import { ArrowLeft, RefreshCw, ShieldCheck, ShieldAlert, BadgeCheck, History, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc/client";

interface ScoreFactor {
  name?: string;
  weight?: number;
  contribution?: number;
  explanation?: string;
}

type Signal = { id: string; type: string; value: string; weight: number };
type Activity = { id: string; type: string; createdAt: Date | string };
type DataSource = { id: string; kind: string; url: string | null; fetchedAt: Date | string };
type Enrollment = { id: string; status: string; sequence: { name: string } };
type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "UNQUALIFIED" | "CONVERTED" | "LOST";
const LEAD_STATUSES: LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "UNQUALIFIED",
  "CONVERTED",
  "LOST",
];
type AccessLogView = {
  id: string;
  action: string;
  userId: string;
  entityType: string;
  entityId: string;
  createdAt: Date | string;
};
type CompanyView = {
  id: string;
  name: string;
  industry: string | null;
  employeeCount: number | null;
  headquartersCity: string | null;
  headquartersCountry: string | null;
  fundingStage: string | null;
  techStack: string[];
};
type LeadView = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  title: string | null;
  score: number;
  intent: string;
  verification: string;
  status: string;
  source: string | null;
  lastEnrichedAt: Date | string | null;
  confidenceEmail: number | null;
  confidencePhone: number | null;
  confidenceTitle: number | null;
  scoreExplainability: { factors?: ScoreFactor[]; explanation?: string } | null;
  company: CompanyView | null;
  signals: Signal[];
  activities: Activity[];
  dataSources: DataSource[];
  enrollments: Enrollment[];
};

function ConfidenceRow({
  label,
  value,
  verified,
}: {
  label: string;
  value?: number | null;
  verified?: boolean;
}) {
  const t = useTranslations("leadDetail");
  const v = verified ? 100 : value != null ? Math.round(value * 100) : 0;
  const color =
    verified || v >= 80
      ? "bg-lead-excellent"
      : v >= 50
        ? "bg-lead-medium"
        : "bg-lead-low";
  const text = verified
    ? t("verifiedManual")
    : v >= 80
      ? t("confidenceHigh")
      : v >= 50
        ? t("confidenceMedium")
        : t("confidenceLow");
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-text-muted">{label}</span>
        <span className="text-xs font-semibold text-foreground">
          {verified ? "100%" : value != null ? `${Math.round(value * 100)}%` : "—"}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-elevated overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${v}%` }} />
      </div>
      <p className="mt-1 text-[10px] text-text-muted">{text}</p>
    </div>
  );
}

export default function LeadDetailPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = use(params);
  const router = useRouter();
  const t = useTranslations("leadDetail");
  const tc = useTranslations("common");

  const { data: rawLead, isLoading } = trpc.lead.getById.useQuery({ id: leadId });
  const lead = rawLead as unknown as LeadView | undefined;
  const utils = trpc.useUtils();
  const rescore = trpc.lead.rescore.useMutation({
    onSuccess: () => utils.lead.getById.invalidate({ id: leadId }),
  });
  const setVerification = trpc.lead.setVerification.useMutation({
    onSuccess: () => {
      utils.lead.getById.invalidate({ id: leadId });
      utils.compliance.accessLogs.invalidate({ entityType: "LEAD", entityId: leadId });
    },
  });
  const setStatus = trpc.lead.setStatus.useMutation({
    onSuccess: () => {
      utils.lead.getById.invalidate({ id: leadId });
      utils.lead.list.invalidate();
    },
  });
  const deleteLead = trpc.lead.delete.useMutation({
    onSuccess: (res) => {
      if ((res as { count: number }).count > 0) {
        router.push("/dashboard/leads");
      }
    },
  });
  const { data: rawLogs } = trpc.compliance.accessLogs.useQuery(
    { entityType: "LEAD", entityId: leadId },
    { retry: false }
  );
  const accessLogs = (rawLogs ?? []) as unknown as AccessLogView[];

  if (isLoading) {
    return (
      <>
        <TopBar title={t("loadingTitle")} />
        <div className="flex-1 p-6 space-y-6">
          <div className="h-16 bg-surface rounded-xl animate-pulse" />
          <div className="h-96 bg-surface rounded-xl animate-pulse" />
        </div>
      </>
    );
  }

  if (!lead) {
    return (
      <>
        <TopBar title={t("loadingTitle")} />
        <div className="flex-1 p-12 text-center">
          <p className="text-sm text-text-muted">{t("notFound")}</p>
        </div>
      </>
    );
  }

  const factors = (lead.scoreExplainability as { factors?: ScoreFactor[] } | null)?.factors ?? [];
  const explanation = lead.scoreExplainability?.explanation ?? null;
  const verified = lead.verification === "VERIFIED";

  return (
    <>
      <TopBar title={t("loadingTitle")} />
      <div className="flex-1 p-6 overflow-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/leads"
            className="p-2 rounded-lg hover:bg-surface-elevated transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-text-secondary" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-foreground truncate">
                {lead.firstName} {lead.lastName}
              </h2>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                  verified
                    ? "bg-lead-excellent/10 text-lead-excellent"
                    : "bg-surface-elevated text-text-muted"
                }`}
              >
                {verified ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                {verified ? t("verified") : lead.verification}
              </span>
            </div>
            <p className="text-sm text-text-secondary truncate">
              {lead.email} &middot; {lead.title} &middot; {lead.company?.name}
            </p>
          </div>
          <button
            onClick={() => rescore.mutate({ id: leadId })}
            disabled={rescore.isPending}
            className="flex items-center gap-2 bg-lime/10 text-lime-dark px-4 py-2 rounded-lg text-sm font-medium hover:bg-lime/20 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${rescore.isPending ? "animate-spin" : ""}`} />
            {t("rescore")}
          </button>
          <button
            onClick={() => setVerification.mutate({ id: leadId, verification: "VERIFIED" })}
            disabled={setVerification.isPending || verified}
            className="flex items-center gap-2 bg-surface-elevated text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-lime/10 hover:text-lime-dark transition-colors disabled:opacity-40"
          >
            <BadgeCheck className="h-4 w-4" />
            {verified ? t("verified") : t("verify")}
          </button>
          <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
            <span className="text-xs text-text-muted">{t("statusLabel")}</span>
            <select
              value={lead.status}
              onChange={(e) => setStatus.mutate({ id: leadId, status: e.target.value as LeadStatus })}
              disabled={setStatus.isPending}
              className="bg-transparent text-sm font-medium text-foreground focus:outline-none disabled:opacity-50"
            >
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => {
              if (window.confirm(t("deleteConfirm"))) {
                deleteLead.mutate({ id: leadId });
              }
            }}
            disabled={deleteLead.isPending}
            className="flex items-center gap-2 bg-lead-low/10 text-lead-low px-4 py-2 rounded-lg text-sm font-medium hover:bg-lead-low/20 transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {t("delete")}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-surface border border-border p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold text-foreground">{t("scoreExplainability")}</h3>
                <span className={`text-xs font-bold ${lead.intent === "HOT" ? "text-lead-excellent" : lead.intent === "WARM" ? "text-lead-medium" : "text-lead-low"}`}>
                  {lead.intent}
                </span>
              </div>
              <div className="flex items-end gap-4 mb-6">
                <div className="text-5xl font-bold font-data text-lime-dark">
                  {Math.round(lead.score)}
                </div>
                <div className="pb-1">
                  <p className="text-xs font-semibold text-foreground">{t("priorityScore")}</p>
                  <p className="text-[10px] text-text-muted">{t("scoreComputedBy")}</p>
                </div>
              </div>
              {explanation && (
                <div className="mb-6 rounded-lg bg-lime/5 border border-lime/20 p-4">
                  <p className="text-xs leading-relaxed text-foreground">
                    <span className="font-bold text-lime-dark">{t("whyPriority")}</span>
                    {explanation}
                  </p>
                </div>
              )}
              {factors.length === 0 ? (
                <p className="text-xs text-text-muted">
                  {t("noFactors")}
                </p>
              ) : (
                <div className="space-y-3">
                  {factors.map((factor) => (
                    <div key={factor.name ?? "factor"}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-foreground">{factor.name}</span>
                        <span className="text-xs font-bold font-data text-lime-dark">
                          {factor.contribution != null ? Math.round(factor.contribution) : "—"}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-surface-elevated overflow-hidden">
                        <div
                          className="h-full rounded-full bg-lime"
                          style={{ width: `${Math.min(100, factor.contribution ?? 0)}%` }}
                        />
                      </div>
                      {factor.explanation && (
                        <p className="mt-1 text-[10px] text-text-muted">{factor.explanation}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            <div className="rounded-xl bg-surface border border-border p-6">
              <h3 className="text-sm font-bold text-foreground mb-4">{t("fieldConfidence")}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <ConfidenceRow
                  label={tc("email")}
                  value={lead.confidenceEmail}
                  verified={verified && !!lead.email}
                />
                <ConfidenceRow label={t("phone")} value={lead.confidencePhone} />
                <ConfidenceRow label={t("position")} value={lead.confidenceTitle} />
              </div>
              <p className="mt-4 text-[10px] text-text-muted">
                {t("sourceInfo", {
                  source: lead.source ?? t("unknownSource"),
                  date: lead.lastEnrichedAt
                    ? new Date(lead.lastEnrichedAt).toLocaleDateString("fr-FR")
                    : "—",
                })}
              </p>
            </div>

            <div className="rounded-xl bg-surface border border-border p-6">
              <h3 className="text-sm font-bold text-foreground mb-4">{t("buyingSignals")}</h3>
              {lead.signals.length === 0 ? (
                <p className="text-xs text-text-muted">{t("noSignals")}</p>
              ) : (
                <div className="space-y-3">
                  {lead.signals.map((signal) => (
                    <div
                      key={signal.id}
                      className="flex items-center justify-between rounded-lg bg-surface-elevated p-3"
                    >
                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          {signal.type.replace("_", " ")}
                        </p>
                        <p className="text-[10px] text-text-muted">{signal.value}</p>
                      </div>
                      <span className="text-xs font-bold font-data text-lime-dark">
                        x{signal.weight}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {lead.activities.length > 0 && (
              <div className="rounded-xl bg-surface border border-border p-6">
                <h3 className="text-sm font-bold text-foreground mb-4">{t("activity")}</h3>
                <div className="space-y-2">
                  {lead.activities.map((a) => (
                    <div key={a.id} className="flex justify-between text-xs">
                      <span className="text-foreground font-medium">{a.type}</span>
                      <span className="text-text-muted">
                        {new Date(a.createdAt).toLocaleString("fr-FR")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {lead.company && (
              <div className="rounded-xl bg-surface border border-border p-6">
                <h3 className="text-sm font-bold text-foreground mb-4">{t("company")}</h3>
                <div className="space-y-3">
                  {[
                    { label: t("companyIndustry"), value: lead.company.industry ?? "—" },
                    { label: t("companyEmployees"), value: lead.company.employeeCount ? String(lead.company.employeeCount) : "—" },
                    { label: t("companyLocation"), value: [lead.company.headquartersCity, lead.company.headquartersCountry].filter(Boolean).join(", ") || "—" },
                    { label: t("companyFunding"), value: lead.company.fundingStage ?? "—" },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between gap-2">
                      <span className="text-xs text-text-muted">{item.label}</span>
                      <span className="text-xs font-semibold text-foreground text-right">{item.value}</span>
                    </div>
                  ))}
                </div>
                {lead.company.techStack.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-text-muted mb-2">{t("techStack")}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {lead.company.techStack.map((tech) => (
                        <span
                          key={tech}
                          className="inline-flex items-center rounded-md bg-lime/10 px-2 py-0.5 text-[10px] font-medium text-lime-dark"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-xl bg-surface border border-border p-6">
              <h3 className="text-sm font-bold text-foreground mb-4">{t("aiRecommendation")}</h3>
              <div className="rounded-lg bg-lime/5 border border-lime/15 p-4">
                <p className="text-xs leading-relaxed text-text-secondary">
                  {lead.score >= 70
                    ? t("recHigh", { score: Math.round(lead.score), count: lead.signals.length })
                    : lead.score >= 40
                      ? t("recMedium", { score: Math.round(lead.score) })
                      : t("recLow")}
                </p>
              </div>
            </div>

            {lead.enrollments.length > 0 && (
              <div className="rounded-xl bg-surface border border-border p-6">
                <h3 className="text-sm font-bold text-foreground mb-4">{t("sequences")}</h3>
                {lead.enrollments.map((e) => (
                  <div key={e.id} className="flex justify-between items-center text-xs">
                    <span className="text-foreground font-medium">{e.sequence.name}</span>
                    <span className="text-text-muted">{e.status}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xl bg-surface border border-border p-6">
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <History className="h-4 w-4 text-lime-dark" />
                {t("accessLog")}
              </h3>
              {accessLogs.length === 0 ? (
                <p className="text-xs text-text-muted">{t("noAccessLogs")}</p>
              ) : (
                <div className="space-y-2">
                  {accessLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between rounded-lg bg-surface-elevated px-3 py-2"
                    >
                      <span className="text-xs font-medium text-foreground">{log.action}</span>
                      <span className="text-[10px] text-text-muted">
                        {new Date(log.createdAt).toLocaleString("fr-FR")}
                      </span>
                    </div>
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
