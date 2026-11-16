// Дата й час збереження версії для списку версій (AC-EDITOR-05): «DD.MM.YYYY HH:MM» за київським часом.
const KYIV = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Kyiv",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// Частини дати за форматером; null для неправильної дати. Спільне для формату версій і записів документів.
export function kyivParts(formatter: Intl.DateTimeFormat, iso: string): Record<string, string> | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return Object.fromEntries(formatter.formatToParts(date).map(({ type, value }) => [type, value]));
}

export function formatVersionDate(iso: string): string {
  const part = kyivParts(KYIV, iso);
  return part ? `${part.day}.${part.month}.${part.year} ${part.hour}:${part.minute}` : "—";
}
