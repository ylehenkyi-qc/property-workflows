import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { createClient } from "@/lib/supabase/server";
import { isLaunchErrorCode, LAUNCH_ERRORS } from "@/lib/runs/launchErrors";
import { launchRun } from "./actions";

// Запуск шаблону: крок 1 — вибір шаблону (GET), крок 2 — назва випадку й виконавці задач (AC-RUN-01…09).
export default async function NewRunPage({ searchParams }: PageProps<"/runs/new">) {
  const supabase = await createClient();

  // getClaims() перевіряє JWT. getSession() для авторизації на сервері не використовуємо.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) {
    redirect("/login");
  }

  const { template, error } = await searchParams;
  const errorMessage = isLaunchErrorCode(error) ? LAUNCH_ERRORS[error] : undefined;

  const { data: templates } = await supabase
    .from("templates")
    .select("id, name")
    .order("name");
  const selected = templates?.find((t) => t.id === template);

  const sections = selected
    ? ((
        await supabase
          .from("template_sections")
          .select("id, name, position")
          .eq("template_id", selected.id)
          .order("position")
      ).data ?? [])
    : [];
  const tasks = selected
    ? ((
        await supabase
          .from("template_tasks")
          .select("id, name, position, section_id")
          .eq("template_id", selected.id)
          .order("position")
      ).data ?? [])
    : [];

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
          <NativeSelect id="template" name="template" defaultValue={selected?.id ?? ""} className="w-full">
            <NativeSelectOption value="" disabled>
              Choose a template
            </NativeSelectOption>
            {(templates ?? []).map((t) => (
              <NativeSelectOption key={t.id} value={t.id}>
                {t.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
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
              {tasks
                .filter((task) => task.section_id === section.id)
                .map((task) => (
                  <div key={task.id} className="flex flex-col gap-2">
                    <Label htmlFor={`assignee_${task.id}`}>{task.name}</Label>
                    <NativeSelect
                      id={`assignee_${task.id}`}
                      name={`assignee_${task.id}`}
                      defaultValue=""
                      className="w-full"
                    >
                      <NativeSelectOption value="">Me</NativeSelectOption>
                      {otherUsers.map((u) => (
                        <NativeSelectOption key={u.id} value={u.id}>
                          {u.email}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
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
