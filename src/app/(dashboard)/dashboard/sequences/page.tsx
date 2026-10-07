"use client";

import TopBar from "@/components/dashboard/TopBar";
import { useState } from "react";
import { motion } from "framer-motion";
import { Timer, Plus, Trash2, Send, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc/client";

type StepView = {
  id: string;
  order: number;
  channel: string;
  delayDays: number;
  template: string | null;
};

type SequenceView = {
  id: string;
  name: string;
  active: boolean;
  steps: StepView[];
  _count: { enrollments: number };
};

type LeadOption = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  company: { name: string } | null;
};

type StepDraft = {
  channel: "EMAIL" | "CALL" | "TASK";
  delayDays: number;
  template: string;
};

export default function SequencesPage() {
  const t = useTranslations("sequences");
  const tc = useTranslations("common");
  const channelLabels: Record<string, string> = {
    EMAIL: tc("channelEmail"),
    CALL: tc("channelCall"),
    TASK: tc("channelTask"),
  };
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<StepDraft[]>([
    { channel: "EMAIL", delayDays: 0, template: "Bonjour {prenom}, …" },
    { channel: "TASK", delayDays: 3, template: "Appeler {contact}" },
  ]);
  const [selectedSequence, setSelectedSequence] = useState<string>("");
  const [selectedLead, setSelectedLead] = useState<string>("");
  const [enrollResult, setEnrollResult] = useState<string | null>(null);
  const [enrollBlocked, setEnrollBlocked] = useState(false);

  const sequences = trpc.sequence.list.useQuery(undefined, { retry: false });
  const leads = trpc.lead.list.useQuery({ limit: 50, offset: 0 }, { retry: false });
  const createSequence = trpc.sequence.create.useMutation({
    onSuccess: () => {
      setName("");
      setSteps([{ channel: "EMAIL", delayDays: 0, template: "" }]);
      utils.sequence.list.invalidate();
    },
  });
  const deleteSequence = trpc.sequence.delete.useMutation({
    onSuccess: () => utils.sequence.list.invalidate(),
  });
  const toggleActive = trpc.sequence.update.useMutation({
    onSuccess: () => utils.sequence.list.invalidate(),
  });
  const enroll = trpc.sequence.enroll.useMutation();

  const seqData = sequences.data as unknown as SequenceView[] | undefined;
  const leadData = leads.data as unknown as { leads: LeadOption[] } | undefined;

  const setStep = (i: number, patch: Partial<StepDraft>) => {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };

  const save = () => {
    if (!name.trim()) return;
    createSequence.mutate({
      name: name.trim(),
      steps: steps.map((s) => ({
        channel: s.channel,
        delayDays: s.delayDays,
        template: s.template.trim() || undefined,
      })),
    });
  };

  const doEnroll = () => {
    if (!selectedSequence || !selectedLead) return;
    setEnrollResult(null);
    setEnrollBlocked(false);
    enroll.mutate(
      { sequenceId: selectedSequence, leadIds: [selectedLead] },
      {
        onSuccess: (res) => {
          const r = res.results[0];
          if (r.status === "enrolled") {
            setEnrollBlocked(false);
            setEnrollResult(t("enrolledMsg", { name: r.name }));
          } else if (r.status === "duplicate") {
            setEnrollBlocked(false);
            setEnrollResult(t("duplicateMsg", { name: r.name }));
          } else {
            setEnrollBlocked(true);
            setEnrollResult(t("blockedMsg", { name: r.name, reason: r.reason ?? "" }));
          }
          utils.sequence.list.invalidate();
        },
        onError: (err) => {
          setEnrollBlocked(true);
          setEnrollResult(t("enrollError", { message: err.message }));
        },
      }
    );
  };

  return (
    <>
      <TopBar title={t("title")} />
      <div className="flex-1 p-6 overflow-auto space-y-6">
        <div className="rounded-xl bg-surface border border-border p-6">
          <h3 className="text-sm font-bold text-foreground mb-4">{t("newSequence")}</h3>
          <div className="max-w-md">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{t("name")}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand/50"
            />
          </div>

          <div className="mt-4 space-y-2">
            {steps.map((s, i) => (
              <div key={i} className="flex flex-wrap gap-2 items-center rounded-lg bg-surface-elevated p-3">
                <span className="text-[10px] font-bold font-data text-text-muted w-6 text-center">{i + 1}</span>
                <select
                  value={s.channel}
                  onChange={(e) => setStep(i, { channel: e.target.value as StepDraft["channel"] })}
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none"
                >
                  <option value="EMAIL">{tc("channelEmail")}</option>
                  <option value="CALL">{tc("channelCall")}</option>
                  <option value="TASK">{tc("channelTask")}</option>
                </select>
                <input
                  type="number"
                  min={0}
                  max={90}
                  value={s.delayDays}
                  onChange={(e) => setStep(i, { delayDays: Number(e.target.value) })}
                  className="w-16 rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none"
                  aria-label={t("delayLabel")}
                />
                <span className="text-[10px] text-text-muted">{t("days")}</span>
                <input
                  value={s.template}
                  onChange={(e) => setStep(i, { template: e.target.value })}
                  placeholder={t("templatePlaceholder")}
                  className="flex-1 min-w-[180px] rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-text-muted focus:outline-none"
                />
                <button
                  onClick={() => setSteps((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={steps.length <= 1}
                  aria-label={t("removeStepLabel")}
                  className="p-1.5 rounded-md text-text-muted hover:text-red-500 transition-colors disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => setSteps((prev) => [...prev, { channel: "EMAIL", delayDays: 5, template: "" }])}
              className="text-xs font-medium text-brand hover:text-brand-strong inline-flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("addStep")}
            </button>
            <button
              onClick={save}
              disabled={!name.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-brand hover:bg-brand-strong text-white font-semibold px-4 py-2 text-sm transition-colors disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {t("createSequence")}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {seqData?.map((seq, i) => (
            <motion.div
              key={seq.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-xl bg-surface border border-border p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
                    <Timer className="h-4 w-4 text-brand-strong" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{seq.name}</p>
                    <p className="text-[10px] text-text-muted">
                      {t("stepCount", { count: seq.steps.length })} · {t("enrollCount", { count: seq._count.enrollments })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleActive.mutate({ id: seq.id, active: !seq.active })}
                    className={`text-[10px] font-bold px-2 py-1 rounded-full transition-colors ${seq.active ? "bg-brand/15 text-brand-strong" : "bg-surface-elevated text-text-muted"}`}
                  >
                    {seq.active ? t("active") : t("inactive")}
                  </button>
                  <button
                    onClick={() => deleteSequence.mutate({ id: seq.id })}
                    aria-label={t("deleteSeqLabel")}
                    className="p-1.5 rounded-md text-text-muted hover:text-red-500 hover:bg-surface-elevated transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-1.5">
                {seq.steps.map((st) => (
                  <div key={st.id} className="flex items-center gap-2 text-xs">
                    <span className="text-[10px] font-bold font-data text-text-muted w-5">{st.order}</span>
                    <span className="inline-flex rounded-md bg-surface-elevated px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                      {channelLabels[st.channel] ?? st.channel}
                    </span>
                    <span className="text-[10px] text-text-muted">J+{st.delayDays}</span>
                    {st.template && <span className="text-[10px] text-text-secondary truncate">{st.template}</span>}
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  setSelectedSequence(seq.id);
                  setEnrollResult(null);
                }}
                className={`mt-4 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  selectedSequence === seq.id
                    ? "bg-brand/15 text-brand-strong"
                    : "bg-surface-elevated text-text-secondary hover:text-foreground"
                }`}
              >
                <Send className="h-3.5 w-3.5" />
                {selectedSequence === seq.id ? t("sequenceSelected") : t("enrollLead")}
              </button>
            </motion.div>
          ))}
        </div>

        {selectedSequence && (
          <div className="rounded-xl bg-surface border border-brand/20 p-6">
            <h3 className="text-sm font-bold text-foreground mb-4">{t("enrollTitle")}</h3>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[220px]">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{t("lead")}</label>
                <select
                  value={selectedLead}
                  onChange={(e) => setSelectedLead(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/50"
                >
                  <option value="">{t("chooseLead")}</option>
                  {leadData?.leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.firstName} {l.lastName} — {l.company?.name ?? "—"} ({l.email ?? t("noEmail")})
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={doEnroll}
                disabled={!selectedLead}
                className="inline-flex items-center gap-2 rounded-lg bg-brand hover:bg-brand-strong text-white font-semibold px-4 py-2 text-sm transition-colors disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {t("enroll")}
              </button>
            </div>
            {enrollResult && (
              <p
                className={`mt-3 flex items-center gap-2 text-xs font-medium ${
                  enrollBlocked ? "text-red-500" : "text-brand-strong"
                }`}
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                {enrollResult}
              </p>
            )}
            <p className="mt-2 text-[10px] text-text-muted">
              {t("complianceNote")}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
