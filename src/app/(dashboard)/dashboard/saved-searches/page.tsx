"use client";

import TopBar from "@/components/dashboard/TopBar";
import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Trash2, Eye, Bell, Pencil, Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc/client";

type SavedSearchView = {
  id: string;
  name: string;
  filtersJson: unknown;
  notifyFrequency: string;
  lastResultCount: number;
  newSinceNotified: number;
};

type CompanyPreview = {
  id: string;
  name: string;
  industry: string | null;
  headquartersCity: string | null;
  employeeCount: number | null;
  fitScore: number;
};

export default function SavedSearchesPage() {
  const t = useTranslations("savedSearches");
  const tc = useTranslations("common");
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [city, setCity] = useState("");
  const [notifyFrequency, setNotifyFrequency] = useState<"daily" | "weekly" | "never">("daily");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editFrequency, setEditFrequency] = useState<"daily" | "weekly" | "never">("daily");

  const searches = trpc.savedSearch.list.useQuery(undefined, { retry: false });
  const createSearch = trpc.savedSearch.create.useMutation({
    onSuccess: () => {
      setName("");
      setIndustry("");
      setCity("");
      utils.savedSearch.list.invalidate();
    },
  });
  const updateSearch = trpc.savedSearch.update.useMutation({
    onSuccess: () => {
      setEditingId(null);
      utils.savedSearch.list.invalidate();
    },
  });
  const deleteSearch = trpc.savedSearch.delete.useMutation({
    onSuccess: () => utils.savedSearch.list.invalidate(),
  });
  const acknowledge = trpc.savedSearch.acknowledge.useMutation({
    onSuccess: () => utils.savedSearch.list.invalidate(),
  });
  const runSearch = trpc.savedSearch.run.useQuery(
    { id: previewId ?? "" },
    { enabled: !!previewId, retry: false }
  );

  const data = searches.data as unknown as SavedSearchView[] | undefined;
  const preview = runSearch.data as unknown as {
    total: number;
    companies: CompanyPreview[];
  } | undefined;

  const save = () => {
    if (!name.trim()) return;
    createSearch.mutate({
      name: name.trim(),
      filters: {
        industry: industry.trim() || undefined,
        city: city.trim() || undefined,
      },
      notifyFrequency,
    });
  };

  return (
    <>
      <TopBar title={t("title")} />
      <div className="flex-1 p-6 overflow-auto space-y-6">
        <div className="rounded-xl bg-surface border border-border p-6">
          <h3 className="text-sm font-bold text-foreground mb-4">{t("newSearch")}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{t("name")}</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-lime/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{t("industry")}</label>
              <input
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder={t("industryPlaceholder")}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-lime/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{t("city")}</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={t("cityPlaceholder")}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-lime/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{t("notification")}</label>
              <select
                value={notifyFrequency}
                onChange={(e) => setNotifyFrequency(e.target.value as "daily" | "weekly" | "never")}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-lime/50"
              >
                <option value="daily">{t("freqDaily")}</option>
                <option value="weekly">{t("freqWeekly")}</option>
                <option value="never">{t("freqNever")}</option>
              </select>
            </div>
          </div>
          <button
            onClick={save}
            disabled={!name.trim()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-lime hover:bg-lime-dark text-white font-semibold px-4 py-2 text-sm transition-colors disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {t("save")}
          </button>
        </div>

        <div className="space-y-3">
          {data?.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-xl bg-surface border border-border p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-lime/10 flex items-center justify-center shrink-0">
                    <Search className="h-4 w-4 text-lime-dark" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                      {s.newSinceNotified > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-lime/15 text-lime-dark px-2 py-0.5 text-[10px] font-bold">
                          <Bell className="h-3 w-3" />
                          {t("newBadge", { count: s.newSinceNotified })}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      {t("resultCount", { count: s.lastResultCount })} ·{" "}
                      {t("notifyInfo", {
                        freq:
                          s.notifyFrequency === "daily"
                            ? t("freqInfoDaily")
                            : s.notifyFrequency === "weekly"
                              ? t("freqInfoWeekly")
                              : t("freqInfoNever"),
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {editingId === s.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-40 rounded-lg border border-border bg-surface px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-lime/50"
                      />
                      <select
                        value={editFrequency}
                        onChange={(e) => setEditFrequency(e.target.value as "daily" | "weekly" | "never")}
                        className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-foreground focus:outline-none"
                      >
                        <option value="daily">{t("freqDaily")}</option>
                        <option value="weekly">{t("freqWeekly")}</option>
                        <option value="never">{t("freqNever")}</option>
                      </select>
                      <button
                        onClick={() =>
                          updateSearch.mutate({
                            id: s.id,
                            name: editName.trim() || s.name,
                            notifyFrequency: editFrequency,
                          })
                        }
                        disabled={updateSearch.isPending}
                        aria-label={t("editSave")}
                        className="p-1.5 rounded-md text-lime-dark hover:bg-surface-elevated transition-colors"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        aria-label={t("editCancel")}
                        className="p-1.5 rounded-md text-text-muted hover:text-foreground hover:bg-surface-elevated transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditingId(s.id);
                          setEditName(s.name);
                          setEditFrequency(
                            (s.notifyFrequency === "daily" || s.notifyFrequency === "weekly" || s.notifyFrequency === "never"
                              ? s.notifyFrequency
                              : "daily") as "daily" | "weekly" | "never"
                          );
                        }}
                        aria-label={t("editModify")}
                        className="p-1.5 rounded-md text-text-muted hover:text-lime-dark hover:bg-surface-elevated transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setPreviewId(previewId === s.id ? null : s.id);
                          if (s.newSinceNotified > 0) acknowledge.mutate({ id: s.id });
                        }}
                        aria-label={t("editPreview")}
                        className="p-1.5 rounded-md text-text-muted hover:text-lime-dark hover:bg-surface-elevated transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteSearch.mutate({ id: s.id })}
                        aria-label={t("editDelete")}
                        className="p-1.5 rounded-md text-text-muted hover:text-red-500 hover:bg-surface-elevated transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {previewId === s.id && (
                <div className="mt-4 border-t border-border pt-4">
                  {runSearch.isLoading ? (
                    <p className="text-xs text-text-muted">{t("running")}</p>
                  ) : (
                    <>
                      <p className="text-xs font-semibold text-foreground mb-2">
                        {t("matchCount", { count: preview?.total ?? 0 })}
                      </p>
                      <div className="space-y-1.5">
                        {preview?.companies.map((c) => (
                          <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg bg-surface-elevated px-3 py-2">
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">{c.name}</p>
                              <p className="text-[10px] text-text-muted truncate">
                                {c.industry ?? "—"} · {c.headquartersCity ?? "—"} · {c.employeeCount ?? "?"} {tc("employees")}
                              </p>
                            </div>
                            <span className={`text-[10px] font-bold font-data ${c.fitScore >= 70 ? "text-lead-excellent" : c.fitScore >= 40 ? "text-lead-medium" : "text-lead-low"}`}>
                              {t("fitScore", { score: c.fitScore })}
                            </span>
                          </div>
                        ))}
                        {preview?.companies.length === 0 && (
                          <p className="text-xs text-text-muted">{t("noResults")}</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {data && data.length === 0 && (
          <div className="rounded-xl bg-surface border border-border p-12 text-center">
            <p className="text-sm text-text-muted">{t("noSearches")}</p>
          </div>
        )}
      </div>
    </>
  );
}
