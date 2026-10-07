"use client";

import { useEffect } from "react";
import ErrorState from "@/components/shared/ErrorState";

/**
 * Boundary d'erreur pour l'ensemble des routes.
 * Sans elle, une exception de rendu affiche une page blanche.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[sales-insight] route error", error);
  }, [error]);

  return <ErrorState error={error} onRetry={reset} />;
}