"use client";

import TopBar from "@/components/dashboard/TopBar";
import { useState } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, ShieldCheck, Plus, Trash2, History } from "lucide-react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc/client";

type FlagView = {
  id: string;
  value: string;
  type: string;
  source: string | null;
  contactId: string | null;
  createdAt: Date | string;
};

type AccessLogView = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: Date | string;
};

export default function CompliancePage() {
  const t = useTranslations("compliance");
  const TYPE_LABEL: Record<string, string> = {
    OPT_OUT: t("typeOptOut"),
    DO_NOT_CALL: t("typeDoNotCall"),
    SUPPRESSED: t("typeSuppressed"),
  };

  const ACTION_LABEL: Record<string, string> = {
    VERIFY: t("actionVerify"),
    MARK_INVALID: t("actionMarkInvalid"),
    RESET_VERIFICATION: t("actionResetVerification"),
    EXPORT: t("actionExport"),
    PURGE: t("actionPurge"),
  };
  const utils = trpc.useUtils();
  const [value, setValue] = useState("");
  const [type, setType] = useState<"OPT_OUT" | "DO_NOT_CALL" | "SUPPRESSED">("OPT_OUT");
  const [source, setSource] = useState("");
  const [checkValue, setCheckValue] = useState("");
  const [checkResult, setCheckResult] = useState<
    { ok: boolean; flags: FlagView[] } | null
  >(null);
  const [checking, setChecking] = useState(false);

  const flags = trpc.compliance.flags.useQuery(undefined, { retry: false });
  const createFlag = trpc.compliance.create.useMutation({
    onSuccess: () => {
      setValue("");
      setSource("");
      utils.compliance.flags.invalidate();
    },
  });
  const removeFlag = trpc.compliance.remove.useMutation({
    onSuccess: () => utils.compliance.flags.invalidate(),
  });
  const accessLogs = trpc.compliance.accessLogs.useQuery({}, { retry: false });

  const data = flags.data as unknown as FlagView[] | undefined;
  const logs = accessLogs.data as unknown as AccessLogView[] | undefined;

  const runCheck = async () => {
    const v = checkValue.trim();
    if (!v) return;
    setChecking(true);
    setCheckResult(null);
    try {
      const isEmail = v.includes("@");
      const res = (await utils.compliance.check.fetch(
        isEmail ? { email: v } : { phone: v }
      )) as unknown as FlagView[];
      setCheckResult({ ok: res.length === 0, flags: res });
    } catch {
      setCheckResult({ ok: false, flags: [] });
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      <TopBar title={t("title")} />
      <div className="flex-1 p-6 overflow-auto space-y-6">
        <div className="rounded-xl bg-lime/8 border border-border p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-lime-dark mb-1">
            {t("trustBadge")}
          </p>
          <h2 className="text-xl font-bold text-foreground">{t("registerTitle")}</h2>
          <p className="mt-1 text-sm text-text-secondary">
            {t("registerDesc")}
          </p>
        </div>

        <div className="rounded-xl bg-surface border border-border p-6">
          <h3 className="text-sm font-bold text-foreground mb-4">{t("addTitle")}</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                {t("emailOrPhone")}
              </label>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={t("emailOrPhonePlaceholder")}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-lime/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                {t("reason")}
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "OPT_OUT" | "DO_NOT_CALL" | "SUPPRESSED")}
                className="mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-lime/50"
              >
                <option value="OPT_OUT">{t("typeOptOut")}</option>
                <option value="DO_NOT_CALL">{t("typeDoNotCall")}</option>
                <option value="SUPPRESSED">{t("typeSuppressed")}</option>
              </select>
            </div>
            <div className="min-w-[180px]">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                {t("sourceLabel")}
              </label>
              <input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder={t("sourcePlaceholder")}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-lime/50"
              />
            </div>
            <button
              onClick={() => value.trim() && createFlag.mutate({ value: value.trim(), type, source: source.trim() || undefined })}
              disabled={!value.trim() || createFlag.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-lime hover:bg-lime-dark text-white font-semibold px-4 py-2 text-sm transition-colors disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {t("add")}
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-surface border border-border p-6">
          <h3 className="text-sm font-bold text-foreground mb-4">{t("checkTitle")}</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[240px]">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                {t("emailOrPhone")}
              </label>
              <input
                value={checkValue}
                onChange={(e) => setCheckValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runCheck()}
                placeholder={t("emailOrPhonePlaceholder")}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-lime/50"
              />
            </div>
            <button
              onClick={runCheck}
              disabled={!checkValue.trim() || checking}
              className="inline-flex items-center gap-2 rounded-lg bg-surface-elevated text-foreground font-semibold px-4 py-2 text-sm transition-colors hover:bg-lime/10 hover:text-lime-dark disabled:opacity-50"
            >
              <ShieldCheck className="h-4 w-4" />
              {checking ? t("checking") : t("check")}
            </button>
          </div>
          {checkResult && (
            <div
              className={`mt-3 rounded-lg p-3 text-sm ${
                checkResult.ok
                  ? "bg-lead-excellent/10 border border-lead-excellent/20 text-lead-excellent"
                  : "bg-lead-low/10 border border-lead-low/20 text-lead-low"
              }`}
            >
              {checkResult.ok ? (
                t("checkOk")
              ) : checkResult.flags.length > 0 ? (
                t("checkBlocked", {
                  flags: checkResult.flags.map((f) => TYPE_LABEL[f.type] ?? f.type).join(", "),
                })
              ) : (
                t("checkError")
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl bg-surface border border-border">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-lime-dark" />
              <h3 className="text-base font-bold text-foreground">{t("exclusionsTitle", { count: data?.length ?? 0 })}</h3>
            </div>
            <div className="divide-y divide-border">
              {(data ?? []).length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-text-muted">
                  {t("noExclusions")}
                </p>
              ) : (
                data?.map((flag, i) => (
                  <motion.div
                    key={flag.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="px-5 py-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{flag.value}</p>
                      <p className="text-[10px] text-text-muted">
                        {TYPE_LABEL[flag.type] ?? flag.type}
                        {flag.source ? ` · ${flag.source}` : ""} ·{" "}
                        {new Date(flag.createdAt).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <button
                      onClick={() => removeFlag.mutate({ id: flag.id })}
                      aria-label={t("removeExclusion")}
                      className="p-1.5 rounded-md text-text-muted hover:text-red-500 hover:bg-surface-elevated transition-colors shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl bg-surface border border-border">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <History className="h-4 w-4 text-lime-dark" />
              <h3 className="text-base font-bold text-foreground">{t("accessTitle")}</h3>
            </div>
            <div className="divide-y divide-border max-h-[400px] overflow-auto">
              {(logs ?? []).length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-text-muted">
                  {t("noAccess")}
                </p>
              ) : (
                logs?.map((log, i) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.01 }}
                    className="px-5 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ShieldCheck className="h-3.5 w-3.5 text-lime-dark shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {ACTION_LABEL[log.action] ?? log.action}
                        </p>
                        <p className="text-[10px] text-text-muted">
                          {log.entityType === "LEAD_BATCH"
                            ? t("entityItems", { count: log.entityId })
                            : log.entityType}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] text-text-muted shrink-0">
                      {new Date(log.createdAt).toLocaleString("fr-FR")}
                    </span>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
