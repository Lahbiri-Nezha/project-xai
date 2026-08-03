"use client";

import TopBar from "@/components/dashboard/TopBar";
import { Users, TrendingUp, Zap, ShieldCheck, ArrowUpRight, CheckCircle2, Bell } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc/client";

type TaskView = {
  id: string;
  stepIndex: number;
  nextStepAt: string | Date | null;
  status: string;
  lead: { id: string; firstName: string | null; lastName: string | null; email: string | null; score: number; intent: string };
  sequence: { id: string; name: string; steps: { id: string; order: number; channel: string; delayDays: number; template: string | null }[] };
};

type SavedSearchView = {
  id: string;
  name: string;
  newSinceNotified: number;
};

const intentColor = (intent: string) =>
  intent === "HOT"
    ? "text-lead-excellent"
    : intent === "WARM"
      ? "text-lead-medium"
      : "text-lead-low";

const pctChange = (last: number, prev: number): string | null => {
  if (prev <= 0) return last > 0 ? "+100%" : null;
  const pct = Math.round(((last - prev) / prev) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
};

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const stats = trpc.organization.getStats.useQuery();
  const me = trpc.organization.me.useQuery();
  const recent = trpc.lead.list.useQuery({ limit: 5 });
  const topCompanies = trpc.company.search.useQuery({ limit: 5 });
  const utils = trpc.useUtils();
  const tasks = trpc.sequence.getTasks.useQuery();
  const savedSearches = trpc.savedSearch.list.useQuery(undefined, { retry: false });
  const advanceTask = trpc.sequence.advanceTask.useMutation({
    onSuccess: () => {
      utils.sequence.getTasks.invalidate();
    },
  });

  const pendingTasks = ((tasks.data ?? []) as unknown as TaskView[])
    .filter((t) => t.status === "ACTIVE" || t.status === "PENDING")
    .sort((a, b) => {
      const da = a.nextStepAt ? new Date(a.nextStepAt).getTime() : Infinity;
      const db = b.nextStepAt ? new Date(b.nextStepAt).getTime() : Infinity;
      return da - db;
    })
    .slice(0, 5);

  const newResults = ((savedSearches.data ?? []) as unknown as SavedSearchView[])
    .filter((s) => s.newSinceNotified > 0)
    .slice(0, 4);

  const s = stats.data;
  const growth = s ? pctChange(s.newLeadsLast30d, s.newLeadsPrev30d) : null;

  const firstName = me.data?.userName?.split(" ")[0];

  const statCards = [
    { label: t("totalLeads"), value: s ? String(s.totalLeads) : "—", change: s && s.totalLeads > 0 ? (growth ?? t("new")) : t("new"), icon: Users, color: "text-lime" },
    { label: t("hotLeads"), value: s ? String(s.hotLeads) : "—", change: s && s.totalLeads > 0 ? t("pctOfPipeline", { pct: Math.round((s.hotLeads / s.totalLeads) * 100) }) : "—", icon: TrendingUp, color: "text-lead-excellent" },
    { label: t("avgScore"), value: s ? String(s.avgScore) : "—", change: t("average"), icon: Zap, color: "text-purple" },
    { label: t("verifiedContacts"), value: s ? String(s.verifiedLeads) : "—", change: s ? t("ofTotal", { total: s.totalLeads }) : "—", icon: ShieldCheck, color: "text-lead-medium" },
  ];

  const pipeline = [
    { stage: "HOT", count: s?.hotLeads ?? 0, pct: s && s.totalLeads > 0 ? Math.round((s.hotLeads / s.totalLeads) * 100) : 0, color: "bg-lead-excellent" },
    { stage: "WARM", count: s?.warmLeads ?? 0, pct: s && s.totalLeads > 0 ? Math.round((s.warmLeads / s.totalLeads) * 100) : 0, color: "bg-lead-medium" },
    { stage: "COLD", count: s?.coldLeads ?? 0, pct: s && s.totalLeads > 0 ? Math.round((s.coldLeads / s.totalLeads) * 100) : 0, color: "bg-lead-low" },
  ];

  const quickActions = [
    { label: "Prospector", desc: t("quickProspectorDesc"), icon: Zap, href: "/dashboard/prospector" },
    { label: t("navLeads"), desc: t("quickLeadsDesc"), icon: TrendingUp, href: "/dashboard/leads" },
    { label: t("quickCopilot"), desc: t("quickCopilotDesc"), icon: Users, href: "/dashboard/copilot" },
    { label: t("quickBilling"), desc: t("quickBillingDesc"), icon: ArrowUpRight, href: "/dashboard/settings/billing" },
  ];

  const channelLabel = (channel: string) =>
    channel === "EMAIL"
      ? tc("channelEmail")
      : channel === "CALL"
        ? tc("channelCall")
        : tc("channelTask");

  return (
    <>
      <TopBar title={t("navOverview")} />
      <div className="flex-1 p-6 space-y-6 overflow-auto">
        <div className="rounded-xl bg-gradient-to-r from-lime/8 to-surface border border-border p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-lime-dark mb-1">
            {t("kicker")}
          </p>
          <h2 className="text-2xl font-bold text-foreground">
            {firstName ? t("welcomeWithName", { name: firstName }) : t("welcomeGeneric")}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {me.data?.orgName
              ? t("orgActivity", { org: me.data.orgName })
              : t("pipelineActivity")}{" "}
            {s?.hotLeads ? t("hotLeadsAttention", { count: s.hotLeads }) : null}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.4 }}
              className="rounded-xl bg-surface border border-border p-5"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-text-secondary">{stat.label}</p>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <p className="text-3xl font-bold font-data text-foreground">{stat.value}</p>
                <span className="text-xs font-medium text-text-muted">{stat.change}</span>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl bg-surface border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-foreground">{t("intentDistribution")}</h2>
              <Link href="/dashboard/leads" className="text-xs font-medium text-lime hover:text-lime-dark flex items-center gap-1">
                {tc("viewAll")} <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-3">
              {pipeline.map((p) => (
                <div key={p.stage}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground">{p.stage}</span>
                    <span className="text-xs font-data font-bold text-text-secondary">{p.count} ({p.pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-elevated overflow-hidden">
                    <div className={`h-full rounded-full ${p.color}`} style={{ width: `${p.pct}%` }} />
                  </div>
                </div>
              ))}
              <p className="text-xs text-text-muted pt-2">
                {t("companiesTracked", { count: s?.totalCompanies ?? 0 })}
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-surface border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-foreground">{t("quickActions")}</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="rounded-lg bg-surface-elevated p-3.5 hover:bg-surface-elevated/60 transition-colors border border-border"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime/10 mb-2">
                    <action.icon className="h-4 w-4 text-lime-dark" />
                  </div>
                  <p className="text-xs font-semibold text-foreground">{action.label}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">{action.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl bg-surface border border-border">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-lime-dark" />
                {t("dayActions")}
              </h2>
              <Link href="/dashboard/sequences" className="text-xs font-medium text-lime hover:text-lime-dark">
                {t("sequencesLink")}
              </Link>
            </div>
            <div className="divide-y divide-border">
              {pendingTasks.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-text-muted">
                  {t("noFollowups")}
                </p>
              ) : (
                pendingTasks.map((task) => {
                  const step = task.sequence.steps[task.stepIndex];
                  return (
                    <div key={task.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {task.lead.firstName} {task.lead.lastName}
                        </p>
                        <p className="text-xs text-text-muted truncate">
                          {task.sequence.name} · {t("step", { n: task.stepIndex + 1 })} ·{" "}
                          {step ? channelLabel(step.channel) : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {task.nextStepAt ? (
                          <span className="text-[10px] font-medium text-text-muted">
                            {new Date(task.nextStepAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                          </span>
                        ) : null}
                        <button
                          onClick={() => advanceTask.mutate({ enrollmentId: task.id })}
                          className="inline-flex items-center rounded-lg bg-lime/10 px-2.5 py-1.5 text-xs font-semibold text-lime-dark hover:bg-lime/20 transition-colors"
                        >
                          {t("markDone")}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-xl bg-surface border border-border">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Bell className="h-4 w-4 text-lime-dark" />
                {t("newResults")}
              </h2>
              <Link href="/dashboard/saved-searches" className="text-xs font-medium text-lime hover:text-lime-dark">
                {t("savedSearchesLink")}
              </Link>
            </div>
            <div className="divide-y divide-border">
              {newResults.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-text-muted">
                  {t("noNewResults")}
                </p>
              ) : (
                newResults.map((s) => (
                  <Link
                    key={s.id}
                    href="/dashboard/saved-searches"
                    className="px-5 py-3.5 flex items-center justify-between hover:bg-surface-elevated transition-colors"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">{s.name}</p>
                      <p className="text-xs text-text-muted">{t("seeNewAccounts")}</p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-lime/10 px-2.5 py-1 text-xs font-bold font-data text-lime-dark">
                      +{s.newSinceNotified}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl bg-surface border border-border">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">{t("recentContacts")}</h2>
              <Link href="/dashboard/leads" className="text-xs font-medium text-lime hover:text-lime-dark">
                {tc("viewAll")} →
              </Link>
            </div>
            <div className="divide-y divide-border">
              {(recent.data?.leads ?? []).length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-text-muted">
                  {t("noContacts")}
                </p>
              ) : (
                recent.data?.leads.map((lead: {
                  id: string;
                  firstName: string | null;
                  lastName: string | null;
                  email: string | null;
                  score: number;
                  intent: string;
                  status: string;
                }) => (
                  <Link
                    key={lead.id}
                    href={`/dashboard/leads/${lead.id}`}
                    className="px-5 py-3.5 flex items-center justify-between hover:bg-surface-elevated transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-lime/10 flex items-center justify-center text-xs font-bold text-lime-dark">
                        {(lead.firstName?.[0] ?? "?") + (lead.lastName?.[0] ?? "")}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {lead.firstName} {lead.lastName}
                        </p>
                        <p className="text-xs text-text-muted">{lead.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-xs font-medium ${intentColor(lead.intent)}`}>
                        {lead.intent}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold font-data ${
                        lead.score >= 80 ? "bg-lead-excellent/10 text-lead-excellent" :
                        lead.score >= 50 ? "bg-lead-medium/10 text-lead-medium" :
                        "bg-lead-low/10 text-lead-low"
                      }`}>
                        {Math.round(lead.score)}
                      </span>
                      <span className="text-xs text-text-muted">{lead.status}</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl bg-surface border border-border">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">{t("priorityAccounts")}</h2>
              <Link href="/dashboard/prospector" className="text-xs font-medium text-lime hover:text-lime-dark">
                {t("prospectorLink")}
              </Link>
            </div>
            <div className="divide-y divide-border">
              {(topCompanies.data?.companies ?? []).length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-text-muted">{t("noAccounts")}</p>
              ) : (
                topCompanies.data?.companies.map((c: {
                  id: string;
                  name: string;
                  industry: string | null;
                  headquartersCity: string | null;
                  employeeCount: number | null;
                  fitScore: number;
                }) => (
                  <div key={c.id} className="px-5 py-3.5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{c.name}</p>
                      <p className="text-xs text-text-muted">
                        {c.industry ?? "—"} · {c.headquartersCity ?? "—"} ·{" "}
                        {c.employeeCount ? tc("employees", { count: c.employeeCount }) : "—"}
                      </p>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold font-data ${
                      c.fitScore >= 70 ? "bg-lead-excellent/10 text-lead-excellent" :
                      c.fitScore >= 40 ? "bg-lead-medium/10 text-lead-medium" :
                      "bg-lead-low/10 text-lead-low"
                    }`}>
                      {c.fitScore}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
