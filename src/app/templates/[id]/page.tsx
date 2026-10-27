import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageMessage } from "@/components/page-message";
import { PageShell } from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/require-role";
import { loginPath } from "@/lib/auth/safe-next";
import { loadVersionContent } from "@/lib/templates/load-version";
import { NOT_ENOUGH_RIGHTS } from "@/lib/templates/messages";
import { linkButtonClass } from "@/lib/ui/link-button";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Шаблон: поточна збережена версія — секції й задачі з «required»/«optional» (AC-EDITOR-02), після збереження — «Version N saved» (AC-EDITOR-03). Менеджеру RLS не віддає ні
// непублікованих змін, ні шаблону без збереженої версії (тоді «Template not found»); повідомлення «Unpublished changes»
// читає лише адміністратор.
export default async function TemplatePage({ params, searchParams }: PageProps<"/templates/[id]">) {
  const { id } = await params;
  const { saved } = await searchParams;

  const auth = await requireRole(["manager", "admin"]);
  if (auth.status === "unauthenticated") redirect(loginPath(`/templates/${id}`));
  if (auth.status === "forbidden") {
    return (
      <PageShell>
        <PageMessage title={NOT_ENOUGH_RIGHTS} link={{ href: "/", label: "Back to home" }} />
      </PageShell>
    );
  }
  const { supabase, role } = auth;
  const isAdmin = role === "admin";

  // Не-UUID не доходить до бази (там він дав би помилку типу, а не «не знайдено»).
  if (!UUID.test(id)) notFound();

  const { data: template, error } = await supabase
    .from("templates")
    .select("id, name, current_version")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Failed to load the template");
  if (!template) notFound();

  const sections =
    template.current_version != null ? await loadVersionContent(supabase, template.id, template.current_version) : [];

  let hasUnpublishedChanges = false;
  if (isAdmin) {
    const { data: draft, error: draftError } = await supabase
      .from("template_drafts")
      .select("has_unpublished_changes")
      .eq("template_id", template.id)
      .maybeSingle();
    if (draftError) throw new Error("Failed to load the template draft");
    hasUnpublishedChanges = draft?.has_unpublished_changes ?? template.current_version == null;
  }

  // «Version N saved» після збереження (AC-EDITOR-03): параметр лише підказка, показуємо тільки коли N — поточна версія.
  const savedVersion = typeof saved === "string" && /^[0-9]+$/.test(saved) ? Number(saved) : null;
  const justSaved = isAdmin && savedVersion !== null && savedVersion === template.current_version;

  return (
    <PageShell>
      <Link href="/templates" className="text-sm text-muted-foreground underline">
        Templates
      </Link>
      {justSaved ? (
        <Alert data-testid="version-saved">
          <AlertDescription>{`Version ${savedVersion} saved`}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold" data-testid="template-name">
          {template.name}
        </h1>
        <p className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span data-testid="template-version" className="tabular-nums">
            {template.current_version != null ? `Version ${template.current_version}` : "Not saved as a version yet"}
          </span>
          {hasUnpublishedChanges ? (
            <span data-testid="unpublished-changes">
              <StatusBadge status="unpublished" />
            </span>
          ) : null}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {template.current_version != null ? (
          <Link href={`/runs/new?template=${template.id}`} className={linkButtonClass()}>
            Launch
          </Link>
        ) : null}
        {isAdmin ? (
          <>
            <Link href={`/templates/${template.id}/edit`} className={linkButtonClass({ variant: "outline" })}>
              Edit
            </Link>
            <Link href={`/templates/${template.id}/versions`} className={linkButtonClass({ variant: "outline" })}>
              Versions
            </Link>
          </>
        ) : null}
      </div>

      {sections.map((section) => (
        <section key={section.id} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{section.name}</h2>
          <ul className="flex flex-col gap-2">
            {section.tasks.map((task) => (
              <li key={task.id} data-testid="template-task">
                <Card className="flex-row items-center gap-2 px-4 py-3 text-sm">
                  {task.name}
                  <Badge variant="outline">{task.required ? "required" : "optional"}</Badge>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </PageShell>
  );
}
