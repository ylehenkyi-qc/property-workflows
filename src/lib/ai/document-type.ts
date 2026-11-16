import { kyivParts } from "@/lib/templates/format-date";

// Тип документа в блоці «Parse a document» (вимога PM, припущення): два значення, пропонує AI, користувач може змінити
// перед збереженням. Значення в базі — kind: «request» чи «estimate»; підпис у інтерфейсі — як у вимозі PM.
export const DOCUMENT_TYPES = [
  { value: "request", label: "Maintenance request" },
  { value: "estimate", label: "Estimate" },
] as const;

export type DocumentKind = (typeof DOCUMENT_TYPES)[number]["value"];

export function documentTypeLabel(kind: string): string {
  return DOCUMENT_TYPES.find((t) => t.value === kind)?.label ?? kind;
}

const KYIV = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Kyiv",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// «12 Nov 2026, 10:15» за київським часом (AC-DOCAI-04).
export function formatConfirmedAt(iso: string): string {
  const part = kyivParts(KYIV, iso);
  return part ? `${part.day} ${part.month} ${part.year}, ${part.hour}:${part.minute}` : "—";
}
