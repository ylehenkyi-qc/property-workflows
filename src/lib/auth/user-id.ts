import type { createClient } from "@/lib/supabase/server";

// Ідентифікатор користувача з перевіреного JWT (getClaims); null — відвідувач без входу.
export async function currentUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
}
