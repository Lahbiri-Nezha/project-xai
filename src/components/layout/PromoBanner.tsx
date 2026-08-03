"use client";

import { useState, useEffect } from "react";
import { X, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";

export default function PromoBanner() {
  const t = useTranslations("landing");
  const [visible, setVisible] = useState(true);
  const [displayText, setDisplayText] = useState("");

  useEffect(() => {
    const fullText = t("promoText");
    let i = 0;
    const timer = setInterval(() => {
      if (i <= fullText.length) {
        setDisplayText(fullText.slice(0, i));
        i++;
      } else {
        clearInterval(timer);
      }
    }, 35);
    return () => clearInterval(timer);
  }, [t]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ height: 40, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="relative bg-lime text-white overflow-hidden"
        >
          <div className="mx-auto flex h-10 max-w-7xl items-center justify-center px-4 text-center">
            <div className="flex items-center gap-2">
              <Star className="h-3.5 w-3.5 fill-white text-white animate-spin" />
              <span className="text-xs sm:text-sm font-semibold">
                {displayText}
                <span className="inline-block w-px h-4 bg-white/50 ml-0.5 align-middle animate-pulse" />
              </span>
              <Star className="h-3.5 w-3.5 fill-white text-white animate-spin" />
            </div>
            <button
              onClick={() => setVisible(false)}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-white/50 hover:text-white transition-colors"
              aria-label={t("closeBanner")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
