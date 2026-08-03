"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Menu, X, Zap } from "lucide-react";
import { useTranslations } from "next-intl";

export default function Navbar() {
  const t = useTranslations("landing");
  const navItems = [
    { href: "#features", label: t("navFeatures") },
    { href: "#how-it-works", label: t("navHowItWorks") },
    { href: "#pricing", label: t("navPricing") },
  ];
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? "bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="text-base font-bold tracking-tight text-foreground">
            Sales Insight
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="text-sm font-medium text-text-secondary transition-colors hover:text-lime-dark"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-text-secondary hover:text-foreground transition-colors px-4 py-2"
          >
            {t("login")}
          </Link>
          <Link
            href="/signup"
            className="text-sm font-semibold text-white bg-lime hover:bg-lime-dark px-5 py-2 rounded-lg transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-lime/15"
          >
            {t("startFreeTrial")}
          </Link>
        </div>

        <button
          className="md:hidden p-2 -mr-2 text-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={t("toggleMenu")}
        >
          {mobileOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </div>

      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden bg-surface border-t border-border-default"
        >
          <div className="px-6 py-6 space-y-4">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="block text-base font-medium text-foreground"
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-4 flex flex-col gap-3">
              <Link
                href="/login"
                className="w-full text-center font-medium text-text-secondary py-2.5 rounded-lg"
              >
                {t("login")}
              </Link>
              <Link
                href="/signup"
                className="w-full text-center bg-lime text-white font-semibold py-2.5 rounded-lg"
              >
                {t("startFreeTrial")}
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </motion.header>
  );
}
