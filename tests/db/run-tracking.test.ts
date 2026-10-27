import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";

// Правила відстеження запусків живуть у Postgres (mark_task_done, RLS на runs/run_tasks, list_assignable_users):
// перевіряємо їх на PGlite без Docker. Кожен тест — нова база; відмовні тести перевіряють і відмову, і що дані не змінились.
const SEED = "a0000000-0000-4000-8000-000000000001";
const ADMIN = "admin@example.test";
const M1 = "manager1@example.test"; // менеджер запуску
const M2 = "manager2@example.test"; // виконавець двох задач
const M3 = "pm-manager@example.test"; // стороння особа

const INSPECT = "Inspect the apartment"; // обов'язкова
const LEASE = "Collect the signed lease"; // обов'язкова
const KEYS = "Hand over the keys"; // обов'язкова
const WELCOME = "Send welcome information"; // необов'язкова
const METERS = "Record meter readings"; // необов'язкова

let t: TestDb;
let u: Record<string, string>;

beforeEach(async () => {
  t = await createTestDb();
  u = t.users;
});
afterEach(async () => {
  await t.close();
});

async function versionTaskIds(): Promise<Record<string, string>> {
  const rows = await t.asService<{ id: string; name: string }>(
    `select vt.id, vt.name from public.template_version_tasks vt
     join public.template_versions v on v.id = vt.version_id
     where v.template_id = $1 and v.version = 1`,
    [SEED],
  );
  return Object.fromEntries(rows.map((r) => [r.name, r.id]));
}

// Менеджер M1 запускає «Tenant move-in»: «Inspect the apartment» і «Hand over the keys» — на M2, решта — на M1.
async function launchRun(name = "Apartment 12"): Promise<string> {
  const ids = await versionTaskIds();
  const assignments = [INSPECT, KEYS].map((task) => ({ template_task_id: ids[task], assignee_id: u[M2] }));
  const [row] = await t.asUser<{ id: string }>(u[M1], "select public.launch_run($1::uuid, $2, $3::jsonb) as id", [
    SEED,
    name,
    JSON.stringify(assignments),
  ]);
  return row.id;
}

async function tasksOf(runId: string): Promise<Record<string, { id: string; status: string }>> {
  const rows = await t.asService<{ id: string; name: string; status: string }>(
    "select id, name, status from public.run_tasks where run_id = $1",
    [runId],
  );
  return Object.fromEntries(rows.map((r) => [r.name, { id: r.id, status: r.status }]));
}
const statusOf = async (runId: string, task: string) => (await tasksOf(runId))[task].status;
async function runStatus(runId: string) {
  const [row] = await t.asService<{ status: string }>("select status from public.runs where id = $1", [runId]);
  return row.status;
}
const markDone = (email: string, taskId: string) =>
  t.asUser(u[email], "select public.mark_task_done($1::uuid)", [taskId]);

describe("позначення задачі виконаною", () => {
  it("AC-TASK-01: виконавець позначає свою задачу — вона «done», решта без змін", async () => {
    const runId = await launchRun();
    const tasks = await tasksOf(runId);

    await markDone(M2, tasks[INSPECT].id);

    expect(await statusOf(runId, INSPECT)).toBe("done");
    expect(await statusOf(runId, LEASE)).toBe("to_do");
    expect(await runStatus(runId)).toBe("in_progress");
  });

  it("AC-TASK-02: менеджер запуску позначає задачу виконавця", async () => {
    const runId = await launchRun();
    const tasks = await tasksOf(runId);

    await markDone(M1, tasks[KEYS].id);

    expect(await statusOf(runId, KEYS)).toBe("done");
    expect(await runStatus(runId)).toBe("in_progress");
  });

  it("AC-TASK-07: адміністратор, який не створював запуск, позначає задачу чужого запуску", async () => {
    const runId = await launchRun();
    const tasks = await tasksOf(runId);

    await markDone(ADMIN, tasks[INSPECT].id);

    expect(await statusOf(runId, INSPECT)).toBe("done");
    expect(await runStatus(runId)).toBe("in_progress");
  });

  it("AC-TASK-03: сторонній менеджер отримує дослівну відмову, задача лишається «to do»", async () => {
    const runId = await launchRun();
    const tasks = await tasksOf(runId);

    await expect(markDone(M3, tasks[INSPECT].id)).rejects.toThrow(
      "Only the task's assignee, the run manager, or an administrator can mark a task as done",
    );

    expect(await statusOf(runId, INSPECT)).toBe("to_do");
    expect(await runStatus(runId)).toBe("in_progress");
  });

  it("AC-TASK-04: виконання третьої обов'язкової задачі завершує запуск, а до того він «in progress»", async () => {
    const runId = await launchRun();
    const tasks = await tasksOf(runId);

    await markDone(M2, tasks[INSPECT].id);
    await markDone(M1, tasks[LEASE].id);
    // 2 обов'язкові «done», решта 3 задачі «to do»
    expect(await runStatus(runId)).toBe("in_progress");
    expect(await statusOf(runId, KEYS)).toBe("to_do");
    expect(await statusOf(runId, WELCOME)).toBe("to_do");
    expect(await statusOf(runId, METERS)).toBe("to_do");

    await markDone(M2, tasks[KEYS].id);

    expect(await statusOf(runId, KEYS)).toBe("done");
    expect(await runStatus(runId)).toBe("completed");
  });
});

