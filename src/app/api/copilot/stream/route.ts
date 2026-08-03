import { NextRequest } from "next/server";
import { requireSession, getOrganizationId } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { getCopilotRatelimit } from "@/lib/rate-limit";
import { createCopilotStream, type CopilotMessage } from "@/lib/ai/copilot";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let session: Awaited<ReturnType<typeof requireSession>>;
  let orgId: string;
  try {
    session = await requireSession();
    orgId = await getOrganizationId();
  } catch {
    return Response.json({ error: "Non autorisé" }, { status: 401 });
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true },
  });
  const limiter = getCopilotRatelimit((org?.plan ?? "FREE") as "FREE" | "STARTER" | "PRO" | "ENTERPRISE");
  if (limiter) {
    const { success } = await limiter.limit(session.user.id);
    if (!success) {
      return Response.json(
        { error: "Quota Copilot atteint. Réessayez plus tard ou passez à un plan supérieur." },
        { status: 429 }
      );
    }
  }

  let body: { chatId?: string; content?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const content = body.content?.trim();
  if (!content) {
    return Response.json({ error: "Message vide" }, { status: 400 });
  }

  let chatId = body.chatId;
  if (chatId) {
    const existing = await prisma.copilotChat.findFirst({
      where: { id: chatId, organizationId: orgId },
      select: { id: true },
    });
    if (!existing) {
      return Response.json({ error: "Chat introuvable" }, { status: 404 });
    }
  } else {
    const chat = await prisma.copilotChat.create({
      data: {
        organizationId: orgId,
        userId: session.user.id,
        title: content.slice(0, 50),
      },
    });
    chatId = chat.id;
  }

  await prisma.copilotMessage.create({
    data: { chatId, role: "USER", content },
  });

  const history = await prisma.copilotMessage.findMany({
    where: { chatId },
    orderBy: { createdAt: "asc" },
  });

  const messages: CopilotMessage[] = history.map((m) => ({
    role:
      m.role === "USER"
        ? "user"
        : m.role === "SYSTEM"
          ? "system"
          : "assistant",
    content: m.content,
  }));

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let full = "";
      try {
        const result = createCopilotStream(orgId, messages);
        for await (const chunk of result.textStream) {
          full += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            "Une erreur est survenue lors de la génération de la réponse. " +
              (err instanceof Error ? err.message : "")
          )
        );
      } finally {
        if (full.trim()) {
          await prisma.copilotMessage
            .create({
              data: { chatId: chatId!, role: "ASSISTANT", content: full },
            })
            .catch(() => {});
          await prisma.copilotChat
            .update({ where: { id: chatId! }, data: { updatedAt: new Date() } })
            .catch(() => {});
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
