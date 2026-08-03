"use client";

import TopBar from "@/components/dashboard/TopBar";
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Download, Plus, Search, Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc/client";
import { triggerDownload } from "@/lib/download";

type ImportResult = {
  imported: number;
  errors: string[];
  remaining?: number;
};

type IntentFilter = "ALL" | "HOT" | "WARM" | "COLD";
type StatusFilter =
  | "ALL"
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "UNQUALIFIED"
  | "CONVERTED"
  | "LOST";
type LeadStatus = Exclude<StatusFilter, "ALL">;
const LEAD_STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "UNQUALIFIED", "CONVERTED", "LOST"];

function ConfidenceBadge({
  value,
  verified,
  label,
}: {
  value?: number | null;
  verified?: boolean;
  label: string;
}) {
  let cls = "bg-surface-elevated text-text-muted";
  if (verified) {
    cls = "bg-lead-excellent/10 text-lead-excellent";
  } else if (value != null && value >= 0.8) {
    cls = "bg-lead-excellent/10 text-lead-excellent";
  } else if (value != null && value >= 0.5) {
    cls = "bg-lead-medium/10 text-lead-medium";
  }
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {label} {verified ? "✓" : value != null ? `${Math.round(value * 100)}%` : ""}
    </span>
  );
}

const PAGE_SIZE = 50;

