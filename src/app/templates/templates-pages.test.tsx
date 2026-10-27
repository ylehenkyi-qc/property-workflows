import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "../../../tests/helpers/fake-supabase";

const mocks = vi.hoisted(() => ({ client: null as unknown }));

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => mocks.client }));

// Як у Next.js, redirect() і notFound() перериває рендер винятком.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import LoginPage from "@/app/login/page";
import RunPage from "@/app/runs/[id]/page";
import EditTemplatePage from "./[id]/edit/page";
import TemplatePage from "./[id]/page";
import TemplateVersionsPage from "./[id]/versions/page";
import TemplatesPage from "./page";

const TEMPLATE_ID = "d0000000-0000-4000-8000-000000000001";
const RUN_ID = "c0000000-0000-4000-8000-000000000001";
// Next.js 16 типізує PageProps з обома полями: params і searchParams.
const page = (id = TEMPLATE_ID) => ({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) });
const listPage = (search: Record<string, string> = {}) => ({ params: Promise.resolve({}), searchParams: Promise.resolve(search) });

const html = (element: React.ReactElement) => renderToStaticMarkup(element);

// Адреса, на яку сторінка зробила redirect().
async function redirectedTo(render: () => Promise<React.ReactElement>): Promise<string> {
  try {
    await render();
  } catch (e) {
    const message = (e as Error).message;
    if (message.startsWith("REDIRECT ")) return message.slice("REDIRECT ".length);
    throw e;
  }
  throw new Error("redirect не викликано");
}

const asManager = { profiles: { data: { role: "manager" } } };
const asAdmin = { profiles: { data: { role: "admin" } } };

const TEMPLATE = { id: TEMPLATE_ID, name: "Tenant move-in", current_version: 1 };
const SECTIONS = [
  { id: "s1", name: "Before move-in", position: 1 },
  { id: "s2", name: "Move-in day", position: 2 },
];
const TASKS_V1 = [
  { id: "t1", name: "Sign lease", required: true, position: 1, section_id: "s1" },
  { id: "t2", name: "Send welcome pack", required: false, position: 2, section_id: "s1" },
  { id: "t3", name: "Hand over keys", required: true, position: 1, section_id: "s2" },
  { id: "t4", name: "Check meters", required: true, position: 2, section_id: "s2" },
  { id: "t5", name: "Take photos", required: false, position: 3, section_id: "s2" },
];

beforeEach(() => {
  mocks.client = null;
});

describe("AC-EDITOR-09: відвідувач без входу відкриває редактор", () => {
  it("AC-EDITOR-09: редірект на вхід і жодного звернення до даних шаблону", async () => {
    const client = fakeSupabase({ claims: null, tables: { templates: { data: TEMPLATE } } });
    mocks.client = client;

    const url = await redirectedTo(() => EditTemplatePage(page()));

    expect(url).toBe(`/login?next=${encodeURIComponent(`/templates/${TEMPLATE_ID}/edit`)}`);
    expect(client.calls.from).not.toContain("templates");
    expect(client.calls.from).not.toContain("template_sections");
    expect(client.calls.from).not.toContain("template_tasks");
    expect(client.calls.rpc).toEqual([]);
  });

  it("AC-EDITOR-09: сторінки списку версій і шаблону без входу теж ведуть на вхід", async () => {
    mocks.client = fakeSupabase({ claims: null });

    expect(await redirectedTo(() => TemplateVersionsPage(page()))).toContain("/login?next=");
    expect(await redirectedTo(() => TemplatePage(page()))).toContain("/login?next=");
  });
});

describe("AC-DSYS-02: менеджер відкриває редактор за прямим посиланням", () => {
  it("AC-DSYS-02: «Not enough rights» і «Back to templates» у загальному макеті, без вмісту редактора й читання шаблону", async () => {
    const client = fakeSupabase({ tables: { ...asManager, templates: { data: TEMPLATE } } });
    mocks.client = client;

    const markup = html(await EditTemplatePage(page()));

    expect(markup).toContain("Not enough rights");
    expect(markup).toMatch(/<a[^>]*href="\/templates"[^>]*>Back to templates<\/a>/);
    // той самий макет, що й в інших сторінок: <main> з PageShell
    expect(markup).toContain("<main");
    expect(markup).toContain('data-testid="page-message"');
    // без вмісту редактора
    expect(markup).not.toContain("Save version");
    expect(markup).not.toContain("Section name");
    expect(markup).not.toContain("Tenant move-in");
    expect(client.calls.from).toEqual(["profiles"]);
    expect(client.calls.rpc).toEqual([]);
  });
});

