"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import MagneticButton from "@/components/shared/MagneticButton";
import LeadScoringDemo from "@/components/demo/LeadScoringDemo";

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } },
};

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
};

export default function HeroSection() {
  const t = useTranslations("landing");
  const router = useRouter();
  const [displayText, setDisplayText] = useState("");
  const stateRef = useRef({ phraseIndex: 0, isDeleting: false });

  const tick = useCallback(() => {
    const phrases = [t("phrase1"), t("phrase2"), t("phrase3"), t("phrase4")];
    const { phraseIndex, isDeleting } = stateRef.current;
    const currentPhrase = phrases[phraseIndex];

    if (!isDeleting && displayText === currentPhrase) {
      setTimeout(() => {
        stateRef.current.isDeleting = true;
      }, 2000);
      return;
    }

    if (isDeleting && displayText === "") {
      stateRef.current.isDeleting = false;
      stateRef.current.phraseIndex =
        (phraseIndex + 1) % phrases.length;
      return;
    }

    const speed = isDeleting ? 30 : 70;
    setTimeout(() => {
      setDisplayText(
        isDeleting
          ? currentPhrase.slice(0, displayText.length - 1)
          : currentPhrase.slice(0, displayText.length + 1)
      );
    }, speed);
  }, [displayText, t]);

  useEffect(() => {
    const timer = setTimeout(tick, 0);
    return () => clearTimeout(timer);
  }, [tick]);

  return (
    <section className="relative overflow-hidden bg-background pt-16 pb-20 sm:pt-24 sm:pb-28 lg:pt-32 lg:pb-36">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-gradient-to-br from-purple/5 to-transparent blur-3xl" />
        <div className="absolute top-1/2 -left-20 w-72 h-72 rounded-full bg-gradient-to-tr from-brand/8 to-transparent blur-3xl" />
        <div className="absolute -bottom-20 right-1/4 w-64 h-64 rounded-full bg-gradient-to-tl from-purple/3 to-transparent blur-3xl" />
      </div>

      <motion.div
        variants={stagger}
        initial="initial"
        animate="animate"
        className="relative mx-auto max-w-7xl px-6 lg:px-8"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="max-w-xl">
            <motion.div
              variants={fadeUp}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/8 px-4 py-1.5 mb-8"
            >
              <span className="flex h-2 w-2 items-center justify-center">
                <span className="absolute h-2 w-2 rounded-full bg-brand animate-ping" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-brand" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-widest text-brand-strong">
                {t("heroBadge")}
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight text-foreground leading-[1.1]"
            >
              <span className="font-serif block text-foreground/90">{t("heroLine1")}</span>
              <span className="relative mt-1 block">
                {displayText}
                <span
                  className="inline-block w-[3px] h-[0.8em] bg-brand ml-1 align-middle"
                  style={{
                    animation:
                      "pulse 1s step-end infinite",
                  }}
                />
              </span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 text-lg sm:text-xl leading-relaxed text-text-secondary max-w-lg"
            >
              {t.rich("heroIntro", {
                strong: (chunks) => (
                  <strong className="text-foreground font-semibold">{chunks}</strong>
                ),
              })}
            </motion.p>

            <motion.div
              variants={fadeUp}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mt-10 flex flex-col sm:flex-row items-start gap-4"
            >
              <MagneticButton
                onClick={() => router.push("/signup")}
                className="bg-brand hover:bg-brand-strong text-white text-base font-semibold px-8 h-12 rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand/15 inline-flex items-center"
              >
                {t("startFreeTrial")}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </MagneticButton>
              <MagneticButton className="text-base font-semibold px-8 h-12 rounded-xl bg-foreground/[0.06] text-foreground hover:bg-foreground/[0.12] transition-all hover:-translate-y-0.5 inline-flex items-center">
                <Play className="mr-2 h-4 w-4" />
                {t("watchDemo")}
              </MagneticButton>
            </motion.div>

            <motion.p
              variants={fadeUp}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mt-5 text-xs text-text-muted font-medium"
            >
              {t("heroFootnote")}
            </motion.p>
          </div>

          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
            className="relative lg:ml-auto"
          >
            <LeadScoringDemo />
          </motion.div>
        </div>
      </motion.div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </section>
  );
}
