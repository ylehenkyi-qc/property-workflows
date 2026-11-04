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

// Читання вендора: лише свої запуски й задачі. Дані: A запускає «Apartment 12, move-in» з V на задачах 3 і 4
// та «Apartment 14, repair» без призначень вендору.
const TEMPLATE_TABLES = [
  "templates",
  "template_sections",
  "template_tasks",
  "template_versions",
  "template_version_sections",
  "template_version_tasks",
  "template_drafts",
] as const;

async function launchAs(userId: string, caseName: string, assignments: { template_task_id: string; assignee_id: string }[]) {
  const [row] = await t.asUser<{ id: string }>(userId, "select public.launch_run($1::uuid, $2, $3::jsonb) as id", [
    SEED,
    caseName,
    JSON.stringify(assignments),
  ]);
  return row.id;
}

async function setupVendorRuns() {
  const tasks = await orderedVersionTasks();
  const run12 = await launchAs(
    u[A],
    "Apartment 12, move-in",
    [tasks[2], tasks[3]].map((task) => ({ template_task_id: task.id, assignee_id: u[V1] })),
  );
  const run14 = await launchAs(u[A], "Apartment 14, repair", []);
  // Дані самі існують: 5 задач у кожному запуску, 3 і 4 запуску 12 — на V.
  const all = await t.asService<{ name: string }>("select name from public.run_tasks where run_id = $1", [run12]);
  expect(all).toHaveLength(5);
  expect(await t.asService("select id from public.run_tasks where run_id = $1", [run14])).toHaveLength(5);
  return { tasks, run12, run14 };
}

const rowsOf = (userId: string, table: string) => t.asUser<Record<string, unknown>>(userId, `select * from public.${table}`);

