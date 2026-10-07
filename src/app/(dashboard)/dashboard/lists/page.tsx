"use client";

import TopBar from "@/components/dashboard/TopBar";
import { useState } from "react";
import { motion } from "framer-motion";
import { ListIcon, Plus, Trash2, X, Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc/client";
import { triggerDownload } from "@/lib/download";

type ItemView = {
  id: string;
  lead: { id: string; firstName: string | null; lastName: string | null; email: string | null; score: number; intent: string } | null;
  company: { id: string; name: string } | null;
};

type ListView = {
  id: string;
  name: string;
  type: string;
  items: ItemView[];
};

export default function ListsPage() {
  const t = useTranslations("lists");
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [type, setType] = useState<"LEADS" | "ACCOUNTS">("LEADS");

  const lists = trpc.list.list.useQuery(undefined, { retry: false });
  const createList = trpc.list.create.useMutation({
    onSuccess: () => {
      setName("");
      utils.list.list.invalidate();
    },
  });
  const deleteList = trpc.list.delete.useMutation({
    onSuccess: () => utils.list.list.invalidate(),
  });
  const removeItem = trpc.list.removeItem.useMutation({
    onSuccess: () => utils.list.list.invalidate(),
  });
  const [exportingId, setExportingId] = useState<string | null>(null);

  const handleExport = async (listId: string) => {
    setExportingId(listId);
    try {
      const res = await utils.client.list.exportCsv.query({ id: listId });
      triggerDownload({
        url: res.url,
        csv: res.csv,
        fileName: `${res.listName.replace(/[^a-z0-9-_]/gi, "_")}.csv`,
      });
    } finally {
      setExportingId(null);
    }
  };

  const data = lists.data as unknown as ListView[] | undefined;

  return (
    <>
      <TopBar title={t("title")} />
      <div className="flex-1 p-6 overflow-auto space-y-6">
        <div className="rounded-xl bg-surface border border-border p-6">
          <h3 className="text-sm font-bold text-foreground mb-4">{t("newList")}</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{t("name")}</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{t("type")}</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "LEADS" | "ACCOUNTS")}
                className="mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/50"
              >
                <option value="LEADS">{t("typeLeads")}</option>
                <option value="ACCOUNTS">{t("typeAccounts")}</option>
              </select>
            </div>
            <button
              onClick={() => name.trim() && createList.mutate({ name: name.trim(), type })}
              disabled={!name.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-brand hover:bg-brand-strong text-white font-semibold px-4 py-2 text-sm transition-colors disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {t("create")}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data?.map((list, i) => (
            <motion.div
              key={list.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-xl bg-surface border border-border p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
                    <ListIcon className="h-4 w-4 text-brand-strong" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{list.name}</p>
                    <p className="text-[10px] text-text-muted">
                      {list.type === "LEADS" ? t("typeLeads") : t("typeAccounts")} ·{" "}
                      {t("itemCount", { count: list.items.length })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleExport(list.id)}
                    disabled={exportingId === list.id}
                    aria-label={t("exportLabel")}
                    title={t("exportTitle")}
                    className="p-1.5 rounded-md text-text-muted hover:text-brand-strong hover:bg-surface-elevated transition-colors disabled:opacity-40"
                  >
                    <Download className={`h-4 w-4 ${exportingId === list.id ? "animate-pulse" : ""}`} />
                  </button>
                  <button
                    onClick={() => deleteList.mutate({ id: list.id })}
                    aria-label={t("deleteListLabel")}
                    className="p-1.5 rounded-md text-text-muted hover:text-red-500 hover:bg-surface-elevated transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {list.items.length === 0 ? (
                <p className="mt-4 text-xs text-text-muted">
                  {t("emptyList")}
                </p>
              ) : (
                <div className="mt-4 space-y-1.5">
                  {list.items.slice(0, 8).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-surface-elevated px-3 py-2"
                    >
                      {item.lead ? (
                        <>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">
                              {item.lead.firstName} {item.lead.lastName}
                            </p>
                            <p className="text-[10px] text-text-muted truncate">{item.lead.email}</p>
                          </div>
                          <span className={`text-[10px] font-bold font-data ${item.lead.intent === "HOT" ? "text-lead-excellent" : item.lead.intent === "WARM" ? "text-lead-medium" : "text-lead-low"}`}>
                            {item.lead.score}
                          </span>
                        </>
                      ) : (
                        <>
                          <p className="text-xs font-medium text-foreground truncate">{item.company?.name}</p>
                          <span className="text-[10px] text-text-muted">{t("accountBadge")}</span>
                        </>
                      )}
                      <button
                        onClick={() => removeItem.mutate({ listId: list.id, itemId: item.id })}
                        aria-label={t("removeLabel")}
                        className="p-1 rounded-md text-text-muted hover:text-red-500 transition-colors shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {list.items.length > 8 && (
                    <p className="text-[10px] text-text-muted">{t("moreItems", { count: list.items.length - 8 })}</p>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {data && data.length === 0 && (
          <div className="rounded-xl bg-surface border border-border p-12 text-center">
            <p className="text-sm text-text-muted">{t("noLists")}</p>
          </div>
        )}
      </div>
    </>
  );
}
