/**
 * Observabilité des pipelines Inngest.
 *
 * V1 : métriques structurées (JSON) sur stdout : nom de fonction, durée, statut.
 * Ces logs sont indexables par n'importe quel collecteur (GCP Cloud Logging,
 * Datadog, etc.) pour calculer taux d'échec et latence d'enrichissement.
 *
 * V2 (production) : lorsqu'un SDK OpenTelemetry est démarré (`src/lib/otel.ts`,
 * activé par `OTEL_EXPORTER_OTLP_ENDPOINT`), chaque run émet un span
 * `inngest.<fn>` (statut, `durationMs`) visible dans l'APM.
 */

import { trace, SpanStatusCode, type Attributes } from "@opentelemetry/api";

const tracer = trace.getTracer("sales-insight");

type Metric = {
  fn: string;
  status: "success" | "error";
  durationMs: number;
  [key: string]: unknown;
};

export function logMetric(metric: Metric) {
  try {
    console.log(`[inngest-metrics] ${JSON.stringify(metric)}`);
  } catch {
    /* jamais bloquant */
  }
}

export async function withMetrics<T>(
  fn: string,
  run: () => Promise<T>,
  extra?: Record<string, unknown>
): Promise<T> {
  const startedAt = Date.now();
  const span = tracer.startSpan(`inngest.${fn}`, {
    attributes: extra as Attributes | undefined,
  });
  try {
    const result = await run();
    span.setStatus({ code: SpanStatusCode.OK });
    logMetric({
      fn,
      status: "success",
      durationMs: Date.now() - startedAt,
      ...extra,
    });
    return result;
  } catch (err) {
    span.setStatus({ code: SpanStatusCode.ERROR });
    span.recordException(err instanceof Error ? err : new Error(String(err)));
    logMetric({
      fn,
      status: "error",
      durationMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
      ...extra,
    });
    throw err;
  } finally {
    span.setAttribute("durationMs", Date.now() - startedAt);
    span.end();
  }
}