describe("читання вендора", () => {
  it("AC-VENDOR-03: вендор бачить лише запуск, де має задачі, зі статусом запуску й лічильником лише своїх задач", async () => {
    await setupVendorRuns();

    const rows = await t.asUser<Record<string, unknown>>(u[V1], "select * from public.list_vendor_runs()");

    expect(rows).toHaveLength(1);
    expect(rows[0].case_name).toBe("Apartment 12, move-in");
    expect(rows[0].status).toBe("in_progress");
    expect(Number(rows[0].tasks_total)).toBe(2);
    expect(Number(rows[0].tasks_done)).toBe(0);
    expect(rows.map((r) => r.case_name)).not.toContain("Apartment 14, repair");
  });

  it("AC-VENDOR-04: вендор читає рівно свої задачі 3 і 4 з секціями, без чужих задач, запусків, профілів і email", async () => {
    const { tasks, run12 } = await setupVendorRuns();

    const own = await t.asUser<{ name: string; required: boolean; status: string; section_id: string; run_id: string }>(
      u[V1],
      "select * from public.run_tasks",
    );
    expect(own.map((r) => r.name).sort()).toEqual([tasks[2].name, tasks[3].name].sort());
    for (const r of own) {
      expect(typeof r.required).toBe("boolean");
      expect(r.status).toBe("to_do");
      expect(r.run_id).toBe(run12);
    }
    for (const i of [0, 1, 4]) expect(own.map((r) => r.name)).not.toContain(tasks[i].name);

    // Назва секції кожної задачі — через run_sections; очікування з service_role.
    const expected = await t.asService<{ name: string; section: string }>(
      `select rt.name, rs.name as section from public.run_tasks rt
       join public.run_sections rs on rs.id = rt.section_id
       where rt.run_id = $1 and rt.name = any($2::text[])`,
      [run12, [tasks[2].name, tasks[3].name]],
    );
    expect(expected).toHaveLength(2);
    const joined = await t.asUser<{ name: string; section: string }>(
      u[V1],
      `select rt.name, rs.name as section from public.run_tasks rt
       join public.run_sections rs on rs.id = rt.section_id`,
    );
    expect([...joined].sort((a, b) => a.name.localeCompare(b.name))).toEqual(
      [...expected].sort((a, b) => a.name.localeCompare(b.name)),
    );

    // run_sections — лише секції, де є задачі V.
    const sections = await t.asUser<{ id: string; name: string }>(u[V1], "select id, name from public.run_sections");
    const ownSectionIds = new Set(own.map((r) => r.section_id));
    expect(sections.length).toBeGreaterThan(0);
    expect(new Set(sections.map((s) => s.id))).toEqual(ownSectionIds);

    // Рядки запуску (template_version, manager_id), чужі профілі й виконавці недоступні.
    expect(await rowsOf(u[V1], "runs")).toHaveLength(0);
    const profiles = await t.asUser<{ id: string }>(u[V1], "select id from public.profiles");
    expect(profiles.map((p) => p.id)).toEqual([u[V1]]);
    expect(await rowsOf(u[V1], "list_assignable_users()")).toHaveLength(0);
  });

  it("AC-VENDOR-06: запуск, де вендор без задач, недоступний за прямим id; контроль — свій запуск знаходиться", async () => {
    const { run12, run14 } = await setupVendorRuns();

    expect(await t.asUser(u[V1], "select * from public.run_tasks where run_id = $1", [run14])).toHaveLength(0);
    expect(await t.asUser(u[V1], "select * from public.run_sections where run_id = $1", [run14])).toHaveLength(0);
    expect(await t.asUser(u[V1], "select * from public.runs where id = $1", [run14])).toHaveLength(0);
    expect(await t.asUser(u[V1], "select * from public.list_vendor_runs($1::uuid)", [run14])).toHaveLength(0);

    const own = await t.asUser<{ id: string }>(u[V1], "select * from public.list_vendor_runs($1::uuid)", [run12]);
    expect(own).toHaveLength(1);
    expect(own[0].id).toBe(run12);
  });

  it("AC-VENDOR-08: шаблони для вендора порожні в усіх семи таблицях, адміністратору й менеджеру B вони доступні", async () => {
    await setupVendorRuns();

    for (const table of TEMPLATE_TABLES) {
      expect(await rowsOf(u[V1], table), `vendor ${table}`).toHaveLength(0);
      expect((await rowsOf(u[ADMIN], table)).length, `admin ${table}`).toBeGreaterThan(0);
    }
    const names = (await rowsOf(u[B], "templates")).map((r) => r.name);
    expect(names).toContain("Tenant move-in");
  });

  it("AC-VENDOR-10: вендор без задач бачить порожні списки запусків і задач", async () => {
    await setupVendorRuns();

    expect(await t.asUser(u[V2], "select * from public.list_vendor_runs()")).toHaveLength(0);
    expect(await rowsOf(u[V2], "run_tasks")).toHaveLength(0);
    expect(await rowsOf(u[V2], "runs")).toHaveLength(0);
  });

  it("менеджери й адміністратор читають запуск і задачі як раніше; list_vendor_runs для них порожній", async () => {
    const tasks = await orderedVersionTasks();
    const run = await launchAs(
      u[A],
      "Apartment 12, move-in",
      [
        { template_task_id: tasks[0].id, assignee_id: u[B] },
        { template_task_id: tasks[2].id, assignee_id: u[V1] },
      ],
    );

    for (const who of [A, ADMIN, B]) {
      const runs = await t.asUser<{ id: string }>(u[who], "select id from public.runs where id = $1", [run]);
      expect(runs, `${who} runs`).toHaveLength(1);
      const rows = await t.asUser(u[who], "select id from public.run_tasks where run_id = $1", [run]);
      expect(rows, `${who} tasks`).toHaveLength(5);
      expect(await t.asUser(u[who], "select * from public.list_vendor_runs()"), `${who} vendor runs`).toHaveLength(0);
    }
  });
});

// Група 3: вендор позначає виконаною свою задачу (mark_task_done), чужу — не може.
const FOREIGN_TASK_DENIED = "Only the task's assignee, the run manager, or an administrator can mark a task as done";

async function runSnapshot(runId: string) {
  const rows = await t.asService<{ id: string; name: string; status: string }>(
    "select id, name, status from public.run_tasks where run_id = $1 order by name",
    [runId],
  );
  const [run] = await t.asService<{ status: string }>("select status from public.runs where id = $1", [runId]);
  return { tasks: rows, runStatus: run.status };
}
const markDoneAs = (email: string, taskId: string) =>
  t.asUser(u[email], "select public.mark_task_done($1::uuid)", [taskId]);

