"use client";

import TopBar from "@/components/dashboard/TopBar";
import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Search,
  Building2,
  Users,
  ChevronDown,
  Sparkles,
  Download,
  RotateCcw,
  ListPlus,
  Timer,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc/client";
import { triggerDownload } from "@/lib/download";
import { SIGNAL_TYPES } from "@/lib/ai/interpret";

type Tab = "accounts" | "contacts";

function intentColor(intent: string) {
  if (intent === "HOT") return "text-lead-excellent";
  if (intent === "WARM") return "text-lead-medium";
  return "text-lead-low";
}

function ConfidenceBadge({
  value,
  verified,
  label,
  verifiedLabel,
}: {
  value?: number | null;
  verified?: boolean;
  label: string;
  verifiedLabel: string;
}) {
  let cls = "bg-surface-elevated text-text-muted";
  let text = `${label} — ${value != null ? Math.round(value * 100) : "?"}%`;
  if (verified) {
    cls = "bg-lead-excellent/10 text-lead-excellent";
    text = `${label} — ${verifiedLabel}`;
  } else if (value != null && value >= 0.8) {
    cls = "bg-lead-excellent/10 text-lead-excellent";
  } else if (value != null && value >= 0.5) {
    cls = "bg-lead-medium/10 text-lead-medium";
  }
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {text}
    </span>
  );
}

