import { notFound, redirect } from "next/navigation";
import { PageMessage } from "@/components/page-message";
import { PageShell } from "@/components/page-shell";
import { requireRole } from "@/lib/auth/require-role";
import { loginPath } from "@/lib/auth/safe-next";
import { buildDraft } from "@/lib/templates/draft";
import { NOT_ENOUGH_RIGHTS } from "@/lib/templates/messages";
import { TemplateEditor } from "./template-editor";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Редактор шаблону — лише для адміністратора (AC-EDITOR-09, AC-DSYS-02). Гість іде на вхід без жодного вмісту шаблону,
// менеджер бачить «Not enough rights» і «Back to templates» у загальному макеті; шаблон при цьому не читається й не змінюється.
export default async function EditTemplatePage({ params }: PageProps<"/templates/[id]/edit">) {
  const { id } = await params;

  const auth = await requireRole("admin");
  if (auth.status === "unauthenticated") redirect(loginPath(`/templates/${id}/edit`));
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
    .select("id, name, current_version")
    .eq("id", id)
    .maybeSingle();
  if (templateError) throw new Error("Failed to load the template");
  if (!template) notFound();

  // Робоча копія (з непублікованими змінами) — лише адміністратор; незалежні запити паралельно.
  const [sectionsResult, tasksResult, draftResult] = await Promise.all([
    supabase.from("template_sections").select("id, name, position").eq("template_id", template.id),
    supabase.from("template_tasks").select("id, name, required, position, section_id").eq("template_id", template.id),
    supabase.from("template_drafts").select("has_unpublished_changes").eq("template_id", template.id).maybeSingle(),
  ]);
  if (sectionsResult.error) throw new Error("Failed to load template sections");
  if (tasksResult.error) throw new Error("Failed to load template tasks");
  if (draftResult.error) throw new Error("Failed to load the template draft");

  return (
    <PageShell>
      <TemplateEditor
        templateId={template.id}
        templateName={template.name}
        initialDraft={buildDraft(sectionsResult.data ?? [], tasksResult.data ?? [])}
        initialDirty={draftResult.data?.has_unpublished_changes ?? template.current_version == null}
      />
    </PageShell>
  );
}
