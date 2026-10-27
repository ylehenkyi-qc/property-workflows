// Куди вести користувача після входу (робоче рішення до solomchaak/property-workflows-spec#35): лише на відносний шлях
// цього самого сайту, інакше на «/». Параметр next приходить з адреси, тож вважаємо його недовіреним (open redirect).
const ORIGIN = "http://localhost";

export function safeNextPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  // «//host» і «/\host» браузер читає як чужий сайт; керівні символи в адресі не потрібні.
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  if ([...value].some((char) => char === "\\" || char.charCodeAt(0) < 32)) return "/";

  let url: URL;
  try {
    url = new URL(value, ORIGIN);
  } catch {
    return "/";
  }
  if (url.origin !== ORIGIN) return "/";
  // Назад на сторінку входу вести немає сенсу.
  if (url.pathname === "/login") return "/";
  return value;
}

// Адреса входу з пам'яттю про запитану сторінку: /login?next=%2Ftemplates%2F…
export function loginPath(next?: string, error?: string): string {
  const params = new URLSearchParams();
  const safe = safeNextPath(next);
  if (safe !== "/") params.set("next", safe);
  if (error) params.set("error", error);
  const query = params.toString();
  return query ? `/login?${query}` : "/login";
}