describe("AC-DSYS-03: відвідувач без входу відкриває сторінку запуску", () => {
  it("AC-DSYS-03: редірект на вхід без звернення до даних запуску, сторінка входу — у загальному макеті", async () => {
    const client = fakeSupabase({ claims: null, tables: { runs: { data: { id: RUN_ID } } } });
    mocks.client = client;

    const url = await redirectedTo(() =>
      RunPage({ params: Promise.resolve({ id: RUN_ID }), searchParams: Promise.resolve({}) }),
    );

    expect(url).toBe(`/login?next=${encodeURIComponent(`/runs/${RUN_ID}`)}`);
    expect(client.calls.from).toEqual([]);
    expect(client.calls.rpc).toEqual([]);

    // Куди веде редірект: сторінка входу в тому самому <main>-макеті, без даних запуску й зі збереженим next
    const login = html(await LoginPage(listPage({ next: `/runs/${RUN_ID}` })));
    expect(login).toContain("<main");
    expect(login).toContain("Sign in");
    expect(login).toContain(`name="next" value="/runs/${RUN_ID}"`);
    expect(login).not.toContain("run-case-name");
  });

  it("сторінка входу не вірить чужому next", async () => {
    const login = html(await LoginPage(listPage({ next: "https://evil.example" })));

    expect(login).toContain('name="next" value="/"');
  });
});

describe("AC-EDITOR-07: менеджер відкриває список версій за прямим посиланням", () => {
  it("AC-EDITOR-07: «Not enough rights» без жодної версії й без запиту версій", async () => {
    const client = fakeSupabase({
      tables: {
        ...asManager,
        templates: { data: TEMPLATE },
        template_versions: { data: [{ version: 1, created_at: "2026-10-05T06:30:00Z", created_by: "a" }] },
      },
    });
    mocks.client = client;

    const markup = html(await TemplateVersionsPage(page()));

    expect(markup).toContain("Not enough rights");
    expect(markup).not.toContain("version-row");
    expect(markup).not.toContain("Version 1");
    expect(client.calls.from).not.toContain("template_versions");
  });
});

describe("AC-EDITOR-05: адміністратор відкриває список версій", () => {
  it("AC-EDITOR-05: версія 2 першою з «12.10.2026 14:05» і email C, версія 1 другою з «05.10.2026 09:30» і email A", async () => {
    mocks.client = fakeSupabase({
      tables: {
        // роль користувача (maybeSingle) і автори версій (список) — з однієї таблиці profiles
        profiles: {
          single: { role: "admin" },
          data: [
            { id: "admin-a", email: "admin-a@example.test" },
            { id: "admin-c", email: "admin-c@example.test" },
          ],
        },
        templates: { data: TEMPLATE },
        template_versions: {
          data: [
            { version: 2, created_at: "2026-10-12T11:05:00Z", created_by: "admin-c" },
            { version: 1, created_at: "2026-10-05T06:30:00Z", created_by: "admin-a" },
          ],
        },
      },
    });

    const markup = html(await TemplateVersionsPage(page()));
    const rows = markup.split('data-testid="version-row"').slice(1);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("Version 2");
    expect(rows[0]).toContain("12.10.2026 14:05");
    expect(rows[0]).toContain("admin-c@example.test");
    expect(rows[1]).toContain("Version 1");
    expect(rows[1]).toContain("05.10.2026 09:30");
    expect(rows[1]).toContain("admin-a@example.test");
  });
});

describe("AC-EDITOR-01: адміністратор знову відкриває редактор", () => {
  it("AC-EDITOR-01: у редакторі 6 задач і повідомлення «Unpublished changes»", async () => {
    mocks.client = fakeSupabase({
      tables: {
        ...asAdmin,
        templates: { data: TEMPLATE },
        template_sections: { data: SECTIONS },
        template_tasks: {
          data: [...TASKS_V1, { id: "t6", name: "Sign handover act", required: false, position: 4, section_id: "s2" }],
        },
        template_drafts: { data: { has_unpublished_changes: true } },
      },
    });

    const markup = html(await EditTemplatePage(page()));

    expect(markup.match(/id="task-t\d"/g)).toHaveLength(6);
    expect(markup).toContain("Sign handover act");
    expect(markup).toContain("Unpublished changes");
    expect(markup).toContain("Save version");
  });
});

