import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "../../../tests/helpers/fake-supabase";

const mocks = vi.hoisted(() => ({ client: null as unknown }));

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => mocks.client }));

// Як у Next.js, redirect() і notFound() перериває рендер винятком; сторінки в цих тестах їх не викликають.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

// Дія «Mark as done» тягне next/cache; для рендеру сторінки вона не потрібна.
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { StatusBadge } from "@/components/status-badge";
import RunPage from "./[id]/page";
import RunsPage from "./page";

const RUN_ID = "c0000000-0000-4000-8000-000000000001";
const TASKS = [
  { run_id: RUN_ID, status: "done" },
  { run_id: RUN_ID, status: "done" },
  { run_id: RUN_ID, status: "to_do" },
  { run_id: RUN_ID, status: "to_do" },
  { run_id: RUN_ID, status: "to_do" },
];

const html = (element: React.ReactElement) => renderToStaticMarkup(element);

// Слово статусу й клас кольору одного бейджа: <span data-status="…" class="… bg-status-…">слово</span>
function badge(markup: string, status: string) {
  const match = markup.match(new RegExp(`<span([^>]*data-status="${status}"[^>]*)>([^<]*)</span>`));
  if (!match) throw new Error(`немає бейджа ${status}`);
  const className = match[1].match(/class="([^"]*)"/)?.[1] ?? "";
  return { className, word: match[2] };
}

describe("StatusBadge", () => {
  it("AC-DSYS-01: «in progress» синій, «completed» зелений, слово статусу завжди поруч із кольором", () => {
    const inProgress = badge(html(<StatusBadge status="in_progress" />), "in_progress");
    const completed = badge(html(<StatusBadge status="completed" />), "completed");

    expect(inProgress.word).toBe("in progress");
    expect(inProgress.className).toContain("bg-status-progress");
    expect(completed.word).toBe("completed");
    expect(completed.className).toContain("bg-status-done");
  });
});

describe("список запусків і сторінка запуску", () => {
  beforeEach(() => {
    mocks.client = null;
  });

  it("AC-DSYS-01: список і сторінки запусків показують ті самі слова й колір для «in progress» і «completed»", async () => {
    const runs = [
      { id: RUN_ID, case_name: "Case in progress", status: "in_progress", created_at: "2026-10-26T10:00:00Z" },
      { id: "c0000000-0000-4000-8000-000000000002", case_name: "Case completed", status: "completed", created_at: "2026-10-25T10:00:00Z" },
    ];
    mocks.client = fakeSupabase({ tables: { runs: { data: runs }, run_tasks: { data: TASKS } } });
    const list = html(await RunsPage());

    const listInProgress = badge(list, "in_progress");
    const listCompleted = badge(list, "completed");

    for (const [status, run] of [
      ["in_progress", runs[0]],
      ["completed", runs[1]],
    ] as const) {
      mocks.client = fakeSupabase({
        tables: {
          profiles: { data: { role: "manager" } },
          runs: { data: run },
          run_sections: { data: [{ id: "s1", name: "Before move-in", position: 1 }] },
          run_tasks: {
            data: [
              { id: "t1", name: "Task", position: 1, required: true, status: "to_do", assignee_id: "user-1", section_id: "s1" },
            ],
          },
        },
        rpc: { list_assignable_users: { data: [{ id: "user-1", email: "manager1@example.test" }] } },
      });
      const page = html(await RunPage({ params: Promise.resolve({ id: run.id }), searchParams: Promise.resolve({}) }));
      const listBadge = status === "in_progress" ? listInProgress : listCompleted;
      const pageBadge = badge(page, status);

      expect(pageBadge.word).toBe(listBadge.word);
      expect(pageBadge.className).toBe(listBadge.className);
    }
    // статус задачі на сторінці запуску: слово й сірий токен «to do» (DESIGN.md, розділ 2)
    mocks.client = fakeSupabase({
      tables: {
        profiles: { data: { role: "manager" } },
        runs: { data: runs[0] },
        run_sections: { data: [{ id: "s1", name: "Before move-in", position: 1 }] },
        run_tasks: {
          data: [
            { id: "t1", name: "Task", position: 1, required: true, status: "to_do", assignee_id: "user-1", section_id: "s1" },
            { id: "t2", name: "Task 2", position: 2, required: false, status: "done", assignee_id: "user-1", section_id: "s1" },
          ],
        },
      },
      rpc: { list_assignable_users: { data: [{ id: "user-1", email: "manager1@example.test" }] } },
    });
    const taskPage = html(await RunPage({ params: Promise.resolve({ id: runs[0].id }), searchParams: Promise.resolve({}) }));
    expect(badge(taskPage, "to_do").word).toBe("to do");
    expect(badge(taskPage, "to_do").className).toContain("bg-status-todo");
    expect(badge(taskPage, "done").word).toBe("done");
    expect(badge(taskPage, "done").className).toContain("bg-status-done");

    expect(listInProgress.word).toBe("in progress");
    expect(listCompleted.word).toBe("completed");
    expect(listInProgress.className).toContain("bg-status-progress");
    expect(listCompleted.className).toContain("bg-status-done");
  });

  it("AC-DSYS-04: менеджер без запусків бачить повідомлення й посилання, а порожньої таблиці немає", async () => {
    mocks.client = fakeSupabase({ tables: { runs: { data: [] } } });

    const markup = html(await RunsPage());

    expect(markup).toContain("No runs yet. Launch a template to start one.");
    expect(markup).toMatch(/<a[^>]*href="\/runs\/new"[^>]*>Launch a template<\/a>/);
    expect(markup).not.toContain("<table");
  });
});
