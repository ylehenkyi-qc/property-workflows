import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";

// Правила версій шаблонів і запуску живуть у Postgres (RLS, функції в private): перевіряємо їх на PGlite без Docker.
// Кожен тест — нова база з усіма міграціями; відмовні тести перевіряють і відмову, і те, що дані не змінились.
const SEED = "a0000000-0000-4000-8000-000000000001";
const ADMIN = "admin@example.test";
const PM_ADMIN = "pm-admin@example.test";
const M1 = "manager1@example.test";
const M2 = "manager2@example.test";

type Content = { name: string; tasks: { name: string; required?: boolean }[] }[];

const SEEDED: Content = [
  {
    name: "Before move-in",
    tasks: [
      { name: "Inspect the apartment", required: true },
      { name: "Collect the signed lease", required: true },
      { name: "Send welcome information", required: false },
    ],
  },
  {
    name: "Move-in day",
    tasks: [
      { name: "Hand over the keys", required: true },
      { name: "Record meter readings", required: false },
    ],
  },
];

const SIXTH: Content = [
  { ...SEEDED[0] },
  { name: "Move-in day", tasks: [...SEEDED[1].tasks, { name: "Sign handover act", required: false }] },
];

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
const publish = (email: string, templateId: string) =>
  t.asUser<{ publish_template: number }>(u[email], "select public.publish_template($1::uuid) as publish_template", [
    templateId,
  ]);
const createTemplate = async (email: string, name: string) =>
  (await t.asUser<{ id: string }>(u[email], "select public.create_template($1) as id", [name]))[0].id;
const launch = async (email: string, templateId: string, name: string, assignments: unknown[] = []) =>
  (
    await t.asUser<{ id: string }>(u[email], "select public.launch_run($1::uuid, $2, $3::jsonb) as id", [
      templateId,
      name,
      JSON.stringify(assignments),
    ])
  )[0].id;

async function versionTaskNames(templateId: string, version: number) {
  const rows = await t.asService<{ name: string }>(
    `select vt.name from public.template_version_tasks vt
     join public.template_versions v on v.id = vt.version_id
     where v.template_id = $1 and v.version = $2 order by vt.section_id, vt.position`,
    [templateId, version],
  );
  return rows.map((r) => r.name);
}
async function workingTaskCount(templateId: string) {
  const [row] = await t.asService<{ n: number }>(
    "select count(*)::int as n from public.template_tasks where template_id = $1",
    [templateId],
  );
  return row.n;
}
async function templateState(templateId: string) {
  const [row] = await t.asService<{ current_version: number | null; dirty: boolean | null; versions: number }>(
    `select t.current_version, d.has_unpublished_changes as dirty,
            (select count(*)::int from public.template_versions v where v.template_id = t.id) as versions
     from public.templates t left join public.template_drafts d on d.template_id = t.id where t.id = $1`,
    [templateId],
  );
  return row;
}
async function runTasks(runId: string) {
  return t.asService<{ name: string; status: string; assignee_id: string; required: boolean }>(
    `select rt.name, rt.status, rt.assignee_id, rt.required from public.run_tasks rt
     join public.run_sections rs on rs.id = rt.section_id where rt.run_id = $1 order by rs.position, rt.position`,
    [runId],
  );
}
async function versionTaskIds(templateId: string, version: number) {
  const rows = await t.asService<{ id: string; name: string }>(
    `select vt.id, vt.name from public.template_version_tasks vt
     join public.template_versions v on v.id = vt.version_id
     where v.template_id = $1 and v.version = $2 order by vt.section_id, vt.position`,
    [templateId, version],
  );
  return Object.fromEntries(rows.map((r) => [r.name, r.id]));
}

describe("міграції й бекфіл", () => {
  it("усі міграції застосовуються до порожньої бази: «Tenant move-in» має версію 1 з 5 задачами", async () => {
    expect(await templateState(SEED)).toEqual({ current_version: 1, dirty: false, versions: 1 });
    expect(await versionTaskNames(SEED, 1)).toHaveLength(5);
  });
});

