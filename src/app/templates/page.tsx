import Link from "next/link";
import { redirect } from "next/navigation";
import { PageMessage } from "@/components/page-message";
import { PageShell } from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/require-role";
import { loginPath } from "@/lib/auth/safe-next";
import { NOT_ENOUGH_RIGHTS } from "@/lib/templates/messages";
import { linkButtonClass } from "@/lib/ui/link-button";
import { createTemplate } from "./actions";

// Тексти цих двох помилок вимогами не задані (формулювання розробника).
const ERRORS: Record<string, string> = {
  forbidden: NOT_ENOUGH_RIGHTS,
  create_failed: "Could not create the template",
};

// Список шаблонів. Що бачить користувач, вирішує RLS: адміністратор — усі шаблони (з позначкою «Unpublished changes»),
// менеджер — лише ті, що вже збережені як версія (AC-EDITOR-02).
export default async function TemplatesPage({ searchParams }: PageProps<"/templates">) {
  const auth = await requireRole(["manager", "admin"]);
  if (auth.status === "unauthenticated") redirect(loginPath("/templates"));
  if (auth.status === "forbidden") {
    return (
      <PageShell>
        <PageMessage title={NOT_ENOUGH_RIGHTS} link={{ href: "/", label: "Back to home" }} />
      </PageShell>
    );
  }
  const { supabase, role } = auth;
  const isAdmin = role === "admin";

  const { error } = await searchParams;
  const errorMessage = typeof error === "string" ? ERRORS[error] : undefined;

  const { data: templates, error: templatesError } = await supabase
    .from("templates")
    .select("id, name, current_version")
    .order("name");
  if (templatesError) throw new Error("Failed to load templates");

  // Прапорець чернетки читає лише адміністратор (для менеджера RLS не віддасть жодного рядка).
  const { data: drafts, error: draftsError } = isAdmin
    ? await supabase.from("template_drafts").select("template_id, has_unpublished_changes")
    : { data: [], error: null };
  if (draftsError) throw new Error("Failed to load template drafts");
  const unpublished = new Set((drafts ?? []).filter((d) => d.has_unpublished_changes).map((d) => d.template_id));

  return (
    <PageShell>
      <Link href="/" className="text-sm text-muted-foreground underline">
        Home
      </Link>
      <h1 className="text-2xl font-semibold">Templates</h1>

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {(templates ?? []).length === 0 ? (
        <PageMessage
          level={2}
          title="No templates yet."
          description={isAdmin ? "Create a template to start." : "An administrator has to save a template first."}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead>Version</TableHead>
              {isAdmin ? <TableHead>Changes</TableHead> : null}
              {isAdmin ? <TableHead>Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(templates ?? []).map((template) => (
              <TableRow key={template.id} data-testid="template-row">
                <TableCell className="font-medium">
                  <Link href={`/templates/${template.id}`} className="underline underline-offset-4">
                    {template.name}
                  </Link>
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {template.current_version != null ? `Version ${template.current_version}` : "Not saved yet"}
                </TableCell>
                {isAdmin ? (
                  <TableCell>
                    {unpublished.has(template.id) ? <StatusBadge status="unpublished" /> : null}
                  </TableCell>
                ) : null}
                {isAdmin ? (
                  <TableCell>
                    <span className="flex flex-wrap gap-3 text-sm">
                      <Link href={`/templates/${template.id}/edit`} className="underline underline-offset-4">
                        Edit
                      </Link>
                      <Link href={`/templates/${template.id}/versions`} className="underline underline-offset-4">
                        Versions
                      </Link>
                    </span>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {isAdmin ? (
        <form action={createTemplate} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">New template</h2>
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Template name</Label>
            <Input id="name" name="name" type="text" />
          </div>
          <Button type="submit" variant="outline" className="self-start">
            Create template
          </Button>
        </form>
      ) : null}

      <Link href="/runs/new" className={linkButtonClass({ variant: "link" }, "h-auto self-start px-0")}>
        Launch a template
      </Link>
    </PageShell>
  );
}