describe("AC-EDITOR-02: менеджер відкриває шаблон", () => {
  it("AC-EDITOR-02: версія 1 з 5 задачами без повідомлення про непубліковані зміни", async () => {
    const client = fakeSupabase({
      tables: {
        ...asManager,
        templates: { data: TEMPLATE },
        template_version_sections: { data: SECTIONS },
        template_version_tasks: { data: TASKS_V1 },
      },
    });
    mocks.client = client;

    const markup = html(await TemplatePage(page()));

    expect(markup).toContain("Version 1");
    expect(markup.match(/data-testid="template-task"/g)).toHaveLength(5);
    expect(markup).not.toContain("Unpublished changes");
    expect(markup).not.toContain("Edit");
    // прапорця чернетки менеджер не читає взагалі
    expect(client.calls.from).not.toContain("template_drafts");
  });

  it("ніколи не збережений шаблон менеджеру — «Template not found» (RLS не віддає рядка)", async () => {
    mocks.client = fakeSupabase({ tables: { ...asManager, templates: { data: null } } });

    await expect(TemplatePage(page())).rejects.toThrow("NOT_FOUND");
  });

  it("адміністратор бачить «Unpublished changes», «Edit» і «Versions»", async () => {
    mocks.client = fakeSupabase({
      tables: {
        ...asAdmin,
        templates: { data: TEMPLATE },
        template_version_sections: { data: SECTIONS },
        template_version_tasks: { data: TASKS_V1 },
        template_drafts: { data: { has_unpublished_changes: true } },
      },
    });

    const markup = html(await TemplatePage(page()));

    expect(markup).toContain("Unpublished changes");
    expect(markup).toMatch(/<a[^>]*href="\/templates\/[^"]+\/edit"[^>]*>Edit<\/a>/);
    expect(markup).toMatch(/<a[^>]*href="\/templates\/[^"]+\/versions"[^>]*>Versions<\/a>/);
  });
});

describe("список шаблонів", () => {
  it("менеджер бачить шаблони без дій редактора й без читання прапорців чернеток", async () => {
    const client = fakeSupabase({ tables: { ...asManager, templates: { data: [TEMPLATE] } } });
    mocks.client = client;

    const markup = html(await TemplatesPage(listPage()));

    expect(markup).toContain("Tenant move-in");
    expect(markup).toContain("Version 1");
    expect(markup).not.toContain("Create template");
    expect(markup).not.toContain("Unpublished changes");
    expect(client.calls.from).not.toContain("template_drafts");
  });

  it("адміністратор бачить «Unpublished changes» біля шаблону й форму створення", async () => {
    mocks.client = fakeSupabase({
      tables: {
        ...asAdmin,
        templates: { data: [TEMPLATE, { id: "d0000000-0000-4000-8000-000000000002", name: "Repair", current_version: null }] },
        template_drafts: { data: [{ template_id: TEMPLATE_ID, has_unpublished_changes: true }] },
      },
    });

    const markup = html(await TemplatesPage(listPage()));

    expect(markup.match(/data-testid="template-row"/g)).toHaveLength(2);
    expect(markup).toContain("Unpublished changes");
    expect(markup).toContain("Not saved yet");
    expect(markup).toContain("Create template");
  });
});

describe("AC-EDITOR-06: запуск зберігає версію шаблону", () => {
  it("AC-EDITOR-06: сторінка запуску показує «Template version 1» і 5 задач версії 1", async () => {
    mocks.client = fakeSupabase({
      tables: {
        ...asManager,
        runs: { data: { id: RUN_ID, case_name: "Case", status: "in_progress", template_version: 1 } },
        run_sections: { data: SECTIONS },
        run_tasks: {
          data: TASKS_V1.map((t) => ({ ...t, status: "to_do", assignee_id: "user-1" })),
        },
      },
      rpc: { list_assignable_users: { data: [{ id: "user-1", email: "manager1@example.test" }] } },
    });

    const markup = html(
      await RunPage({ params: Promise.resolve({ id: RUN_ID }), searchParams: Promise.resolve({}) }),
    );

    expect(markup).toContain("Template version 1");
    expect(markup.match(/data-testid="run-task"/g)).toHaveLength(5);
  });
});
