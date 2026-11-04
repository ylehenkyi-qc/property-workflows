import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "../../tests/helpers/fake-supabase";

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
  useRouter: () => ({ push: () => {} }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import NewRunPage from "@/app/runs/new/page";
import EditTemplatePage from "@/app/templates/[id]/edit/page";
import TemplatePage from "@/app/templates/[id]/page";
import TemplateVersionsPage from "@/app/templates/[id]/versions/page";
import TemplatesPage from "@/app/templates/page";
import Home from "./page";

// Що вендор бачить на сторінках, які йому не належать (шаблони, форма запуску, версії, редактор): те саме повідомлення,
// що в AC-VENDOR-08, у загальному макеті, без даних і з посиланням на сторінку, яку вендор може відкрити (рішення до
// solomchaak/property-workflows-spec#47 і #49). Право тримає база (політики шаблонів): тут — повідомлення й те, що
// сторінка нічого не читає.
const TEMPLATE_ID = "d0000000-0000-4000-8000-000000000001";
const html = (element: React.ReactElement) => renderToStaticMarkup(element);
const page = (search: Record<string, string> = {}) => ({
  params: Promise.resolve({ id: TEMPLATE_ID }),
  searchParams: Promise.resolve(search),
});
const listPage = () => ({ params: Promise.resolve({}), searchParams: Promise.resolve({}) });

const TEMPLATE = { id: TEMPLATE_ID, name: "Tenant move-in", current_version: 1 };

function asVendor() {
  const client = fakeSupabase({
    claims: { sub: "vendor-v", email: "vendor1@example.test" },
    tables: { profiles: { data: { role: "vendor" }, single: { role: "vendor", email: "vendor1@example.test" } }, templates: { data: [TEMPLATE] } },
  });
  mocks.client = client;
  return client;
}

function expectRefusal(markup: string, client: ReturnType<typeof fakeSupabase>) {
  expect(markup).toContain("Not enough rights");
  expect(markup).toMatch(/<a[^>]*href="\/runs"[^>]*>Back to runs<\/a>/);
  // у загальному макеті, як усі сторінки відмов
  expect(markup).toContain("<main");
  expect(markup).toContain('data-testid="page-message"');
  // жодного шаблону на екрані й жодного читання даних понад роль
  expect(markup).not.toContain("Tenant move-in");
  expect(client.calls.from).toEqual(["profiles"]);
  expect(client.calls.rpc).toEqual([]);
}

beforeEach(() => {
  mocks.client = null;
});

describe("вендор відкриває закриті сторінки за прямим посиланням", () => {
  it("AC-VENDOR-08: список шаблонів — «Not enough rights» і жодного шаблону", async () => {
    const client = asVendor();

    expectRefusal(html(await TemplatesPage(listPage())), client);
  });

  it("сторінка шаблону — така сама відмова без шаблону", async () => {
    const client = asVendor();

    expectRefusal(html(await TemplatePage(page())), client);
  });

  it("список версій — така сама відмова без версій", async () => {
    const client = asVendor();

    expectRefusal(html(await TemplateVersionsPage(page())), client);
  });

  it("редактор — така сама відмова без вмісту редактора", async () => {
    const client = asVendor();

    const markup = html(await EditTemplatePage(page()));

    expectRefusal(markup, client);
    expect(markup).not.toContain("Save version");
  });

  it("форма запуску — така сама відмова без форми й виклику списку виконавців", async () => {
    const client = asVendor();

    const markup = html(await NewRunPage({ params: Promise.resolve({}), searchParams: Promise.resolve({}) }));

    expectRefusal(markup, client);
    expect(markup).not.toContain("Launch");
  });
});

describe("головна сторінка за роллю", () => {
  it("вендор бачить лише посилання «Runs»: без «New run» і «Templates» (рішення до solomchaak/property-workflows-spec#44)", async () => {
    asVendor();

    const markup = html(await Home());

    expect(markup).toMatch(/<a[^>]*href="\/runs"[^>]*>Runs<\/a>/);
    expect(markup).not.toContain("New run");
    expect(markup).not.toContain("Templates");
  });

  it("менеджер бачить усі три посилання, як і раніше", async () => {
    mocks.client = fakeSupabase({
      claims: { sub: "manager-a", email: "manager1@example.test" },
      tables: { profiles: { data: { role: "manager" }, single: { role: "manager", email: "manager1@example.test" } } },
    });

    const markup = html(await Home());

    expect(markup).toContain("New run");
    expect(markup).toContain(">Runs<");
    expect(markup).toContain("Templates");
  });
});
