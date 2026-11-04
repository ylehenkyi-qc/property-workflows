import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";

// Роль vendor (зовнішній підрядник) живе в Postgres: launch_run і list_assignable_users. Перевіряємо на PGlite без Docker.
// Кожен тест — нова база; відмовний тест перевіряє і відмову, і що дані не змінились.
const SEED = "a0000000-0000-4000-8000-000000000001"; // «Tenant move-in», версія 1, 5 задач
const ADMIN = "admin@example.test";
const A = "manager1@example.test"; // менеджер A, запускає шаблон
const B = "manager2@example.test"; // менеджер B
const V1 = "vendor1@example.test"; // вендор V
const V2 = "vendor2@example.test";

let t: TestDb;
let u: Record<string, string>;

beforeEach(async () => {
  t = await createTestDb();
  u = t.users;
});
afterEach(async () => {
  await t.close();
});

// Задачі знімка версії 1 у порядку «секція за позицією, задача за позицією» (задачі 1…5).
async function orderedVersionTasks(): Promise<{ id: string; name: string }[]> {
  return t.asService<{ id: string; name: string }>(
    `select vt.id, vt.name from public.template_version_tasks vt
     join public.template_version_sections vs on vs.id = vt.section_id
     join public.template_versions v on v.id = vt.version_id
     where v.template_id = $1 and v.version = 1
     order by vs.position, vt.position`,
    [SEED],
  );
}

const runCount = async () =>
  Number((await t.asService<{ n: string }>("select count(*) as n from public.runs"))[0].n);

describe("підрядник у запуску", () => {
  it("AC-VENDOR-01: менеджер призначає вендора виконавцем задач 3 і 4, решта задач лишається на менеджері", async () => {
    const tasks = await orderedVersionTasks();
    expect(tasks).toHaveLength(5);
    const assignments = [tasks[2], tasks[3]].map((task) => ({ template_task_id: task.id, assignee_id: u[V1] }));

    const [row] = await t.asUser<{ id: string }>(u[A], "select public.launch_run($1::uuid, $2, $3::jsonb) as id", [
      SEED,
      "Apartment 12, move-in",
      JSON.stringify(assignments),
    ]);

    const rows = await t.asService<{ name: string; assignee_id: string }>(
      "select name, assignee_id from public.run_tasks where run_id = $1",
      [row.id],
    );
    const assigneeOf = Object.fromEntries(rows.map((r) => [r.name, r.assignee_id]));
    expect(rows).toHaveLength(5);
    expect(assigneeOf[tasks[2].name]).toBe(u[V1]);
    expect(assigneeOf[tasks[3].name]).toBe(u[V1]);
    for (const i of [0, 1, 4]) expect(assigneeOf[tasks[i].name]).toBe(u[A]);
  });

  it("AC-VENDOR-09: вендор напряму викликає launch_run — відмова, запуск не створено, список запусків не змінився", async () => {
    const tasks = await orderedVersionTasks();
    const assignments = [{ template_task_id: tasks[0].id, assignee_id: u[V1] }];
    const before = await runCount();

    await expect(
      t.asUser(u[V1], "select public.launch_run($1::uuid, $2, $3::jsonb)", [
        SEED,
        "Apartment 12, move-in",
        JSON.stringify(assignments),
      ]),
    ).rejects.toThrow("Not authorized");

    expect(await runCount()).toBe(before);
    expect(await t.asService("select id from public.runs where manager_id = $1", [u[V1]])).toHaveLength(0);
  });
});

describe("вибір виконавця з підрядниками", () => {
  it("AC-VENDOR-02: менеджер бачить лише id й email менеджера B, адміністратора й вендорів, без імен і ролей", async () => {
    const rows = await t.asUser<Record<string, unknown>>(u[A], "select * from public.list_assignable_users()");

    const emails = rows.map((r) => r.email);
    expect(emails).toContain(B);
    expect(emails).toContain(ADMIN);
    expect(emails).toContain(V1);
    expect(emails).toContain(V2);
    for (const row of rows) expect(Object.keys(row).sort()).toEqual(["email", "id"]);
  });

  it("вендор не бачить email інших користувачів: вибір виконавця повертає порожній результат", async () => {
    const rows = await t.asUser(u[V1], "select * from public.list_assignable_users()");

    expect(rows).toHaveLength(0);
  });
});
