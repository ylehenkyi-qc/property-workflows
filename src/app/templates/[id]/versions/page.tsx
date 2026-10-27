import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageMessage } from "@/components/page-message";
import { PageShell } from "@/components/page-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/require-role";
import { loginPath } from "@/lib/auth/safe-next";
import { NOT_ENOUGH_RIGHTS } from "@/lib/templates/messages";
import { buildVersionRows } from "@/lib/templates/versions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Список версій шаблону (AC-EDITOR-05, AC-EDITOR-07): номер, дата й час за Києвом, email автора, новіші першими.
// Менеджеру за прямим посиланням — лише «Not enough rights», і версій ніхто не запитує (їх не віддасть і база).
export default async function TemplateVersionsPage({ params }: PageProps<"/templates/[id]/versions">) {
  const { id } = await params;

  const auth = await requireRole("admin");
  if (auth.status === "unauthenticated") redirect(loginPath(`/templates/${id}/versions`));
  if (auth.status === "forbidden") {
    return (
      <PageShell>
        <PageMessage title={NOT_ENOUGH_RIGHTS} link={{ href: "/templates", label: "Back to templates" }} />
      </PageShell>
    );
  }
  const { supabase } = auth;

  if (!UUID.test(id)) notFound();

  const { data: template, error: templateError } = await supabase
    .from("templates")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (templateError) throw new Error("Failed to load the template");
  if (!template) notFound();

  const { data: versions, error: versionsError } = await supabase
    .from("template_versions")
    .select("version, created_at, created_by")
    .eq("template_id", template.id)
    .order("version", { ascending: false });
  if (versionsError) throw new Error("Failed to load versions");

  const authorIds = [...new Set((versions ?? []).flatMap((v) => (v.created_by ? [v.created_by] : [])))];
  const { data: authors, error: authorsError } = authorIds.length
    ? await supabase.from("profiles").select("id, email").in("id", authorIds)
    : { data: [], error: null };
  if (authorsError) throw new Error("Failed to load authors");

  const rows = buildVersionRows(versions ?? [], authors ?? []);

  return (
    <PageShell>
      <Link href={`/templates/${template.id}`} className="text-sm text-muted-foreground underline">
        {template.name}
      </Link>
      <h1 className="text-2xl font-semibold">Versions</h1>

      {rows.length === 0 ? (
        <PageMessage level={2} title="No saved versions yet." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Version</TableHead>
              <TableHead>Saved</TableHead>
              <TableHead>Author</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.version} data-testid="version-row">
                <TableCell className="font-medium tabular-nums">Version {row.version}</TableCell>
                <TableCell className="tabular-nums">{row.savedAt}</TableCell>
                <TableCell className="text-muted-foreground">{row.authorEmail}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </PageShell>
  );
}
