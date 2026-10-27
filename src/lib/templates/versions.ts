import { formatVersionDate } from "./format-date";

export type VersionRow = { version: number; savedAt: string; authorEmail: string };

// Рядки списку версій (AC-EDITOR-05): номер, дата й час за Києвом, email автора; новіші версії першими.
export function buildVersionRows(
  versions: readonly { version: number; created_at: string; created_by: string | null }[],
  authors: readonly { id: string; email: string | null }[],
): VersionRow[] {
  return [...versions]
    .sort((a, b) => b.version - a.version)
    .map((v) => ({
      version: v.version,
      savedAt: formatVersionDate(v.created_at),
      authorEmail: authors.find((author) => author.id === v.created_by)?.email ?? "—",
    }));
}