describe("вендор позначає задачу виконаною", () => {
  it("AC-VENDOR-05: вендор позначає свою задачу 3, не останню обов'язкову, — вона «done», V бачить 1 з 2, запуск лишається «in progress»", async () => {
    const { tasks, run12 } = await setupVendorRuns();
    const before = await runSnapshot(run12);
    const task3 = before.tasks.find((r) => r.name === tasks[2].name)!;

    await markDoneAs(V1, task3.id);

    const after = await runSnapshot(run12);
    for (const row of after.tasks) {
      expect(row.status, row.name).toBe(row.name === tasks[2].name ? "done" : "to_do");
    }
    expect(after.runStatus).toBe("in_progress");
    const runs = await t.asUser<Record<string, unknown>>(u[V1], "select * from public.list_vendor_runs()");
    expect(runs).toHaveLength(1);
    expect(runs[0].id).toBe(run12);
    expect(Number(runs[0].tasks_total)).toBe(2);
    expect(Number(runs[0].tasks_done)).toBe(1);
    expect(runs[0].status).toBe("in_progress");
  });

  it("AC-VENDOR-07: вендор напряму позначає чужу задачу 1 — дослівна відмова, задача лишається «to do», решта без змін", async () => {
    const { tasks, run12 } = await setupVendorRuns();
    const before = await runSnapshot(run12);
    const task1 = before.tasks.find((r) => r.name === tasks[0].name)!;
    expect(task1.status).toBe("to_do");

    await expect(markDoneAs(V1, task1.id)).rejects.toThrow(FOREIGN_TASK_DENIED);

    expect(await runSnapshot(run12)).toEqual(before);
  });

  it("AC-VENDOR-07: задача запуску, де в вендора немає задач, — «Run not found», задача лишається «to do»", async () => {
    const { run12, run14 } = await setupVendorRuns();
    const beforeOther = await runSnapshot(run14);
    const beforeOwn = await runSnapshot(run12);

    await expect(markDoneAs(V1, beforeOther.tasks[0].id)).rejects.toThrow("Run not found");

    expect(beforeOther.tasks[0].status).toBe("to_do");
    expect(await runSnapshot(run14)).toEqual(beforeOther);
    expect(await runSnapshot(run12)).toEqual(beforeOwn);
  });

  it("AC-VENDOR-07: неіснуючий id задачі дає те саме «Run not found», дані не змінились", async () => {
    const { run12, run14 } = await setupVendorRuns();
    const before12 = await runSnapshot(run12);
    const before14 = await runSnapshot(run14);

    await expect(markDoneAs(V1, "11111111-2222-4333-8444-555555555555")).rejects.toThrow("Run not found");

    expect(await runSnapshot(run12)).toEqual(before12);
    expect(await runSnapshot(run14)).toEqual(before14);
  });

  it("AC-VENDOR-07: уже виконана чужа задача 1 — відмова, вона лишається «done», стан не змінився", async () => {
    const { tasks, run12 } = await setupVendorRuns();
    const task1 = (await runSnapshot(run12)).tasks.find((r) => r.name === tasks[0].name)!;
    await markDoneAs(A, task1.id);
    const before = await runSnapshot(run12);
    expect(before.tasks.find((r) => r.id === task1.id)!.status).toBe("done");

    await expect(markDoneAs(V1, task1.id)).rejects.toThrow(FOREIGN_TASK_DENIED);

    expect(await runSnapshot(run12)).toEqual(before);
  });

  it("вендор позначає власну необов'язкову задачу в уже завершеному запуску — вона «done», запуск лишається «completed»", async () => {
    const { tasks, run12 } = await setupVendorRuns();
    const byName = Object.fromEntries((await runSnapshot(run12)).tasks.map((r) => [r.name, r.id]));
    // У знімку версії 1 обов'язкові — задачі 1, 2 і 3; задача 4 вендора необов'язкова.
    for (const i of [0, 1, 2]) await markDoneAs(ADMIN, byName[tasks[i].name]);
    expect((await runSnapshot(run12)).runStatus).toBe("completed");

    await markDoneAs(V1, byName[tasks[3].name]);

    const after = await runSnapshot(run12);
    expect(after.tasks.find((r) => r.name === tasks[3].name)!.status).toBe("done");
    expect(after.runStatus).toBe("completed");
  });
});
