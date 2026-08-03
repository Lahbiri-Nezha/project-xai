import "server-only";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

let sdk: NodeSDK | null = null;
let started = false;

/**
 * Initialise le SDK OpenTelemetry (exporter OTLP HTTP) si un endpoint est
 * configuré via `OTEL_EXPORTER_OTLP_ENDPOINT` (ou `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`).
 * Sans endpoint, le tracing reste inactif : inngest fonctionne normalement.
 */
export function initOpenTelemetry(): boolean {
  if (started) return true;
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) return false;

  try {
    sdk = new NodeSDK({
      serviceName: process.env.OTEL_SERVICE_NAME ?? "sales-insight",
      traceExporter: new OTLPTraceExporter(),
    });
    sdk.start();
    started = true;
    console.log(
      `[otel] SDK OpenTelemetry démarré (OTLP HTTP -> ${process.env.OTEL_EXPORTER_OTLP_ENDPOINT})`
    );
    return true;
  } catch (err) {
    console.error(
      "[otel] échec d'initialisation OpenTelemetry, tracing désactivé :",
      err
    );
    return false;
  }
}

export async function flushOpenTelemetry(): Promise<void> {
  if (sdk) {
    try {
      await sdk.shutdown();
    } catch {
      /* non bloquant */
    }
  }
}
