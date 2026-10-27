import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { linkButtonClass } from "@/lib/ui/link-button";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./login/actions";

// Головна сторінка: хто увійшов і з якою роллю (з таблиці profiles).
// Сторінка читає cookies, тому рендериться динамічно (шаблон зібрано з --no-cache-components).
export default async function Home() {
  const supabase = await createClient();

  // getClaims() перевіряє JWT. getSession() для авторизації на сервері не використовуємо.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) {
    redirect("/login");
  }

  // RLS: користувач бачить лише власний профіль.
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, role")
    .eq("id", claims.sub)
    .maybeSingle();

  return (
    <PageShell>
      <h1 className="text-2xl font-semibold">Property Workflows</h1>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Email</dt>
        <dd data-testid="user-email">{profile?.email ?? claims.email ?? "—"}</dd>
        <dt className="text-muted-foreground">Role</dt>
        <dd data-testid="user-role">{profile?.role ?? "profile not found"}</dd>
      </dl>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/runs/new" className={linkButtonClass()}>
          New run
        </Link>
        <Link href="/runs" className={linkButtonClass({ variant: "outline" })}>
          Runs
        </Link>
        <Link href="/templates" className={linkButtonClass({ variant: "outline" })}>
          Templates
        </Link>
      </div>
      <form action={signOut}>
        <Button type="submit" variant="ghost">
          Sign out
        </Button>
      </form>
    </PageShell>
  );
}
