"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, X, MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";

export default function FloatingHelp() {
  const t = useTranslations("landing");
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="mb-4 w-80 rounded-2xl bg-surface border border-border-default shadow-xl shadow-black/[0.08] overflow-hidden"
          >
            <div className="bg-surface-elevated px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-lime-dark" />
                <span className="text-sm font-semibold text-foreground">
                  {t("needHelp")}
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-text-muted hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-text-secondary">
                {t("helpText")}
              </p>
              <button className="w-full rounded-lg bg-lime text-white text-sm font-semibold py-2.5 transition-all hover:bg-lime-dark hover:-translate-y-0.5">
                {t("startConversation")}
              </button>
              <button className="w-full rounded-lg bg-surface-elevated text-foreground text-sm font-medium py-2.5 transition-all hover:bg-border-default">
                {t("browseHelpCenter")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setOpen(!open)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-lime text-white shadow-xl shadow-lime/15 transition-all hover:shadow-2xl hover:shadow-lime/25"
        whileHover={{ scale: 1.1 }}
        animate={{ y: [0, -4, 0] }}
        transition={{ y: { duration: 2, repeat: Infinity, ease: "easeInOut" } }}
        aria-label={t("getHelp")}
      >
        {open ? (
          <X className="h-5 w-5" />
        ) : (
          <HelpCircle className="h-5 w-5" />
        )}
      </motion.button>
    </div>
  );
}
