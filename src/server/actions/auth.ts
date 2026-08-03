"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function signup(formData: {
  email: string;
  password: string;
  name: string;
  orgName: string;
}) {
  const result = await auth.api.signUpEmail({
    body: {
      email: formData.email,
      password: formData.password,
      name: formData.name,
    },
  });

  if (result) {
    await auth.api.createOrganization({
      body: {
        name: formData.orgName,
        slug: formData.orgName.toLowerCase().replace(/\s+/g, "-"),
        userId: result.user.id,
      },
      headers: await headers(),
    });
  }

  redirect("/dashboard");
}

export async function login(formData: { email: string; password: string }) {
  await auth.api.signInEmail({
    body: {
      email: formData.email,
      password: formData.password,
    },
  });

  redirect("/dashboard");
}

export async function logout() {
  await auth.api.signOut({
    headers: await headers(),
  });
  redirect("/login");
}
