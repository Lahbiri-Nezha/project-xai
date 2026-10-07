"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

function ScoreRing({ score, delay }: { score: number; delay: number }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      const duration = 1500;
      const steps = 60;
      const increment = score / steps;
      let c = 0;
      const interval = setInterval(() => {
        c += increment;
        if (c >= score) {
          setCurrent(score);
          clearInterval(interval);
        } else {
          setCurrent(Math.floor(c));
        }
      }, duration / steps);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timer);
  }, [score, delay]);

  const colorClass =
    score >= 80
      ? "bg-lead-excellent/15 text-lead-excellent"
      : score >= 50
        ? "bg-lead-medium/15 text-lead-medium"
        : "bg-lead-low/15 text-lead-low";

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold font-data ${colorClass}`}
    >
      {current}
    </span>
  );
}

export default function LeadScoringDemo() {
  const t = useTranslations("landing");
  const demoLeads = [
    {
      name: "Atlass Logistique",
      industry: t("demoIndustryLogistics"),
      stage: "Série B",
      score: 94,
      intent: "HOT",
      signals: [t("demoSignalFunding"), t("demoSignalHiring"), t("demoSignalTechMatch")],
      avatar: "AL",
      avatarGradient: "from-purple to-purple/60",
    },
    {
      name: "MediPay Maroc",
      industry: t("demoIndustryFintech"),
      stage: "Série A",
      score: 67,
      intent: "WARM",
      signals: [t("demoSignalPricing"), t("demoSignalSite")],
      avatar: "MP",
      avatarGradient: "from-brand/80 to-brand/40",
    },
    {
      name: "PortTech Tanger",
      industry: t("demoIndustryPort"),
      stage: "Seed",
      score: 38,
      intent: "COLD",
      signals: [t("demoSignalBlog")],
      avatar: "PT",
      avatarGradient: "from-text-muted to-text-muted/50",
    },
  ];
  const [analyzing, setAnalyzing] = useState(true);
  const [visibleLeads, setVisibleLeads] = useState<number>(0);

  useEffect(() => {
    const analyzeTimer = setTimeout(() => setAnalyzing(false), 2000);
    return () => clearTimeout(analyzeTimer);
  }, []);

  useEffect(() => {
    if (analyzing) return;
    const timers = Array.from({ length: demoLeads.length }, (_, i) =>
      setTimeout(() => setVisibleLeads((prev) => prev + 1), i * 600)
    );
    return () => timers.forEach(clearTimeout);
  }, [analyzing, demoLeads.length]);

  return (
    <div className="relative w-full max-w-lg">
      <div className="absolute -top-6 -left-6 w-20 h-20 rounded-2xl bg-brand/8 animate-pulse" />
      <div className="absolute top-1/4 -right-8 w-14 h-14 rounded-xl bg-purple/8" />
      <div className="absolute bottom-8 -left-4 w-10 h-10 rounded-full bg-gradient-to-br from-purple/10 to-brand/8" />

      <div className="relative rounded-2xl border border-border-default bg-surface shadow-xl shadow-black/[0.06] p-1">
        <div className="rounded-xl bg-background overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border-default">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
            </div>
            <div className="ml-3 h-5 w-32 rounded-md bg-surface-elevated" />
          </div>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: t("demoStatScore"),
                  value: "94",
                  accent: "bg-brand/10 text-brand-strong",
                },
                {
                  label: t("demoStatIntent"),
                  value: t("demoStatHigh"),
                  accent: "bg-brand-soft text-brand-strong",
                },
                {
                  label: t("demoStatFit"),
                  value: "A+",
                  accent: "bg-foreground/[0.05] text-foreground",
                },
              ].map((s) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                  className={`rounded-xl p-3.5 ${s.accent}`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    {s.label}
                  </p>
                  <p className="mt-1 text-xl font-bold font-data">{s.value}</p>
                </motion.div>
              ))}
            </div>

            <AnimatePresence>
              {analyzing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl border border-brand/25 bg-brand/8 p-4 flex items-center gap-3"
                >
                  <div className="h-2 w-2 rounded-full bg-brand animate-pulse" />
                  <span className="text-xs font-semibold text-brand-strong">
                    {t("demoAnalyzing")}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {demoLeads.slice(0, visibleLeads).map((lead, i) => (
              <motion.div
                key={lead.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.5,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="rounded-xl bg-surface border border-border-default p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-9 w-9 rounded-lg bg-gradient-to-br ${lead.avatarGradient} flex items-center justify-center text-white text-xs font-bold`}
                    >
                      {lead.avatar}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {lead.name}
                      </p>
                      <p className="text-xs text-text-muted">
                        {lead.industry} &middot; {lead.stage}
                      </p>
                    </div>
                  </div>
                  <ScoreRing score={lead.score} delay={i * 600 + 2000} />
                </div>
                <div className="mt-3 flex gap-2 flex-wrap">
                  {lead.signals.map((signal) => (
                    <span
                      key={signal}
                      className="inline-flex items-center rounded-md bg-surface-elevated px-2 py-0.5 text-[10px] font-medium text-text-secondary"
                    >
                      {signal}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
