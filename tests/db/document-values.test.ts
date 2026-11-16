import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";

// Збереження підтверджених значень AI-розбору документа (AC-DOCAI-08) живе в Postgres: таблиця run_document_values під RLS.
// Перевіряємо на PGlite без Docker. Кожен тест — нова база; відмовний тест перевіряє і відмову, і що дані не змінились.
const SEED = "a0000000-0000-4000-8000-000000000001"; // «Tenant move-in», версія 1, 5 задач
const ADMIN = "admin@example.test";
const A = "manager1@example.test"; // менеджер запуску
const B = "manager2@example.test"; // інший менеджер, виконавець однієї задачі
const V1 = "vendor1@example.test"; // вендор, виконавець однієї задачі

let t: TestDb;
let u: Record<string, string>;
let runId: string;

beforeEach(async () => {
  t = await createTestDb();
  u = t.users;
  const tasks = await t.asService<{ id: string }>(
    `select vt.id from public.template_version_tasks vt
     join public.template_version_sections vs on vs.id = vt.section_id
     join public.template_versions v on v.id = vt.version_id
     where v.template_id = $1 and v.version = 1
     order by vs.position, vt.position`,
    [SEED],
  );
  const assignments = [
    { template_task_id: tasks[0].id, assignee_id: u[B] },
    { template_task_id: tasks[1].id, assignee_id: u[V1] },
  ];
  const [row] = await t.asUser<{ id: string }>(u[A], "select public.launch_run($1::uuid, $2, $3::jsonb) as id", [
    SEED,
    "Apartment 12, repair",
    JSON.stringify(assignments),
  ]);
  runId = row.id;
});
afterEach(async () => {
  await t.close();
});

const saved = () =>
  t.asService<{ author_id: string; kind: string; values: Record<string, unknown> }>(
    "select author_id, kind, values from public.run_document_values where run_id = $1",
    [runId],
  );

// Без returning: інакше відмову дала б і політика select, а перевірку політики insert не було б видно окремо.
const insertValues = (userId: string, values: unknown, kind = "request", authorId?: string) =>
  t.asUser(
    userId,
    "insert into public.run_document_values (run_id, kind, values, author_id) values ($1, $2, $3::jsonb, coalesce($4::uuid, auth.uid()))",
    [runId, kind, JSON.stringify(values), authorId ?? null],
  );

const confirmed = { phone: "555-0101", description: "Kitchen tap in apartment 12 has been dripping", category: "plumbing", urgency: "urgent" };

describe("збереження підтверджених значень", () => {
  it("AC-DOCAI-08: до підтвердження нічого не збережено, після підтвердження менеджер запуску зберігає виправлене значення «urgent»", async () => {
    expect(await saved()).toHaveLength(0);

    await insertValues(u[A], confirmed);

    expect(await saved()).toEqual([{ author_id: u[A], kind: "request", values: confirmed }]);
  });

  it("AC-DOCAI-08: підтверджені значення кошторису зберігаються як є", async () => {
    const estimate = { items: [{ name: "Labour", quantity: 2, unitPrice: 60 }], total: 120 };
    await insertValues(u[A], estimate, "estimate");
    expect(await saved()).toEqual([{ author_id: u[A], kind: "estimate", values: estimate }]);
  });

  it("AC-DOCAI-08: адміністратор зберігає й читає значення будь-якого запуску", async () => {
    await insertValues(u[ADMIN], confirmed);
    const rows = await t.asUser(u[ADMIN], "select author_id from public.run_document_values where run_id = $1", [runId]);
    expect(rows).toEqual([{ author_id: u[ADMIN] }]);
  });

  it("AC-DOCAI-08: менеджер запуску читає записане, а інший менеджер, вендор і відвідувач — нічого", async () => {
    await insertValues(u[A], confirmed);
    const read = (userId: string) =>
      t.asUser(userId, "select id from public.run_document_values where run_id = $1", [runId]);
    expect(await read(u[A])).toHaveLength(1);
    expect(await read(u[B])).toHaveLength(0);
    expect(await read(u[V1])).toHaveLength(0);
    await expect(t.asAnon("select id from public.run_document_values")).rejects.toThrow(/permission denied/);
  });
});

