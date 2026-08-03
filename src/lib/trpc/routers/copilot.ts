import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../server";

export const copilotRouter = router({
  listChats: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.copilotChat.findMany({
      where: { organizationId: ctx.orgId },
      orderBy: { updatedAt: "desc" },
      include: { messages: { take: 1, orderBy: { createdAt: "desc" } } },
    });
  }),

  getChat: protectedProcedure
    .input(z.object({ chatId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.copilotChat.findFirst({
        where: { id: input.chatId, organizationId: ctx.orgId },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
    }),

  rateMessage: protectedProcedure
    .input(
      z.object({
        messageId: z.string(),
        rating: z.number().int().min(-1).max(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const message = await ctx.prisma.copilotMessage.findUnique({
        where: { id: input.messageId },
        select: { chatId: true },
      });
      if (!message) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });
      }
      const chat = await ctx.prisma.copilotChat.findFirst({
        where: { id: message.chatId, organizationId: ctx.orgId },
        select: { id: true },
      });
      if (!chat) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat not found",
        });
      }
      return ctx.prisma.copilotMessage.update({
        where: { id: input.messageId },
        data: { rating: input.rating },
      });
    }),
});
