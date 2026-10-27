import Link from "next/link";
import { redirect } from "next/navigation";
import { AppSelect } from "@/components/app-select";
import { PageShell } from "@/components/page-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginPath } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/supabase/server";
import { ASSIGNEE_ME } from "@/lib/runs/assignees";
import { isLaunchErrorCode, LAUNCH_ERRORS } from "@/lib/runs/launchErrors";
import { loadVersionContent } from "@/lib/templates/load-version";
import { launchRun } from "./actions";

// Запуск шаблону: крок 1 — вибір шаблону (GET), крок 2 — назва випадку й виконавці задач (AC-RUN-01…09); шаблон без
// збереженої версії адміністратор бачить недоступним (AC-EDITOR-10).
export default async function NewRunPage({ searchParams }: PageProps<"/runs/new">) {
  const supabase = await createClient();

  // getClaims() перевіряє JWT. getSession() для авторизації на сервері не використовуємо.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) {
    redirect(loginPath("/runs/new"));
  }

  const { template, error } = await searchParams;
  const errorMessage = isLaunchErrorCode(error) ? LAUNCH_ERRORS[error] : undefined;

  // Запуск іде лише зі збереженої версії (AC-EDITOR-10, 11): шаблон без версії ніхто не обирає. RLS віддає такий шаблон лише
  // адміністратору, і ми показуємо його окремо як недоступний; менеджер його не бачить.
  const { data: allTemplates } = await supabase.from("templates").select("id, name, current_version").order("name");
  const templates = (allTemplates ?? []).filter((t) => t.current_version != null);
  const unavailable = (allTemplates ?? []).filter((t) => t.current_version == null);
  const selected = templates.find((t) => t.id === template);

  // Секції й задачі — зі знімка ПОТОЧНОЇ версії (а не з робочої копії): менеджер її не бачить, а launch_run копіює знімок.
  const sections =
    selected?.current_version != null ? await loadVersionContent(supabase, selected.id, selected.current_version) : [];

  // Виконавця можна обрати з manager/admin: лише id і email (без ролі й іншого профілю).
  const { data: users } = selected
    ? await supabase.rpc("list_assignable_users")
    : { data: null };
  const otherUsers = (users ?? []).filter((u) => u.id !== claims.sub);

  return (
    <PageShell>
      <Link href="/" className="text-sm text-muted-foreground underline">
        Home
      </Link>
      <h1 className="text-2xl font-semibold">New run</h1>

      <form method="get" action="/runs/new" className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="template">Template</Label>
          <AppSelect
            id="template"
            name="template"
            placeholder="Choose a template"
            defaultValue={selected?.id}
            options={templates.map((t) => ({ value: t.id, label: t.name }))}
          />
        </div>
        {unavailable.length > 0 ? (
          <ul data-testid="unavailable-templates" className="flex flex-col gap-1 text-sm text-muted-foreground">
            {unavailable.map((t) => (
              <li key={t.id} data-testid="unavailable-template">
                {t.name} — Save the template to launch it
              </li>
            ))}
          </ul>
        ) : null}
        <Button type="submit" variant="outline" className="self-start">
          Choose template
        </Button>
      </form>

      {selected ? (
        <form action={launchRun} className="flex flex-col gap-6">
          <input type="hidden" name="template_id" value={selected.id} />
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="case_name">Case name</Label>
            <Input id="case_name" name="case_name" type="text" />
          </div>

          {sections.map((section) => (
            <fieldset key={section.id} className="flex flex-col gap-3">
              <legend className="mb-2 text-lg font-semibold">{section.name}</legend>
              {section.tasks.map((task) => (
                <div key={task.id} className="flex flex-col gap-2">
                  <Label htmlFor={`assignee_${task.id}`}>{task.name}</Label>
                  <AppSelect
                    id={`assignee_${task.id}`}
                    name={`assignee_${task.id}`}
                    defaultValue={ASSIGNEE_ME}
                    options={[{ value: ASSIGNEE_ME, label: "Me" }, ...otherUsers.map((u) => ({ value: u.id, label: u.email ?? "—" }))]}
                  />
                </div>
              ))}
            </fieldset>
          ))}

          <Button type="submit" className="self-start">
            Launch
          </Button>
        </form>
      ) : null}
    </PageShell>
  );
}