export default function LeadsPage() {
  const t = useTranslations("leads");
  const tc = useTranslations("common");
  const [intent, setIntent] = useState<IntentFilter>("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    title: "",
    companyName: "",
  });
  const [addFeedback, setAddFeedback] = useState<string | null>(null);
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);

  const createLead = trpc.lead.create.useMutation();

  const handleCreate = async () => {
    try {
      await createLead.mutateAsync({
        firstName: addForm.firstName || undefined,
        lastName: addForm.lastName || undefined,
        email: addForm.email || undefined,
        phone: addForm.phone || undefined,
        title: addForm.title || undefined,
        companyName: addForm.companyName || undefined,
      });
      setAddFeedback(t("leadAdded"));
      setShowAdd(false);
      setAddForm({ firstName: "", lastName: "", email: "", phone: "", title: "", companyName: "" });
      setPage(0);
      await utils.lead.list.invalidate();
      await utils.company.search.invalidate();
      setTimeout(() => setAddFeedback(null), 3000);
    } catch (e) {
      const message =
        typeof e === "object" && e && "message" in e
          ? String((e as { message: unknown }).message)
          : t("createFailed");
      setAddFeedback(message);
    }
  };

  const deleteLead = trpc.lead.delete.useMutation({
    onSuccess: async (res) => {
      setDeleteFeedback((res as { count: number }).count > 0 ? t("leadDeleted") : t("leadNotFound"));
      await utils.lead.list.invalidate();
      await utils.company.search.invalidate();
      setTimeout(() => setDeleteFeedback(null), 3000);
    },
    onError: (e) => setDeleteFeedback(e.message || t("deleteFailed")),
  });

  const changeStatus = trpc.lead.setStatus.useMutation({
    onSuccess: () => {
      utils.lead.list.invalidate();
    },
  });

  const { data, isFetching } = trpc.lead.list.useQuery({
    intent: intent === "ALL" ? undefined : intent,
    status: status === "ALL" ? undefined : status,
    title: search || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const resetPage = (fn: () => void) => {
    setPage(0);
    fn();
  };

  const onExportCsv = async () => {
    setExporting(true);
    setExportNote(null);
    try {
      const res = await utils.client.lead.exportCsv.query({
        intent: intent === "ALL" ? undefined : intent,
        status: status === "ALL" ? undefined : status,
        title: search || undefined,
      });
      triggerDownload({ url: res.url, csv: res.csv, fileName: "leads.csv" });
      setExportNote(
        `${t("exportedNote", { exported: res.exported })}${
          res.blocked > 0 ? t("blockedNote", { blocked: res.blocked }) : ""
        }`
      );
    } catch {
      setExportNote(t("exportFailed"));
    } finally {
      setExporting(false);
    }
  };

  const onImportFile = async (file: File) => {
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/import", { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImportError(json?.error ?? t("importFailed"));
        return;
      }
      setImportResult(json as ImportResult);
      setPage(0);
      await utils.lead.list.invalidate();
      await utils.company.search.invalidate();
    } catch {
      setImportError(t("importNetworkError"));
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <TopBar title={t("title")} />
      <div className="flex-1 p-6 space-y-4 overflow-auto">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {(["ALL", "HOT", "WARM", "COLD"] as IntentFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => resetPage(() => setIntent(f))}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  intent === f
                    ? "bg-lime text-ink"
                    : "bg-surface-elevated text-text-secondary hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
            <span className="mx-2 h-4 w-px bg-border" />
            {(["ALL", "NEW", "CONTACTED", "QUALIFIED", "UNQUALIFIED", "CONVERTED", "LOST"] as StatusFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => resetPage(() => setStatus(f))}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  status === f
                    ? "bg-lime/15 text-lime-dark"
                    : "text-text-muted hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <button
              onClick={() => setShowAdd((s) => !s)}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-secondary hover:text-foreground disabled:opacity-60 transition-colors"
            >
              <Plus className="h-4 w-4" />
              {t("add")}
            </button>
            <button
              onClick={onExportCsv}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-secondary hover:text-foreground disabled:opacity-60 transition-colors"
            >
              <Download className="h-4 w-4" />
              {exporting ? t("exporting") : t("export")}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="inline-flex items-center gap-2 rounded-lg bg-lime px-3 py-2 text-sm font-bold text-ink hover:bg-lime-dark disabled:opacity-60 transition-colors"
            >
              <Upload className="h-4 w-4" />
              {importing ? t("importing") : t("importCsv")}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImportFile(file);
              }}
            />
            <div className="relative w-full lg:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => resetPage(() => setSearch(e.target.value))}
                placeholder={t("searchByTitle")}
                className="w-full rounded-lg border border-border bg-surface pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-lime/50 focus:border-lime"
              />
            </div>
          </div>
        </div>

        {showAdd && (
          <div className="rounded-xl bg-surface border border-border p-4">
            <p className="text-sm font-bold text-foreground mb-3">{t("newLead")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {([
                ["firstName", t("firstName")],
                ["lastName", t("lastName")],
                ["email", t("email")],
                ["phone", t("phone")],
                ["title", t("title")],
                ["companyName", t("company")],
              ] as const).map(([key, label]) => (
                <div key={key}>
                  <label className="block text-xs text-text-muted mb-1">{label}</label>
                  <input
                    type={key === "email" ? "email" : "text"}
                    value={addForm[key]}
                    onChange={(e) => setAddForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-lime/50 focus:border-lime"
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-3">
              <button
                onClick={handleCreate}
                disabled={createLead.isPending || (!addForm.email && !addForm.companyName)}
                className="rounded-lg bg-lime px-4 py-2 text-sm font-bold text-ink hover:bg-lime-dark disabled:opacity-50 transition-colors"
              >
                {createLead.isPending ? t("creating") : t("createLead")}
              </button>
              <button
                onClick={() => setShowAdd(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-text-muted hover:text-foreground transition-colors"
              >
                {tc("cancel")}
              </button>
            </div>
          </div>
        )}

        {addFeedback && (
          <div className="rounded-xl bg-surface border border-border p-3 text-xs text-lead-excellent">
            {addFeedback}
          </div>
        )}

        {importResult && (
          <div className="rounded-xl bg-surface border border-border p-4">
            <p className="text-sm font-semibold text-foreground">
              {t("importedCount", { count: importResult.imported })}
              {importResult.remaining != null && (
                <span className="ml-2 text-xs font-normal text-text-muted">
                  {t("remainingQuota", { remaining: importResult.remaining })}
                </span>
              )}
            </p>
            {importResult.errors.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {importResult.errors.slice(0, 5).map((err, i) => (
                  <li key={i} className="text-xs text-lead-low">
                    {err}
                  </li>
                ))}
                {importResult.errors.length > 5 && (
                  <li className="text-xs text-text-muted">
                    {t("moreErrors", { count: importResult.errors.length - 5 })}
                  </li>
                )}
              </ul>
            )}
            <p className="mt-2 text-[11px] text-text-muted">
              {t("importFormatHint")}
            </p>
          </div>
        )}
        {importError && (
          <div className="rounded-xl bg-lead-low/10 border border-lead-low/30 p-4 text-sm text-lead-low">
            {importError}
          </div>
        )}
        {exportNote && (
          <div className="rounded-xl bg-surface border border-border p-3 text-xs text-text-secondary">
            {exportNote}
          </div>
        )}
        {deleteFeedback && (
          <div className="rounded-xl bg-surface border border-border p-3 text-xs text-text-secondary">
            {deleteFeedback}
          </div>
        )}

        <div className="rounded-xl bg-surface border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface-elevated/50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">{t("headerLead")}</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">{t("headerTitleCompany")}</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">{t("headerScore")}</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">{t("headerConfidence")}</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">{t("headerStatus")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isFetching && data === undefined ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i}>
                    <td className="px-5 py-4">
                      <div className="h-9 w-9 rounded-lg bg-surface-elevated animate-pulse" />
                    </td>
                    <td colSpan={4}>
                      <div className="h-4 w-48 bg-surface-elevated rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : (data?.leads.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-text-muted">
                    {t("noLeads")}
                  </td>
                </tr>
              ) : (
                data?.leads.map((lead: {
                  id: string;
                  firstName: string | null;
                  lastName: string | null;
                  email: string | null;
                  title: string | null;
                  score: number;
                  intent: string;
                  status: string;
                  confidenceEmail: number | null;
                  confidencePhone: number | null;
                  verification: string;
                  company: { name: string } | null;
                }, i) => (
                  <motion.tr
                    key={lead.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="hover:bg-surface-elevated/40 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <Link href={`/dashboard/leads/${lead.id}`} className="flex items-center gap-3 group">
                        <div className="h-9 w-9 rounded-lg bg-lime/10 flex items-center justify-center text-xs font-bold text-lime-dark">
                          {(lead.firstName?.[0] ?? "?") + (lead.lastName?.[0] ?? "")}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground group-hover:text-lime transition-colors">
                            {lead.firstName} {lead.lastName}
                          </p>
                          <p className="text-xs text-text-muted">{lead.email}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-xs font-medium text-foreground">{lead.title ?? "—"}</p>
                      <p className="text-[10px] text-text-muted">{lead.company?.name}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold font-data ${
                        lead.score >= 80 ? "bg-lead-excellent/10 text-lead-excellent" :
                        lead.score >= 50 ? "bg-lead-medium/10 text-lead-medium" :
                        "bg-lead-low/10 text-lead-low"
                      }`}>
                        {Math.round(lead.score)}
                      </span>
                      <span className={`ml-2 text-xs font-medium ${
                        lead.intent === "HOT" ? "text-lead-excellent" :
                        lead.intent === "WARM" ? "text-lead-medium" : "text-lead-low"
                      }`}>
                        {lead.intent}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        <ConfidenceBadge value={lead.confidenceEmail} verified={lead.verification === "VERIFIED"} label={tc("email")} />
                        <ConfidenceBadge value={lead.confidencePhone} label={tc("tel")} />
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <select
                          value={lead.status}
                          onChange={(e) =>
                            changeStatus.mutate({
                              id: lead.id,
                              status: e.target.value as LeadStatus,
                            })
                          }
                          disabled={changeStatus.isPending}
                          className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text-secondary focus:outline-none focus:ring-2 focus:ring-lime/40 disabled:opacity-50"
                        >
                          {LEAD_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            if (
                              window.confirm(
                                t("deleteConfirm")
                              )
                            ) {
                              deleteLead.mutate({ id: lead.id });
                            }
                          }}
                          disabled={deleteLead.isPending}
                          className="p-1.5 rounded-md text-text-muted hover:text-lead-low hover:bg-lead-low/10 transition-colors"
                          title={tc("delete")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
          {data && data.total > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-border px-5 py-3">
              <span className="text-xs text-text-muted">
                {t("totalCount", { count: data.total })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-foreground disabled:opacity-40 transition-colors"
                >
                  ← {tc("prev")}
                </button>
                <span className="text-xs text-text-muted">
                  {t("pageInfo", { page: page + 1, total: totalPages })}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-foreground disabled:opacity-40 transition-colors"
                >
                  {tc("next")} →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
