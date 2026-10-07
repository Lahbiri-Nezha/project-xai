"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function createOrg(orgName: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return { error: "Not authenticated" };
  }

  try {
    await auth.api.createOrganization({
      body: {
        name: orgName,
        slug: orgName.toLowerCase().replace(/\s+/g, "-"),
        userId: session.user.id,
      },
      headers: await headers(),
    });
    return { success: true };
  } catch (err) {
    console.error("[createOrg]", err);
    return { error: "Failed to create organization" };
  }
}
