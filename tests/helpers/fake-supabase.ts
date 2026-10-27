// Підроблений клієнт Supabase для тестів сторінок (без мережі й бази): ланцюжок select/eq/in/order віддає заздалегідь
// задані дані таблиці; rpc — задані дані функції. Не файл *.test.ts, тому Vitest сам його не запускає.
type Result = { data: unknown; error?: unknown };

function query(result: Result) {
  const q: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order"]) q[method] = () => q;
  q.maybeSingle = () => Promise.resolve({ error: null, ...result });
  q.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve({ error: null, ...result }).then(resolve, reject);
  return q;
}

export function fakeSupabase(options: {
  tables?: Record<string, Result>;
  rpc?: Record<string, Result>;
  claims?: { sub: string; email?: string } | null;
}) {
  const { tables = {}, rpc = {}, claims = { sub: "user-1", email: "manager1@example.test" } } = options;
  return {
    auth: { getClaims: async () => ({ data: claims ? { claims } : null }) },
    from: (table: string) => query(tables[table] ?? { data: [] }),
    rpc: async (name: string) => ({ error: null, ...(rpc[name] ?? { data: [] }) }),
  };
}