describe("хто не може зберегти значення", () => {
  it("менеджер, що лише виконавець задачі запуску, не зберігає: відмова й записів немає", async () => {
    await expect(insertValues(u[B], confirmed)).rejects.toThrow(/row-level security/);
    expect(await saved()).toHaveLength(0);
  });

  it("вендор з власною задачею в запуску не зберігає: відмова й записів немає", async () => {
    await expect(insertValues(u[V1], confirmed)).rejects.toThrow(/row-level security/);
    expect(await saved()).toHaveLength(0);
  });

  it("відвідувач без входу не зберігає: відмова й записів немає", async () => {
    await expect(
      t.asAnon("insert into public.run_document_values (run_id, kind, values) values ($1, 'request', '{}'::jsonb)", [runId]),
    ).rejects.toThrow(/permission denied/);
    expect(await saved()).toHaveLength(0);
  });

  it("не можна записати від імені іншого автора", async () => {
    await expect(insertValues(u[A], confirmed, "request", u[B])).rejects.toThrow(/row-level security/);
    expect(await saved()).toHaveLength(0);
  });

  it("вендор, якого службовим запитом записано менеджером запуску, усе одно не керує ним і не зберігає", async () => {
    await t.asService("update public.runs set manager_id = $2 where id = $1", [runId, u[V1]]);
    expect(
      (await t.asUser<{ ok: boolean }>(u[V1], "select public.can_manage_run($1::uuid) as ok", [runId]))[0].ok,
    ).toBe(false);
    await expect(insertValues(u[V1], confirmed)).rejects.toThrow(/row-level security/);
    expect(await saved()).toHaveLength(0);
  });

  it("підтверджений запис не змінюється й не видаляється навіть менеджером запуску", async () => {
    await insertValues(u[A], confirmed);
    await expect(
      t.asUser(u[A], "update public.run_document_values set values = '{}'::jsonb where run_id = $1", [runId]),
    ).rejects.toThrow(/permission denied/);
    await expect(t.asUser(u[A], "delete from public.run_document_values where run_id = $1", [runId])).rejects.toThrow(
      /permission denied/,
    );
    expect(await saved()).toEqual([{ author_id: u[A], kind: "request", values: confirmed }]);
  });
});

describe("форма запису", () => {
  it.each([
    ["JSON null", null],
    ["масив", [1, 2]],
    ["рядок", "555-0101"],
  ])("values — не об'єкт (%s): відмова, записів немає", async (_name, value) => {
    await expect(insertValues(u[A], value)).rejects.toThrow(/run_document_values_values_check/);
    expect(await saved()).toHaveLength(0);
  });

  it("невідомий вид документа відхиляється", async () => {
    await expect(insertValues(u[A], confirmed, "menu")).rejects.toThrow(/run_document_values_kind_check/);
    expect(await saved()).toHaveLength(0);
  });
});

describe("public.can_manage_run", () => {
  const can = async (userId: string) =>
    (await t.asUser<{ ok: boolean }>(userId, "select public.can_manage_run($1::uuid) as ok", [runId]))[0].ok;

  it("true для менеджера запуску й адміністратора; false для іншого менеджера-виконавця й вендора", async () => {
    expect(await can(u[A])).toBe(true);
    expect(await can(u[ADMIN])).toBe(true);
    expect(await can(u[B])).toBe(false);
    expect(await can(u[V1])).toBe(false);
  });

  it("недоступна відвідувачу без входу", async () => {
    await expect(t.asAnon("select public.can_manage_run($1::uuid)", [runId])).rejects.toThrow(/permission denied/);
  });
});
