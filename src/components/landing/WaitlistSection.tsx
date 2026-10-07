"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import ScrollReveal from "@/components/shared/ScrollReveal";
import { ArrowRight, Mail, Check } from "lucide-react";
import { useTranslations } from "next-intl";

export default function WaitlistSection() {
  const t = useTranslations("landing");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setSubmitted(true);
    setLoading(false);
  };

  return (
    <section className="bg-surface-warm py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <ScrollReveal variant="scaleIn">
          <div className="relative overflow-hidden rounded-3xl bg-surface border border-border-default px-8 py-16 sm:px-16 sm:py-20 text-center">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand/40 to-transparent" />
            <div className="absolute top-0 left-0 w-64 h-64 rounded-full bg-brand/5 blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-48 h-48 rounded-full bg-purple/4 blur-3xl translate-x-1/4 translate-y-1/4" />

            <div className="relative z-10 mx-auto max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/8 px-4 py-1.5 mb-6">
                <div className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-strong">
                  {t("earlyAccess")}
                </span>
              </div>

              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground leading-tight">
                <span className="font-serif block text-foreground/85">{t("wlTitle1")}</span>
                <span className="block mt-1 text-brand-strong">{t("wlTitle2")}</span>
              </h2>

              <p className="mt-5 text-lg text-text-secondary">
                {t("wlText")}
              </p>

              {submitted ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-10 inline-flex items-center gap-3 rounded-xl bg-lead-excellent/10 border border-lead-excellent/20 px-6 py-4"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-lead-excellent/20">
                    <Check className="h-4 w-4 text-lead-excellent" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-lead-excellent">{t("onTheList")}</p>
                    <p className="text-xs text-text-secondary">{t("willNotify", { email })}</p>
                  </div>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="mt-10 flex flex-col sm:flex-row items-center gap-3 max-w-md mx-auto">
                  <div className="relative flex-1 w-full">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("wlEmailPlaceholder")}
                      required
                      className="w-full rounded-xl border border-border-default bg-background pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full sm:w-auto bg-brand hover:bg-brand-strong text-white font-semibold px-6 py-3 rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand/15 inline-flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? t("joining") : t("joinWaitlist")}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              )}

              <p className="mt-5 text-xs text-text-muted">
                {t("wlFootnote")}
              </p>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
