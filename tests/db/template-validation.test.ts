import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";

// Валідація шаблонів (відповіді PM 2026-10-27, solomchaak/property-workflows-spec#24, #28, #30): правила живуть у
// функціях Postgres, перевіряємо на PGlite без Docker. Кожна відмова перевіряється разом із тим, що дані не змінились.
const SEED = "a0000000-0000-4000-8000-000000000001";
const ADMIN = "admin@example.test";

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
    { name: "Record meter readings", required: false },
    { name: "Send welcome information", required: false },
  ],
};

let t: TestDb;
let u: Record<string, string>;

beforeEach(async () => {
  t = await createTestDb();
  u = t.users;
});
afterEach(async () => {
  await t.close();
});

const saveDraft = (templateId: string, content: Content) =>
  t.asUser(u[ADMIN], "select public.save_template_draft($1::uuid, $2::jsonb)", [templateId, JSON.stringify(content)]);
const publish = (templateId: string) => t.asUser(u[ADMIN], "select public.publish_template($1::uuid)", [templateId]);
const createTemplate = (name: string) => t.asUser(u[ADMIN], "select public.create_template($1)", [name]);

async function state(templateId: string) {
  const [row] = await t.asService<{ current_version: number | null; dirty: boolean | null; versions: number; sections: number; tasks: number }>(
    `select t.current_version, d.has_unpublished_changes as dirty,
            (select count(*)::int from public.template_versions v where v.template_id = t.id) as versions,
            (select count(*)::int from public.template_sections s where s.template_id = t.id) as sections,
            (select count(*)::int from public.template_tasks x where x.template_id = t.id) as tasks
     from public.templates t left join public.template_drafts d on d.template_id = t.id where t.id = $1`,
    [templateId],
  );
  return row;
}
const templateCount = async () => (await t.asService("select id from public.templates")).length;

describe("початкові дані", () => {
  it("«Tenant move-in»: «Before move-in» має 2 задачі, «Move-in day» — 3, версія 1 і робоча копія однакові (як у прикладах PM)", async () => {
    const working = await t.asService<{ name: string; n: number }>(
      `select s.name, (select count(*)::int from public.template_tasks x where x.section_id = s.id) as n
       from public.template_sections s where s.template_id = $1 order by s.position`,
      [SEED],
    );
    const snapshot = await t.asService<{ name: string; n: number }>(
      `select vs.name, (select count(*)::int from public.template_version_tasks vt where vt.section_id = vs.id) as n
       from public.template_version_sections vs where vs.template_id = $1 and vs.version = 1 order by vs.position`,
      [SEED],
    );

    const expected = [
      { name: "Before move-in", n: 2 },
      { name: "Move-in day", n: 3 },
    ];
    expect(working).toEqual(expected);
    expect(snapshot).toEqual(expected);
  });
});

describe("AC-EDITOR-15: секція без задач", () => {
  it("AC-EDITOR-15: збереження відхилено з «Every section needs at least one task», версії немає, зміни й позначка лишаються", async () => {
    await saveDraft(SEED, [BEFORE, MOVE_IN, { name: "After move-in", tasks: [] }]);
    const before = await state(SEED);

    await expect(publish(SEED)).rejects.toThrow("Every section needs at least one task");

    expect(await state(SEED)).toEqual(before);
    expect(before).toEqual({ current_version: 1, dirty: true, versions: 1, sections: 3, tasks: 5 });
  });
});

describe("AC-EDITOR-20: секція чи задача без назви", () => {
  it("AC-EDITOR-20: задача з очищеною назвою (лише пробіли) — «Every section and task needs a name», версії немає", async () => {
    await saveDraft(SEED, [BEFORE, { ...MOVE_IN, tasks: [{ name: "   ", required: true }, ...MOVE_IN.tasks.slice(1)] }]);
    const before = await state(SEED);

    await expect(publish(SEED)).rejects.toThrow("Every section and task needs a name");

    expect(await state(SEED)).toEqual(before);
    expect(before).toMatchObject({ current_version: 1, dirty: true, versions: 1 });
  });

  it("AC-EDITOR-20: порожня назва секції теж відхиляється", async () => {
    await saveDraft(SEED, [{ ...BEFORE, name: "" }, MOVE_IN]);
    const before = await state(SEED);

    await expect(publish(SEED)).rejects.toThrow("Every section and task needs a name");

    expect(await state(SEED)).toEqual(before);
  });
});

describe("AC-EDITOR-19: шаблон без назви", () => {
  it("AC-EDITOR-19: порожня назва чи лише пробіли — «Enter a template name», шаблон не створено", async () => {
    for (const name of ["", "   "]) {
      await expect(createTemplate(name)).rejects.toThrow("Enter a template name");
    }

    expect(await templateCount()).toBe(1);
  });
});

describe("AC-EDITOR-23: унікальність назви при створенні", () => {
  it("AC-EDITOR-23: « tenant MOVE-IN » (регістр і пробіли) — «A template with this name already exists», шаблон не створено", async () => {
    await expect(createTemplate(" tenant MOVE-IN ")).rejects.toThrow("A template with this name already exists");

    expect(await templateCount()).toBe(1);
  });

  it("унікальний індекс не дає обійти перевірку прямою вставкою (навіть від service_role)", async () => {
    await expect(t.asService("insert into public.templates (name) values (' TENANT move-in')")).rejects.toThrow(/unique|duplicate/);

    expect(await templateCount()).toBe(1);
  });

  it("інша назва створюється нормально й навіть із пробілами по краях зберігається обрізаною", async () => {
    const [{ create_template }] = await createTemplate("  Repair  ");

    const [row] = await t.asService<{ name: string }>("select name from public.templates where id = $1", [create_template]);
    expect(row.name).toBe("Repair");
    expect(await templateCount()).toBe(2);
  });
});
