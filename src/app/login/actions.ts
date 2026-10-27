"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { loginPath, safeNextPath } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/supabase/server";

// Вхід email + пароль. Реєстрації в шаблоні немає: користувачів створює
// scripts/create-demo-users.mjs (Admin API), бо вбудований SMTP Supabase
// надсилає лише 2 листи/год і лише членам команди проєкту.
export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  // Сторінка, яку користувач відкривав до входу; після входу повертаємо туди, якщо шлях безпечний.
  const next = safeNextPath(formData.get("next"));

  if (!email || !password) {
    redirect(loginPath(next, "missing"));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Не показуємо текст помилки Auth: він може підказати, чи існує email.
    redirect(loginPath(next, "invalid"));
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