describe("видимість запусків і задач", () => {
  it("AC-TASK-10: сторонній менеджер за прямим посиланням не читає ні запуску, ні його задач", async () => {
    const runId = await launchRun();

    const runs = await t.asUser(u[M3], "select id from public.runs where id = $1", [runId]);
    const sections = await t.asUser(u[M3], "select id from public.run_sections where run_id = $1", [runId]);
    const tasks = await t.asUser(u[M3], "select id from public.run_tasks where run_id = $1", [runId]);

    expect(runs).toHaveLength(0);
    expect(sections).toHaveLength(0);
    expect(tasks).toHaveLength(0);
    expect(await tasksOf(runId)).toHaveProperty(INSPECT);
  });

  it("AC-TASK-06: менеджер B бачить свій запуск і перший запуск менеджера A, де він виконавець, але не другий запуск A", async () => {
    const firstOfA = await launchRun("Apartment 12"); // B — виконавець двох задач
    const secondOfA = (
      await t.asUser<{ id: string }>(u[M1], "select public.launch_run($1::uuid, $2, '[]'::jsonb) as id", [SEED, "Apartment 7"])
    )[0].id;
    const ownByB = (
      await t.asUser<{ id: string }>(u[M2], "select public.launch_run($1::uuid, $2, '[]'::jsonb) as id", [SEED, "Apartment 3"])
    )[0].id;

    const visible = (await t.asUser<{ id: string }>(u[M2], "select id from public.runs")).map((r) => r.id);

    expect(visible.sort()).toEqual([firstOfA, ownByB].sort());
    expect(visible).not.toContain(secondOfA);
  });

  it("AC-TASK-17: виконавець бачить чужий запуск і прогрес «2 of 5 done», а запуск без нього — ні", async () => {
    const runId = await launchRun("Apartment 12");
    const otherRun = (
      await t.asUser<{ id: string }>(u[M1], "select public.launch_run($1::uuid, $2, '[]'::jsonb) as id", [SEED, "Apartment 7"])
    )[0].id;
    const tasks = await tasksOf(runId);
    await markDone(M1, tasks[LEASE].id);
    await markDone(M1, tasks[WELCOME].id);

    const visibleRuns = await t.asUser<{ id: string }>(u[M2], "select id from public.runs");
    const visibleTasks = await t.asUser<{ status: string }>(
      u[M2],
      "select status from public.run_tasks where run_id = $1",
      [runId],
    );

    expect(visibleRuns.map((r) => r.id)).toEqual([runId]);
    expect(visibleRuns.map((r) => r.id)).not.toContain(otherRun);
    expect(visibleTasks.filter((task) => task.status === "done")).toHaveLength(2);
    expect(visibleTasks).toHaveLength(5);
  });
});

describe("вибір виконавця", () => {
  it("AC-RUN-10: менеджер бачить лише id й email менеджерів та адміністраторів, без імен і ролей", async () => {
    const rows = await t.asUser<Record<string, unknown>>(u[M1], "select * from public.list_assignable_users()");

    const emails = rows.map((r) => r.email);
    expect(emails).toContain(M2);
    expect(emails).toContain(ADMIN);
    for (const row of rows) expect(Object.keys(row).sort()).toEqual(["email", "id"]);
  });

  it("AC-RUN-10: чужі профілі напряму менеджер не читає — імен і ролей інших користувачів не видно", async () => {
    const others = await t.asUser(u[M1], "select full_name, role from public.profiles where id = $1", [u[M2]]);

    expect(others).toHaveLength(0);
  });
});
