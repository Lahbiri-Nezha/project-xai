"use client";

import ErrorState from "@/components/shared/ErrorState";

/**
 * Boundary propre au dashboard : une erreur sur une page (copilot,
 * prospector, leads...) affiche un état d'erreur à l'intérieur du layout
 * plutôt que de faire tomber toute l'application.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState error={error} onRetry={reset} />;
}