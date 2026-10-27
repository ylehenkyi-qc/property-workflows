// Підроблений клієнт Supabase для тестів сторінок (без мережі й бази): ланцюжок select/eq/in/order віддає заздалегідь
// задані дані таблиці; rpc — задані дані функції. Не файл *.test.ts, тому Vitest сам його не запускає.
// calls — журнал звернень до таблиць і функцій: так тест бачить, що сторінка НЕ читала даних (гість, менеджер без прав).
// single — що віддає maybeSingle(), якщо воно відрізняється від data (таблиця profiles: один рядок ролі й список авторів).
type Result = { data: unknown; error?: unknown; single?: unknown };

function query({ single, ...result }: Result) {
  const q: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order"]) q[method] = () => q;
  q.maybeSingle = () => Promise.resolve({ error: null, ...result, ...(single !== undefined ? { data: single } : {}) });
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
  const calls = { from: [] as string[], rpc: [] as string[] };
  return {
    calls,
    auth: { getClaims: async () => ({ data: claims ? { claims } : null }) },
    from: (table: string) => {
      calls.from.push(table);
      return query(tables[table] ?? { data: [] });
    },
    rpc: async (name: string) => {
      calls.rpc.push(name);
      return { error: null, ...(rpc[name] ?? { data: [] }) };
    },
  };
}
