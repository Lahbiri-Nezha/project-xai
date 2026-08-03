import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "sales-insight" });

export async function sendEvent(
  name: string,
  data: Record<string, unknown>,
  fallback?: () => Promise<void>
) {
  let sent = false;
  try {
    await inngest.send({ name, data });
    sent = true;
  } catch {
    /* Inngest non configuré : l'événement est ignoré sans bloquer le flux principal */
  }
  if (!sent && fallback) {
    try {
      await fallback();
    } catch (err) {
      console.error(`[inngest] fallback synchrone échoué pour ${name}`, err);
    }
  }
}
