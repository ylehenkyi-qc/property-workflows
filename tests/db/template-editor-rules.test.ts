import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";

// Правила редактора шаблонів, додані відповідями PM 2026-10-27 (solomchaak/property-workflows-spec#21–#38), що вже живуть
// у Postgres: перевіряємо на PGlite без Docker. Відмовні тести перевіряють і відмову, і те, що дані не змінились.
const SEED = "a0000000-0000-4000-8000-000000000001";
const ADMIN = "admin@example.test";
const M1 = "manager1@example.test";

type Content = { name: string; tasks: { name: string; required?: boolean }[] }[];

const BEFORE = {
  name: "Before move-in",
  tasks: [
    { name: "Inspect the apartment", required: true },
    { name: "Collect the signed lease", required: true },
  ],
};
const MOVE_IN = {
  name: "Move-in day",
  tasks: [
    { name: "Hand over the keys", required: true },
    { name: "Send welcome information", required: false },
    { name: "Record meter readings", required: false },
  ],
};
const SEEDED: Content = [BEFORE, MOVE_IN];

let t: TestDb;
let u: Record<string, string>;

beforeEach(async () => {
  t = await createTestDb();
  u = t.users;
});
afterEach(async () => {
  await t.close();
});

const saveDraft = (email: string, templateId: string, content: Content) =>
  t.asUser(u[email], "select public.save_template_draft($1::uuid, $2::jsonb)", [templateId, JSON.stringify(content)]);
const publish = async (email: string, templateId: string) =>
  (
    await t.asUser<{ v: number }>(u[email], "select public.publish_template($1::uuid) as v", [templateId])
  )[0].v;
const createTemplate = async (email: string, name: string) =>
  (await t.asUser<{ id: string }>(u[email], "select public.create_template($1) as id", [name]))[0].id;

async function state(templateId: string) {
  const [row] = await t.asService<{ current_version: number | null; dirty: boolean | null; versions: number; working: number }>(
    `select t.current_version, d.has_unpublished_changes as dirty,
            (select count(*)::int from public.template_versions v where v.template_id = t.id) as versions,
            (select count(*)::int from public.template_tasks x where x.template_id = t.id) as working
     from public.templates t left join public.template_drafts d on d.template_id = t.id where t.id = $1`,
    [templateId],
  );
  return row;
}
// Секції версії з кількістю задач: [{ name, n }] у порядку позицій.
async function versionShape(templateId: string, version: number) {
  return t.asService<{ name: string; n: number }>(
    `select vs.name, (select count(*)::int from public.template_version_tasks vt where vt.section_id = vs.id) as n
     from public.template_version_sections vs
     where vs.template_id = $1 and vs.version = $2 order by vs.position`,
    [templateId, version],
  );
}

const totals = (shape: { n: number }[]) => ({ sections: shape.length, tasks: shape.reduce((sum, x) => sum + x.n, 0) });

describe("AC-EDITOR-11: запуск шаблону без збереженої версії напряму", () => {
  it("AC-EDITOR-11: адміністратор не запускає новий шаблон напряму — запуску немає, список запусків не змінився", async () => {
    const repair = await createTemplate(ADMIN, "Repair");
    const before = await t.asService("select id from public.runs");

    await expect(
      t.asUser(u[ADMIN], "select public.launch_run($1::uuid, 'Case', '[]'::jsonb)", [repair]),
    ).rejects.toThrow("Template has no saved version");

    expect(await t.asService("select id from public.runs")).toEqual(before);
  });
});

describe("AC-EDITOR-12: збереження без непублікованих змін", () => {
  it("AC-EDITOR-12: повторне збереження версії 2 без змін не створює версію 3, версія 2 лишається поточною", async () => {
    await saveDraft(ADMIN, SEED, [BEFORE, { ...MOVE_IN, tasks: [...MOVE_IN.tasks, { name: "Sign handover act" }] }]);
    expect(await publish(ADMIN, SEED)).toBe(2);

    expect(await publish(ADMIN, SEED)).toBe(2);

    expect(await state(SEED)).toMatchObject({ current_version: 2, dirty: false, versions: 2 });
  });
});

describe("AC-EDITOR-14: підтверджене видалення секції", () => {
  it("AC-EDITOR-14: секція зникає з непублікованих змін, а версія 1 лишається з 2 секціями й 5 задачами", async () => {
    await saveDraft(ADMIN, SEED, [BEFORE]);

    expect(await state(SEED)).toMatchObject({ current_version: 1, dirty: true, versions: 1, working: 2 });
    expect(totals(await versionShape(SEED, 1))).toEqual({ sections: 2, tasks: 5 });
  });
});