describe("редактор: версії шаблонів", () => {
  it("AC-EDITOR-01: зміни без збереження версії не втрачаються — робоча копія має 6 задач, версія лишається 1", async () => {
    await saveDraft(ADMIN, SEED, SIXTH);

    expect(await workingTaskCount(SEED)).toBe(6);
    expect(await templateState(SEED)).toEqual({ current_version: 1, dirty: true, versions: 1 });
    expect(await versionTaskNames(SEED, 1)).toHaveLength(5);
  });

  it("AC-EDITOR-02: менеджер бачить версію 1 з 5 задачами й не бачить робочу копію, чернетку та версії", async () => {
    await saveDraft(ADMIN, SEED, SIXTH);

    const sections = await t.asUser<{ id: string }>(u[M1], "select id from public.template_version_sections where template_id = $1", [SEED]);
    const tasks = await t.asUser(u[M1], "select id from public.template_version_tasks");
    const working = await t.asUser(u[M1], "select id from public.template_tasks");
    const drafts = await t.asUser(u[M1], "select template_id from public.template_drafts");
    const versions = await t.asUser(u[M1], "select id from public.template_versions");
    const [tpl] = await t.asUser<{ current_version: number }>(u[M1], "select current_version from public.templates where id = $1", [SEED]);

    expect(sections).toHaveLength(2);
    expect(tasks).toHaveLength(5);
    expect(working).toHaveLength(0);
    expect(drafts).toHaveLength(0);
    expect(versions).toHaveLength(0);
    expect(tpl.current_version).toBe(1);
  });

  it("AC-EDITOR-03: збереження створює версію 2 з 6 задачами, вона стає поточною, непубліковані зміни зникають", async () => {
    await saveDraft(ADMIN, SEED, SIXTH);

    const [{ publish_template }] = await publish(ADMIN, SEED);

    expect(publish_template).toBe(2);
    expect(await templateState(SEED)).toEqual({ current_version: 2, dirty: false, versions: 2 });
    expect(await versionTaskNames(SEED, 2)).toHaveLength(6);
    expect(await t.asUser(u[M1], "select id from public.template_version_tasks")).toHaveLength(6);
  });

  it("AC-EDITOR-04: шаблон без обов'язкової задачі не зберігається — повідомлення, версії немає, зміни й позначка лишаються", async () => {
    const repair = await createTemplate(ADMIN, "Repair");
    await saveDraft(ADMIN, repair, [
      { name: "Work", tasks: [{ name: "A" }, { name: "B" }, { name: "C" }] },
    ]);

    await expect(publish(ADMIN, repair)).rejects.toThrow("A template needs at least one required task");

    expect(await templateState(repair)).toEqual({ current_version: null, dirty: true, versions: 0 });
    expect(await workingTaskCount(repair)).toBe(3);
  });

  it("AC-EDITOR-05: список версій — номер, автор; новіші першими", async () => {
    await saveDraft(ADMIN, SEED, SIXTH);
    await publish(ADMIN, SEED);
    await saveDraft(PM_ADMIN, SEED, SEEDED);
    await publish(PM_ADMIN, SEED);

    const rows = await t.asUser<{ version: number; email: string | null }>(
      u[ADMIN],
      `select v.version, p.email from public.template_versions v
       left join public.profiles p on p.id = v.created_by where v.template_id = $1 order by v.version desc`,
      [SEED],
    );

    expect(rows).toEqual([
      { version: 3, email: PM_ADMIN },
      { version: 2, email: ADMIN },
      { version: 1, email: null },
    ]);
  });

  it("AC-EDITOR-06: запуск зберігає версію, з якої створений; нові запуски йдуть із поточної версії", async () => {
    const first = await launch(M1, SEED, "Apartment 12, move-in");
    await saveDraft(ADMIN, SEED, SIXTH);
    await publish(ADMIN, SEED);

    const [run] = await t.asService<{ template_version: number }>("select template_version from public.runs where id = $1", [first]);
    const second = await launch(M1, SEED, "Apartment 14, move-in");
    const [run2] = await t.asService<{ template_version: number }>("select template_version from public.runs where id = $1", [second]);

    expect(run.template_version).toBe(1);
    expect(await runTasks(first)).toHaveLength(5);
    expect(run2.template_version).toBe(2);
    expect(await runTasks(second)).toHaveLength(6);
  });

  it("AC-EDITOR-07: менеджер не бачить список версій, а гість не читає нічого", async () => {
    expect(await t.asUser(u[M1], "select id from public.template_versions")).toHaveLength(0);
    expect(await t.asUser(u[ADMIN], "select id from public.template_versions")).toHaveLength(1);
    await expect(t.asAnon("select id from public.template_versions")).rejects.toThrow("permission denied");
  });

  it("AC-EDITOR-08: менеджер не змінює шаблон і не зберігає версію напряму — шаблон лишається версією 1 з 5 задачами без змін", async () => {
    const attempts: (() => Promise<unknown>)[] = [
      () => t.asUser(u[M1], "update public.templates set name = 'Hacked' where id = $1", [SEED]),
      () => t.asUser(u[M1], "insert into public.template_sections (template_id, name, position) values ($1, 'X', 9)", [SEED]),
      () => t.asUser(u[M1], "insert into public.template_versions (template_id, version) values ($1, 2)", [SEED]),
      () => t.asUser(u[M1], "select public.save_template_draft($1::uuid, '[]'::jsonb)", [SEED]),
      () => t.asUser(u[M1], "select public.publish_template($1::uuid)", [SEED]),
      () => t.asUser(u[M1], "select public.create_template('Mine')"),
    ];
    for (const attempt of attempts) {
      await expect(attempt()).rejects.toThrow(/permission denied|FORBIDDEN/);
    }

    expect(await templateState(SEED)).toEqual({ current_version: 1, dirty: false, versions: 1 });
    expect(await workingTaskCount(SEED)).toBe(5);
    expect(await versionTaskNames(SEED, 1)).toHaveLength(5);
    expect((await t.asService("select id from public.templates"))).toHaveLength(1);
  });

  it("гість без входу не читає й не змінює шаблони ні таблицями, ні функціями", async () => {
    await expect(t.asAnon("select id from public.templates")).rejects.toThrow("permission denied");
    await expect(t.asAnon("update public.templates set name = 'Hacked'")).rejects.toThrow("permission denied");
    await expect(t.asAnon("select public.save_template_draft($1::uuid, '[]'::jsonb)", [SEED])).rejects.toThrow("permission denied");
    await expect(t.asAnon("select public.publish_template($1::uuid)", [SEED])).rejects.toThrow("permission denied");

    expect(await templateState(SEED)).toEqual({ current_version: 1, dirty: false, versions: 1 });
    expect(await workingTaskCount(SEED)).toBe(5);
  });

  it("менеджер бачить лише шаблони зі збереженою версією, адміністратор — усі", async () => {
    await createTemplate(ADMIN, "Repair");

    const manager = await t.asUser<{ name: string }>(u[M1], "select name from public.templates order by name");
    const admin = await t.asUser<{ name: string }>(u[ADMIN], "select name from public.templates order by name");

    expect(manager.map((r) => r.name)).toEqual(["Tenant move-in"]);
    expect(admin.map((r) => r.name)).toEqual(["Repair", "Tenant move-in"]);
  });

  it("збереження без непублікованих змін не створює версію й повертає поточну", async () => {
    const [{ publish_template }] = await publish(ADMIN, SEED);

    expect(publish_template).toBe(1);
    expect(await templateState(SEED)).toEqual({ current_version: 1, dirty: false, versions: 1 });
  });

  it("section_id задач знімка — нові секції версії; задача версії 2 із секцією версії 1 відхиляється ключем", async () => {
    await saveDraft(ADMIN, SEED, SIXTH);
    await publish(ADMIN, SEED);

    const mixed = await t.asService<{ n: number }>(
      `select count(*)::int as n from public.template_version_tasks vt
       join public.template_version_sections vs on vs.id = vt.section_id
       where vs.version_id <> vt.version_id`,
    );
    expect(mixed[0].n).toBe(0);

    const [{ v1 }] = await t.asService<{ v1: string }>(
      "select vs.id as v1 from public.template_version_sections vs join public.template_versions v on v.id = vs.version_id where v.version = 1 limit 1",
    );
    const [{ v2 }] = await t.asService<{ v2: string }>(
      "select id as v2 from public.template_versions where version = 2 limit 1",
    );
    await expect(
      t.asService(
        "insert into public.template_version_tasks (version_id, section_id, name, required, position) values ($1, $2, 'X', false, 99)",
        [v2, v1],
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it("шаблон без збереженої версії не запускається: ні менеджером, ні адміністратором, запуск не створюється", async () => {
    const repair = await createTemplate(ADMIN, "Repair");

    await expect(launch(M1, repair, "Case")).rejects.toThrow("Template has no saved version");
    await expect(launch(ADMIN, repair, "Case")).rejects.toThrow("Template has no saved version");

    expect(await t.asService("select id from public.runs")).toHaveLength(0);
  });
});

describe("запуск шаблону (launch_run)", () => {
  it("AC-RUN-01: запуск шаблону створює один запуск «in progress» з усіма 5 задачами «to_do»", async () => {
    const run = await launch(M1, SEED, "Apartment 12, move-in");

    const runs = await t.asService<{ status: string }>("select status from public.runs");
    const tasks = await runTasks(run);

    expect(runs).toEqual([{ status: "in_progress" }]);
    expect(tasks).toHaveLength(5);
    expect(tasks.every((x) => x.status === "to_do")).toBe(true);
  });

  it("AC-RUN-02: зміна шаблону (шоста задача, перейменована перша) не змінює створений запуск", async () => {
    const run = await launch(M1, SEED, "Apartment 12, move-in");
    const renamed: Content = [
      { name: "Before move-in", tasks: [{ name: "RENAMED", required: true }, ...SEEDED[0].tasks.slice(1)] },
      SIXTH[1],
    ];
    await saveDraft(ADMIN, SEED, renamed);
    await publish(ADMIN, SEED);

    const tasks = await runTasks(run);

    expect(tasks.map((x) => x.name)).toEqual(SEEDED.flatMap((s) => s.tasks.map((x) => x.name)));
  });

  it("AC-RUN-04: менеджер A призначає менеджера B виконавцем двох задач, решта лишається в A", async () => {
    const ids = await versionTaskIds(SEED, 1);

    const run = await launch(M1, SEED, "Apartment 12, move-in", [
      { template_task_id: ids["Inspect the apartment"], assignee_id: u[M2] },
      { template_task_id: ids["Hand over the keys"], assignee_id: u[M2] },
    ]);

    const tasks = await runTasks(run);
    expect(tasks.filter((x) => x.assignee_id === u[M2])).toHaveLength(2);
    expect(tasks.filter((x) => x.assignee_id === u[M1])).toHaveLength(3);
  });

  it("AC-RUN-05: адміністратор запускає шаблон і стає менеджером запуску", async () => {
    const run = await launch(ADMIN, SEED, "Apartment 14, move-in");

    const [row] = await t.asService<{ manager_id: string }>("select manager_id from public.runs where id = $1", [run]);
    expect(row.manager_id).toBe(u[ADMIN]);
  });

  it("AC-RUN-06: менеджер, що запустив шаблон, стає менеджером запуску", async () => {
    const run = await launch(M1, SEED, "Apartment 12, move-in");

    const [row] = await t.asService<{ manager_id: string }>("select manager_id from public.runs where id = $1", [run]);
    expect(row.manager_id).toBe(u[M1]);
  });

  it("AC-RUN-08: без призначення виконавців менеджер — виконавець усіх 5 задач", async () => {
    const run = await launch(M1, SEED, "Apartment 12, move-in");

    const tasks = await runTasks(run);
    expect(tasks).toHaveLength(5);
    expect(tasks.every((x) => x.assignee_id === u[M1])).toBe(true);
  });

  it("AC-RUN-09: без призначення виконавців адміністратор — виконавець усіх 5 задач", async () => {
    const run = await launch(ADMIN, SEED, "Apartment 14, move-in");

    const tasks = await runTasks(run);
    expect(tasks).toHaveLength(5);
    expect(tasks.every((x) => x.assignee_id === u[ADMIN])).toBe(true);
  });

  it("AC-RUN-11: назва зі 100 символів і пробілом на початку зберігається обрізаною, запуск один", async () => {
    const name = "a".repeat(100);

    await launch(M1, SEED, ` ${name}`);

    const runs = await t.asService<{ case_name: string }>("select case_name from public.runs");
    expect(runs).toEqual([{ case_name: name }]);
  });

  it("AC-RUN-12: перейменування секції й перенесення задачі в шаблоні не змінюють секції створеного запуску", async () => {
    const run = await launch(M1, SEED, "Apartment 12, move-in");
    const changed: Content = [
      { name: "Before move-in", tasks: [...SEEDED[0].tasks, SEEDED[1].tasks[0]] },
      { name: "Key handover", tasks: [SEEDED[1].tasks[1]] },
    ];
    await saveDraft(ADMIN, SEED, changed);
    await publish(ADMIN, SEED);

    const sections = await t.asService<{ name: string; n: number }>(
      `select rs.name, count(rt.id)::int as n from public.run_sections rs
       left join public.run_tasks rt on rt.section_id = rs.id where rs.run_id = $1
       group by rs.id, rs.name, rs.position order by rs.position`,
      [run],
    );

    expect(sections).toEqual([
      { name: "Before move-in", n: 3 },
      { name: "Move-in day", n: 2 },
    ]);
  });
});
