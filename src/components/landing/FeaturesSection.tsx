"use client";

import { motion } from "framer-motion";
import ScrollReveal from "@/components/shared/ScrollReveal";
import BentoGrid from "@/components/shared/BentoGrid";
import {
  Search,
  Send,
  Database,
  Target,
  TrendingUp,
  MessageSquare,
} from "lucide-react";
import { useTranslations } from "next-intl";

type T = (key: string) => string;

function buildFeatures(t: T) {
  return [
    {
      icon: Send,
      title: t("featureOutbound"),
      description: t("featureOutboundDesc"),
      colSpan: "md:col-span-2",
      visual: (
        <div className="space-y-2 mt-4">
          {[
            { name: "Atlass Logistique", score: 94, color: "bg-lead-excellent" },
            { name: "MediPay Maroc", score: 67, color: "bg-lead-medium" },
            { name: "PortTech Tanger", score: 38, color: "bg-lead-low" },
          ].map((lead) => (
            <div
              key={lead.name}
              className="flex items-center justify-between rounded-lg bg-background border border-border-default p-3"
            >
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${lead.color}`} />
                <span className="text-xs font-semibold text-foreground">
                  {lead.name}
                </span>
              </div>
              <span
                className={`text-xs font-bold font-data ${
                  lead.score >= 80
                    ? "text-lead-excellent"
                    : lead.score >= 50
                      ? "text-lead-medium"
                      : "text-lead-low"
                }`}
              >
                {lead.score}
              </span>
            </div>
          ))}
        </div>
      ),
    },
    {
      icon: TrendingUp,
      title: t("featurePipeline"),
      description: t("featurePipelineDesc"),
      colSpan: "md:col-span-1",
      visual: (
        <div className="mt-4 space-y-2">
          {[
            { stage: t("stageDiscovery"), width: "85%", color: "bg-purple" },
            { stage: t("stageProposal"), width: "60%", color: "bg-lime" },
            { stage: t("stageNegotiation"), width: "35%", color: "bg-lead-medium" },
            { stage: t("stageWon"), width: "45%", color: "bg-lead-excellent" },
          ].map((s) => (
            <div key={s.stage} className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-text-muted w-20">
                {s.stage}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-surface-elevated overflow-hidden">
                <div
                  className={`h-full rounded-full ${s.color}`}
                  style={{ width: s.width }}
                />
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      icon: Search,
      title: t("featureInbound"),
      description: t("featureInboundDesc"),
      colSpan: "md:col-span-1",
      visual: (
        <div className="mt-4 rounded-lg bg-background border border-border-default p-3 space-y-2">
          <div className="flex items-center gap-2 pb-2 border-b border-border-default">
            <div className="h-8 w-8 rounded-lg bg-lime/10 flex items-center justify-center">
              <Target className="h-4 w-4 text-lime-dark" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">
                {t("demoRequest")}
              </p>
              <p className="text-[10px] text-text-muted">
                karim@atlass-logistique.ma
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: t("size"), value: "200+" },
              { label: t("budget"), value: "250K MAD" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded bg-surface-elevated p-2"
              >
                <p className="text-[8px] uppercase tracking-wider text-text-muted">
                  {item.label}
                </p>
                <p className="text-xs font-bold font-data text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="rounded bg-lead-excellent/10 p-2 flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-lead-excellent" />
            <span className="text-[10px] font-semibold font-data text-lead-excellent">
              {t("scoreAI")}
            </span>
          </div>
        </div>
      ),
    },
    {
      icon: Database,
      title: t("featureEnrich"),
      description: t("featureEnrichDesc"),
      colSpan: "md:col-span-1",
      visual: (
        <div className="mt-4 space-y-1.5">
          {[
            { label: t("fundingLabel"), value: "Série C — 450M MAD", color: "text-lead-excellent" },
            { label: t("employeesLabel"), value: "350+", color: "text-foreground" },
            { label: t("techStackLabel"), value: "React, AWS", color: "text-purple" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-lg bg-background border border-border-default p-2"
            >
              <span className="text-[10px] text-text-muted">{item.label}</span>
              <span className={`text-[10px] font-semibold ${item.color}`}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      ),
    },
    {
      icon: MessageSquare,
      title: t("featureCopilot"),
      description: t("featureCopilotDesc"),
      colSpan: "md:col-span-1",
      visual: (
        <div className="mt-4 space-y-2">
          <div className="rounded-lg bg-surface-elevated p-2.5 max-w-[80%]">
            <p className="text-[10px] text-foreground">
              {t("copilotAsk")}
            </p>
          </div>
          <div className="rounded-lg bg-lime/10 border border-lime/20 p-2.5 max-w-[90%] ml-auto">
            <p className="text-[10px] text-foreground">
              {t("copilotAnswer")}
            </p>
          </div>
        </div>
      ),
    },
  ];
}

export default function FeaturesSection() {
  const t = useTranslations("landing");
  const features = buildFeatures(t);
  return (
    <section id="features" className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <ScrollReveal variant="perspectiveShift" className="mx-auto max-w-2xl text-center mb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-dark mb-4">
            {t("featuresBadge")}
          </p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground leading-tight">
            <span className="font-serif block text-foreground/85">{t("featuresTitle1")}</span>
            <span className="block mt-1">{t("featuresTitle2")}</span>
          </h2>
          <p className="mt-5 text-lg text-text-secondary">
            {t("featuresSubtitle")}
          </p>
        </ScrollReveal>

        <BentoGrid>
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{
                duration: 0.6,
                ease: [0.22, 1, 0.36, 1],
                delay: i * 0.1,
              }}
              whileHover={{
                borderColor: "rgba(185, 138, 62, 0.3)",
                scale: 1.01,
              }}
              className={`rounded-2xl bg-surface border border-border-default p-6 ${feature.colSpan}`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime/10">
                <feature.icon className="h-5 w-5 text-lime-dark" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-foreground">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-text-secondary leading-relaxed">
                {feature.description}
              </p>
              {feature.visual}
            </motion.div>
          ))}
        </BentoGrid>
      </div>
    </section>
  );
}
