"use server";

import { createAuthClient } from "@/lib/supabase/auth-client";
import { revalidateTag } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

export async function signIn(email: string) {
  const headerList = headers();

  const origin = headerList.get("origin");

  const cookieStore = cookies();
  const authClient = createAuthClient(cookieStore);
  const { error } = await authClient.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/daily-scrum/auth/confirm`,
    },
  });

  if (error) {
    return {
      error,
    };
  }

  revalidateTag("orgs-where-current-user-is-member");

  return redirect("/daily-scrum/sign-in/check-email");
}