function FilterBlock({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border py-3">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between text-xs font-semibold text-foreground"
      >
        {title}
        <ChevronDown
          className={`h-3.5 w-3.5 text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="mt-3 space-y-2">{children}</div>}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-lime/50 focus:border-lime";

export default function ProspectorPage() {
  const t = useTranslations("prospector");
  const tc = useTranslations("common");

  const signalLabels: Record<(typeof SIGNAL_TYPES)[number], string> = {
    FUNDING: t("signalFunding"),
    HIRING: t("signalHiring"),
    WEBSITE_VISIT: t("signalWebsite"),
    EMAIL_OPEN: t("signalEmailOpen"),
    PRICING_PAGE: t("signalPricing"),
    TECH_MATCH: t("signalTechMatch"),
    CONTENT_DOWNLOAD: t("signalDownload"),
    MEETING_BOOKED: t("signalMeeting"),
    NEWS: t("signalNews"),
    ORG_CHANGE: t("signalOrgChange"),
  };

  const [tab, setTab] = useState<Tab>("accounts");
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");

  // Filtres comptes
  const [employeesMin, setEmployeesMin] = useState("");
  const [employeesMax, setEmployeesMax] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [industry, setIndustry] = useState("");
  const [techText, setTechText] = useState("");
  const [signals, setSignals] = useState<(typeof SIGNAL_TYPES)[number][]>([]);
  const [openBlocks, setOpenBlocks] = useState<Record<string, boolean>>({
    employees: true,
    location: true,
    industry: true,
    tech: true,
    signals: true,
  });

  // Filtres contacts
  const [leadIntent, setLeadIntent] = useState<string>("ALL");
  const [leadTitle, setLeadTitle] = useState("");
  const [leadCompany, setLeadCompany] = useState("");
  const [leadCity, setLeadCity] = useState("");
  const [leadHasEmail, setLeadHasEmail] = useState(false);

  // Sélection multiple
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkMenu, setBulkMenu] = useState<"none" | "list" | "sequence">("none");
  const [bulkFeedback, setBulkFeedback] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const { data: rawLists } = trpc.list.list.useQuery();
  const { data: rawSequences } = trpc.sequence.list.useQuery();
  const lists = (rawLists ?? []) as unknown as { id: string; name: string }[];
  const sequences = (rawSequences ?? []) as unknown as { id: string; name: string }[];

  const addItems = trpc.list.addItems.useMutation({
    onSuccess: (res) => {
      setBulkFeedback(t("addedToList", { added: (res as { added: number }).added }));
      setBulkMenu("none");
      setSelected([]);
      utils.list.list.invalidate();
    },
    onError: (e) => setBulkFeedback(e.message || t("addToListError")),
  });

  const enroll = trpc.sequence.enroll.useMutation({
    onSuccess: (res) => {
      const s = (res as { summary: { enrolled: number; blocked: number } }).summary;
      setBulkFeedback(
        `${t("enrolledOk", { enrolled: s.enrolled })}${
          s.blocked > 0 ? t("blockedCompliance", { blocked: s.blocked }) : ""
        }`
      );
      setBulkMenu("none");
      setSelected([]);
      utils.sequence.list.invalidate();
    },
    onError: (e) => setBulkFeedback(e.message || t("enrollError")),
  });

  const toggleSelect = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const runBulkList = (listId: string) =>
    addItems.mutate(
      tab === "accounts"
        ? { listId, companyIds: selected }
        : { listId, leadIds: selected }
    );

  const runBulkEnroll = (sequenceId: string) =>
    enroll.mutate({ sequenceId, leadIds: selected });

  const accountsQuery = trpc.company.search.useQuery(
    {
      query: submittedQuery || undefined,
      filters: {
        employeesMin: employeesMin ? Number(employeesMin) : undefined,
        employeesMax: employeesMax ? Number(employeesMax) : undefined,
        city: city || undefined,
        country: country || undefined,
        industry: industry || undefined,
        techStack: techText
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        signalTypes: signals.length ? signals : undefined,
      },
      limit: 25,
    },
    { enabled: tab === "accounts" }
  );

  const contactsQuery = trpc.lead.list.useQuery(
    {
      intent:
        leadIntent === "ALL"
          ? undefined
          : (leadIntent as "HOT" | "WARM" | "COLD"),
      title: leadTitle || undefined,
      companyName: leadCompany || undefined,
      city: leadCity || undefined,
      hasEmail: leadHasEmail || undefined,
      limit: 25,
    },
    { enabled: tab === "contacts" }
  );

  const toggleSignal = (s: (typeof SIGNAL_TYPES)[number]) => {
    setSignals((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const resetFilters = () => {
    setEmployeesMin("");
    setEmployeesMax("");
    setCity("");
    setCountry("");
    setIndustry("");
    setTechText("");
    setSignals([]);
  };

  const openCompanyContacts = (name: string) => {
    setLeadCompany(name);
    setTab("contacts");
  };

  const downloadCsv = async () => {
    const res = await utils.client.company.exportCsv.query({
      query: submittedQuery || undefined,
      filters: {
        employeesMin: employeesMin ? Number(employeesMin) : undefined,
        employeesMax: employeesMax ? Number(employeesMax) : undefined,
        city: city || undefined,
        country: country || undefined,
        industry: industry || undefined,
        techStack: techText
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        signalTypes: signals.length ? signals : undefined,
      },
    });
    triggerDownload({ url: res.url, csv: res.csv, fileName: "prospector-companies.csv" });
  };

  const isLoading =
    tab === "accounts" ? accountsQuery.isFetching : contactsQuery.isFetching;

  return (
    <>
      <TopBar title={t("title")} />
      <div className="flex-1 p-6 space-y-4 overflow-auto">
        {/* NL Search */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setSubmittedQuery(query)}
              placeholder={
                tab === "accounts"
                  ? t("searchAccountsPlaceholder")
                  : t("searchContactsPlaceholder")
              }
              className="w-full rounded-xl border border-border bg-surface pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-lime/50 focus:border-lime"
            />
          </div>
          <button
            onClick={() => setSubmittedQuery(query)}
            className="flex items-center gap-2 bg-lime text-ink px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-lime-dark transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            {t("searchBtn")}
          </button>
          {tab === "accounts" && (
            <button
              onClick={downloadCsv}
              className="flex items-center gap-2 bg-surface-elevated text-text-secondary px-4 py-2.5 rounded-xl text-sm font-medium hover:text-foreground transition-colors"
            >
              <Download className="h-4 w-4" />
              {t("csvBtn")}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2">
          {(
            [
              { key: "accounts", label: t("tabAccounts"), icon: Building2 },
              { key: "contacts", label: t("tabContacts"), icon: Users },
            ] as { key: Tab; label: string; icon: typeof Building2 }[]
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                setSelected([]);
                setBulkMenu("none");
                setBulkFeedback(null);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.key
                  ? "bg-lime text-ink"
                  : "bg-surface-elevated text-text-secondary hover:text-foreground"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  tab === t.key ? "bg-ink/15 text-ink" : "bg-surface text-text-muted"
                }`}
              >
                {t.key === "accounts" ? accountsQuery.data?.total ?? 0 : contactsQuery.data?.total ?? 0}
              </span>
            </button>
          ))}
          {tab === "accounts" && submittedQuery && (
            <span className="text-xs text-text-muted">
              {t("interpreted", {
                mode:
                  JSON.stringify(accountsQuery.data?.filtersApplied ?? {}).length > 2
                    ? t("filtersApplied")
                    : t("keywords"),
              })}
            </span>
          )}
        </div>

        <div className="flex gap-4">
          {/* Filter panel */}
          <div className="w-64 shrink-0 rounded-xl bg-surface border border-border p-4 h-fit">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-bold text-foreground">{t("filters")}</h3>
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 text-[10px] font-medium text-text-muted hover:text-lime transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                {t("reset")}
              </button>
            </div>

            {tab === "accounts" ? (
              <>
                <FilterBlock
                  title={t("employees")}
                  open={openBlocks.employees}
                  onToggle={() => setOpenBlocks((o) => ({ ...o, employees: !o.employees }))}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={employeesMin}
                      onChange={(e) => setEmployeesMin(e.target.value)}
                      placeholder={t("min")}
                      className={inputCls}
                    />
                    <span className="text-text-muted text-xs">→</span>
                    <input
                      type="number"
                      value={employeesMax}
                      onChange={(e) => setEmployeesMax(e.target.value)}
                      placeholder={t("max")}
                      className={inputCls}
                    />
                  </div>
                </FilterBlock>

                <FilterBlock
                  title={t("location")}
                  open={openBlocks.location}
                  onToggle={() => setOpenBlocks((o) => ({ ...o, location: !o.location }))}
                >
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder={t("cityPlaceholder")}
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder={t("countryPlaceholder")}
                    className={inputCls}
                  />
                </FilterBlock>

                <FilterBlock
                  title={t("industry")}
                  open={openBlocks.industry}
                  onToggle={() => setOpenBlocks((o) => ({ ...o, industry: !o.industry }))}
                >
                  <input
                    type="text"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder={t("industryPlaceholder")}
                    className={inputCls}
                  />
                </FilterBlock>

                <FilterBlock
                  title={t("techno")}
                  open={openBlocks.tech}
                  onToggle={() => setOpenBlocks((o) => ({ ...o, tech: !o.tech }))}
                >
                  <input
                    type="text"
                    value={techText}
                    onChange={(e) => setTechText(e.target.value)}
                    placeholder={t("techPlaceholder")}
                    className={inputCls}
                  />
                </FilterBlock>

                <FilterBlock
                  title={t("signals")}
                  open={openBlocks.signals}
                  onToggle={() => setOpenBlocks((o) => ({ ...o, signals: !o.signals }))}
                >
                  {SIGNAL_TYPES.map((s) => (
                    <label
                      key={s}
                      className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={signals.includes(s)}
                        onChange={() => toggleSignal(s)}
                        className="accent-lime"
                      />
                      {signalLabels[s]}
                    </label>
                  ))}
                </FilterBlock>
              </>
            ) : (
              <>
                <FilterBlock
                  title={t("intent")}
                  open={true}
                  onToggle={() => {}}
                >
                  <div className="flex flex-wrap gap-1.5">
                    {["ALL", "HOT", "WARM", "COLD"].map((i) => (
                      <button
                        key={i}
                        onClick={() => setLeadIntent(i)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-medium ${
                          leadIntent === i
                            ? "bg-lime text-ink"
                            : "bg-surface-elevated text-text-secondary hover:text-foreground"
                        }`}
                      >
                        {i}
                      </button>
                    ))}
                  </div>
                </FilterBlock>
                <FilterBlock
                  title={t("position")}
                  open={true}
                  onToggle={() => {}}
                >
                  <input
                    type="text"
                    value={leadTitle}
                    onChange={(e) => setLeadTitle(e.target.value)}
                    placeholder={t("positionPlaceholder")}
                    className={inputCls}
                  />
                </FilterBlock>
                <FilterBlock
                  title={t("company")}
                  open={true}
                  onToggle={() => {}}
                >
                  <input
                    type="text"
                    value={leadCompany}
                    onChange={(e) => setLeadCompany(e.target.value)}
                    placeholder={t("companyPlaceholder")}
                    className={inputCls}
                  />
                </FilterBlock>
                <FilterBlock
                  title={t("location")}
                  open={true}
                  onToggle={() => {}}
                >
                  <input
                    type="text"
                    value={leadCity}
                    onChange={(e) => setLeadCity(e.target.value)}
                    placeholder={t("cityHeadquarterPlaceholder")}
                    className={inputCls}
                  />
                </FilterBlock>
                <label className="mt-2 flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={leadHasEmail}
                    onChange={(e) => setLeadHasEmail(e.target.checked)}
                    className="accent-lime"
                  />
                  {t("emailOnly")}
                </label>
              </>
            )}
          </div>

          {/* Results */}
          <div className="flex-1 space-y-3">
            {selected.length > 0 && (
              <div className="rounded-xl bg-lime/5 border border-lime/20 p-3 flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold text-foreground">
                  {t("selected", { count: selected.length })}
                </span>
                <button
                  onClick={() => setBulkMenu(bulkMenu === "list" ? "none" : "list")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-surface border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:text-lime-dark transition-colors"
                >
                  <ListPlus className="h-3.5 w-3.5" />
                  {t("addToList")}
                </button>
                {tab === "contacts" && (
                  <button
                    onClick={() => setBulkMenu(bulkMenu === "sequence" ? "none" : "sequence")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-surface border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:text-lime-dark transition-colors"
                  >
                    <Timer className="h-3.5 w-3.5" />
                    {t("enrollInSequence")}
                  </button>
                )}
                <button
                  onClick={() => {
                    setSelected([]);
                    setBulkMenu("none");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-text-muted hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  {t("deselect")}
                </button>
                {bulkFeedback && (
                  <span className="text-xs font-medium text-lead-excellent">{bulkFeedback}</span>
                )}
                {bulkMenu === "list" && (
                  <select
                    value=""
                    onChange={(e) => e.target.value && runBulkList(e.target.value)}
                    className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-foreground focus:outline-none"
                  >
                    <option value="">{t("chooseList")}</option>
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                )}
                {bulkMenu === "sequence" && (
                  <select
                    value=""
                    onChange={(e) => e.target.value && runBulkEnroll(e.target.value)}
                    className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-foreground focus:outline-none"
                  >
                    <option value="">{t("chooseSequence")}</option>
                    {sequences.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {isLoading && tab === "accounts" && accountsQuery.data === undefined ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-28 rounded-xl bg-surface border border-border animate-pulse"
                  />
                ))}
              </div>
            ) : tab === "accounts" ? (
              (accountsQuery.data?.companies.length ?? 0) === 0 ? (
                <div className="rounded-xl bg-surface border border-border p-12 text-center">
                  <p className="text-sm text-text-muted">
                    {t("noAccounts")}
                  </p>
                </div>
              ) : (
                accountsQuery.data?.companies.map((c: {
                  id: string;
                  name: string;
                  headquartersCity: string | null;
                  industry: string | null;
                  employeeCount: number | null;
                  revenueEstimate: number | null;
                  techStack: string[];
                  buyingSignals: { id: string; type: string }[];
                  fitScore: number;
                }, i) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="rounded-xl bg-surface border border-border p-4 hover:bg-surface-elevated/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={selected.includes(c.id)}
                          onChange={() => toggleSelect(c.id)}
                          className="mt-2 h-4 w-4 shrink-0 rounded border-border bg-surface text-lime focus:ring-lime/40 accent-lime"
                        />
                        <div className="h-10 w-10 rounded-lg bg-lime/10 flex items-center justify-center shrink-0">
                          <Building2 className="h-5 w-5 text-lime-dark" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                            {c.headquartersCity && (
                              <span className="text-xs text-text-muted">
                                {c.headquartersCity}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-text-secondary mt-0.5">
                            {c.industry ?? t("unknownIndustry")} ·{" "}
                            {c.employeeCount != null
                              ? tc("employees", { count: c.employeeCount })
                              : "?"}
                            {c.revenueEstimate != null && (
                              <> · {t("revenueMAD", { value: (c.revenueEstimate / 1_000_000).toFixed(1) })}</>
                            )}
                          </p>
                          {c.techStack.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {c.techStack.slice(0, 5).map((t) => (
                                <span
                                  key={t}
                                  className="inline-flex items-center rounded-md bg-surface-elevated px-2 py-0.5 text-[10px] font-medium text-text-secondary"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                          {c.buyingSignals.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {c.buyingSignals.map((s) => (
                                <span
                                  key={s.id}
                                  className="inline-flex items-center rounded-md bg-lime/10 px-2 py-0.5 text-[10px] font-medium text-lime-dark"
                                >
                                  {signalLabels[s.type as keyof typeof signalLabels] ?? s.type}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold font-data ${
                            c.fitScore >= 70 ? "bg-lead-excellent/10 text-lead-excellent" :
                            c.fitScore >= 40 ? "bg-lead-medium/10 text-lead-medium" :
                            "bg-lead-low/10 text-lead-low"
                          }`}>
                            {t("fitScore", { score: c.fitScore })}
                          </span>
                          <Link
                            href={`/dashboard/companies/${c.id}`}
                            className="text-[10px] font-medium text-lime hover:text-lime-dark"
                          >
                            {t("viewCompany360")}
                          </Link>
                          <button
                            onClick={() => openCompanyContacts(c.name)}
                            className="text-[10px] font-medium text-lime hover:text-lime-dark"
                          >
                            {t("viewContacts")}
                          </button>
                        </div>
                    </div>
                  </motion.div>
                ))
              )
            ) : (contactsQuery.data?.leads.length ?? 0) === 0 ? (
              <div className="rounded-xl bg-surface border border-border p-12 text-center">
                <p className="text-sm text-text-muted">
                    {t("noContacts")}
                </p>
              </div>
            ) : (
              <div className="rounded-xl bg-surface border border-border overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-surface-elevated/50">
                      <th className="px-4 py-3 w-8"></th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">{t("contact")}</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">{t("position")}</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">{t("score")}</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">{t("confidence")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {contactsQuery.data?.leads.map((lead: {
                      id: string;
                      firstName: string | null;
                      lastName: string | null;
                      email: string | null;
                      title: string | null;
                      score: number;
                      intent: string;
                      confidenceEmail: number | null;
                      confidencePhone: number | null;
                      verification: string;
                      company: { name: string } | null;
                    }) => (
                      <tr key={lead.id} className="hover:bg-surface-elevated/40 transition-colors">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selected.includes(lead.id)}
                            onChange={() => toggleSelect(lead.id)}
                            className="h-4 w-4 rounded border-border bg-surface text-lime focus:ring-lime/40 accent-lime"
                          />
                        </td>
                        <td className="px-5 py-3">
                          <Link href={`/dashboard/leads/${lead.id}`} className="group flex items-center gap-3">
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
                        <td className="px-5 py-3">
                          <p className="text-xs font-medium text-foreground">{lead.title ?? "—"}</p>
                          <p className="text-[10px] text-text-muted">{lead.company?.name}</p>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold font-data ${
                            lead.score >= 80 ? "bg-lead-excellent/10 text-lead-excellent" :
                            lead.score >= 50 ? "bg-lead-medium/10 text-lead-medium" :
                            "bg-lead-low/10 text-lead-low"
                          }`}>
                            {Math.round(lead.score)}
                          </span>
                          <span className={`ml-2 text-xs font-medium ${intentColor(lead.intent)}`}>
                            {lead.intent}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-1">
                            <ConfidenceBadge value={lead.confidenceEmail} verified={lead.verification === "VERIFIED"} label={tc("email")} verifiedLabel={t("verified")} />
                            <ConfidenceBadge value={lead.confidencePhone} label={tc("tel")} verifiedLabel={t("verified")} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