describe("AC-EDITOR-26: гість напряму змінює шаблон", () => {
  it("AC-EDITOR-26: запити гостя відхилено, шаблон лишається версією 1 з 5 задачами без непублікованих змін", async () => {
    const attempts = [
      () => t.asAnon("update public.templates set name = 'Hacked' where id = $1", [SEED]),
      () => t.asAnon("select public.save_template_draft($1::uuid, '[]'::jsonb)", [SEED]),
      () => t.asAnon("select public.publish_template($1::uuid)", [SEED]),
      () => t.asAnon("select public.create_template('Mine')"),
    ];
    for (const attempt of attempts) await expect(attempt()).rejects.toThrow("permission denied");

    expect(await state(SEED)).toEqual({ current_version: 1, dirty: false, versions: 1, working: 5 });
    expect(totals(await versionShape(SEED, 1))).toEqual({ sections: 2, tasks: 5 });
  });
});

describe("AC-EDITOR-28: перенесення задачі між секціями", () => {
  it("AC-EDITOR-28: після перенесення задачі нова версія має «Before move-in» із 3 задачами й «Move-in day» із 2", async () => {
    // Вихідна версія за прикладом PM: «Before move-in» — 2 задачі, «Move-in day» — 3
    await saveDraft(ADMIN, SEED, SEEDED);
    expect(await publish(ADMIN, SEED)).toBe(2);
    const moved: Content = [
      { ...BEFORE, tasks: [...BEFORE.tasks, MOVE_IN.tasks[2]] },
      { ...MOVE_IN, tasks: MOVE_IN.tasks.slice(0, 2) },
    ];
    await saveDraft(ADMIN, SEED, moved);

    expect(await publish(ADMIN, SEED)).toBe(3);

    expect(await versionShape(SEED, 3)).toEqual([
      { name: "Before move-in", n: 3 },
      { name: "Move-in day", n: 2 },
    ]);
    // попередня версія не змінилась
    expect(await versionShape(SEED, 2)).toEqual([
      { name: "Before move-in", n: 2 },
      { name: "Move-in day", n: 3 },
    ]);
  });
});

describe("AC-EDITOR-29: менеджер напряму запитує старі версії, список версій і непубліковані зміни", () => {
  it("AC-EDITOR-29: запити відхилено, менеджер бачить лише поточну версію 2, а шаблон лишається як був", async () => {
    // версія 2 поточна, у робочій копії 7 задач (непубліковані зміни)
    await saveDraft(ADMIN, SEED, [BEFORE, { ...MOVE_IN, tasks: [...MOVE_IN.tasks, { name: "Sign handover act" }] }]);
    await publish(ADMIN, SEED);
    await saveDraft(ADMIN, SEED, [
      { ...BEFORE, tasks: [...BEFORE.tasks, { name: "Extra task" }] },
      { ...MOVE_IN, tasks: [...MOVE_IN.tasks, { name: "Sign handover act" }] },
    ]);
    const before = await state(SEED);
    expect(before).toMatchObject({ current_version: 2, dirty: true, working: 7 });

    // версія 1, список версій, робоча копія й прапорець чернетки недоступні
    expect(await t.asUser(u[M1], "select id from public.template_version_sections where template_id = $1 and version = 1", [SEED])).toHaveLength(0);
    expect(await t.asUser(u[M1], "select id from public.template_versions")).toHaveLength(0);
    expect(await t.asUser(u[M1], "select id from public.template_tasks")).toHaveLength(0);
    expect(await t.asUser(u[M1], "select template_id from public.template_drafts")).toHaveLength(0);
    // поточну версію 2 менеджер бачить
    expect(await t.asUser(u[M1], "select id from public.template_version_sections where template_id = $1 and version = 2", [SEED])).toHaveLength(2);
    // пряма спроба змінити
    await expect(t.asUser(u[M1], "select public.save_template_draft($1::uuid, '[]'::jsonb)", [SEED])).rejects.toThrow(/FORBIDDEN|permission denied/);
    await expect(t.asUser(u[M1], "select public.publish_template($1::uuid)", [SEED])).rejects.toThrow(/FORBIDDEN|permission denied/);

    expect(await state(SEED)).toEqual(before);
  });
});
