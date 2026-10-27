import type { createClient } from "@/lib/supabase/server";

export type VersionTask = { id: string; name: string; required: boolean; position: number };
export type VersionSection = { id: string; name: string; position: number; tasks: VersionTask[] };

// Секції й задачі знімка версії шаблону (не робочої копії): його читають менеджер, форма запуску й сторінка шаблону.
// Що саме дозволено бачити, вирішує RLS (менеджер — лише поточну версію).
export async function loadVersionContent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  templateId: string,
  version: number,
): Promise<VersionSection[]> {
  const { data: sections, error: sectionsError } = await supabase
    .from("template_version_sections")
    .select("id, name, position")
    .eq("template_id", templateId)
    .eq("version", version)
    .order("position");
  if (sectionsError) throw new Error("Failed to load template sections");
  if (!sections?.length) return [];

  const { data: tasks, error: tasksError } = await supabase
    .from("template_version_tasks")
    .select("id, name, required, position, section_id")
    .in(
      "section_id",
      sections.map((section) => section.id),
    )
    .order("position");
  if (tasksError) throw new Error("Failed to load template tasks");

  return sections.map((section) => ({
    ...section,
    tasks: (tasks ?? [])
      .filter((task) => task.section_id === section.id)
      .map(({ id, name, required, position }) => ({ id, name, required, position })),
  }));
}
