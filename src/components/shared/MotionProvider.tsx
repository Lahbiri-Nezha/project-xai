"use client";

import { MotionConfig } from "framer-motion";

/**
 * `reducedMotion="user"` respecte le réglage système
 * « animations réduites » : framer-motion neutralise alors les
 * transformations et les animations de mise en page, ce qui est requis
 * par WCAG 2.3.3 (Animation from Interactions).
 *
 * Les animations CSS pures sont couvertes par la règle
 * `@media (prefers-reduced-motion: reduce)` de globals.css.
 */
export default function MotionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}