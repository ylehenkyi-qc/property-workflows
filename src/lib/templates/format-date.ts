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

export function formatVersionDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const part = Object.fromEntries(KYIV.formatToParts(date).map(({ type, value }) => [type, value]));
  return `${part.day}.${part.month}.${part.year} ${part.hour}:${part.minute}`;
}
