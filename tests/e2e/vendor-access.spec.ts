// UAT на проді для всіх 10 AC зрізу 3 «vendor-access» (домашка WS9). Дослівні AC — requirements/39-assign-a-vendor-own-tasks.md.
// Користувачі й запуски синтетичні: uat-<запуск>-<мітка>@example.test, їх створює й видаляє ця специфікація (@writes).
// Прод — спільна база з PM: ми пишемо лише власних синтетичних менеджерів, вендорів і запуски, а afterAll їх прибирає.
// AC «напряму, оминаючи сторінки» (AC-VENDOR-07, AC-VENDOR-09): правило доводить тест бази на PGlite
// (tests/db/vendor-access.test.ts), а тут — прямий виклик від імені сесії вендора й крок, що показує на екрані «що не змінилося».
import { expect, test, type Page } from "@playwright/test";
import { deleteUatUsers } from "./support/admin";
import type { UatUser } from "./support/data";
import { attachRuntimeErrors, given, signIn, thenStep, when } from "./support/uat";
import {
  createUatUser,
  createVendorScenario,
  runsManagedBy,
  runTaskId,
  runTasks,
  templateTasks,
  userClient,
} from "./support/vendor-data";

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

test.afterAll(async () => {
  await deleteUatUsers();
});

async function signedInAs(page: Page, user: UatUser) {
  await signIn(page, user.email, user.password);
  // Email показано на «/»; вендор після входу потрапляє на «/runs», тож відкриваємо «/» явно.
  await page.goto("/");
  await expect(page.getByTestId("user-email")).toHaveText(user.email);
}

/** Рядок задачі на сторінці запуску: у межах секції за її назвою, за назвою задачі. */
function taskRow(page: Page, sectionName: string, taskName: string) {
  return page
    .getByRole("main")
    .locator("section")
    .filter({ has: page.getByRole("heading", { level: 2, name: sectionName, exact: true }) })
    .getByTestId("run-task")
    .filter({ hasText: taskName });
}

test(
  "AC-VENDOR-01: manager A launches «Tenant move-in» for «Apartment 12, move-in» and assigns vendor V to tasks 3 and 4; tasks 3 and 4 have V and tasks 1, 2 and 5 have A",
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-01" } },
  async ({ page }) => {
    const { tasks } = await templateTasks();
    let managerA!: UatUser;
    let vendorV!: UatUser;

    await given('manager A, vendor V and the template "Tenant move-in" with 5 tasks', async () => {
      managerA = await createUatUser("v01-a", "manager");
      vendorV = await createUatUser("v01-v", "vendor");
      await signedInAs(page, managerA);
    });
    await when('A launches the template for the case "Apartment 12, move-in" and assigns V as the assignee of tasks 3 and 4', async () => {
      await page.goto("/runs/new");
      await page.getByRole("combobox", { name: "Template" }).click();
      await page.getByRole("option", { name: "Tenant move-in", exact: true }).click();
      await page.getByRole("button", { name: "Choose template" }).click();
      await page.getByLabel("Case name").fill("Apartment 12, move-in");
      for (const n of [3, 4]) {
        await page.getByRole("combobox", { name: tasks[n - 1].name, exact: true }).click();
        await page.getByRole("option", { name: vendorV.email, exact: true }).click();
      }
      await page.getByRole("button", { name: "Launch", exact: true }).click();
      await page.waitForURL(/\/runs\/[0-9a-f-]{36}$/);
    });

    await thenStep(
      page,
      {
        clause: "Tasks 3 and 4 have V as the assignee, and tasks 1, 2 and 5 have A.",
        visible: [
          "tasks 3 and 4 of the run show the email of vendor V as the assignee",
          "tasks 1, 2 and 5 of the run show the email of manager A as the assignee",
        ],
        hidden: ["the assignee ids of the run tasks in the database are V for tasks 3 and 4 and A for tasks 1, 2 and 5"],
      },
      async () => {
        for (const [i, task] of tasks.entries()) {
          const expected = [2, 3].includes(i) ? vendorV.email : managerA.email;
          await expect(taskRow(page, task.section, task.name)).toContainText(expected);
        }
        const url = new URL(page.url());
        const runId = url.pathname.split("/").pop()!;
        const state = await runTasks(runId);
        expect(state.map((t) => t.assigneeId)).toEqual([managerA.id, managerA.id, vendorV.id, vendorV.id, managerA.id]);
      },
    );
  },
);

test(
  "AC-VENDOR-02: manager A opens the assignee picker and sees the emails of manager B, of the administrator and of vendor V, and no names, roles or other profile data",
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-02" } },
  async ({ page }) => {
    const { tasks } = await templateTasks();
    let managerA!: UatUser;
    let managerB!: UatUser;
    let administrator!: UatUser;
    let vendorV!: UatUser;

    await given("managers A and B, an administrator and vendor V, and A launching a template", async () => {
      managerA = await createUatUser("v02-a", "manager");
      managerB = await createUatUser("v02-b", "manager");
      administrator = await createUatUser("v02-adm", "admin");
      vendorV = await createUatUser("v02-v", "vendor");
      await signedInAs(page, managerA);
      await page.goto("/runs/new");
      await page.getByRole("combobox", { name: "Template" }).click();
      await page.getByRole("option", { name: "Tenant move-in", exact: true }).click();
      await page.getByRole("button", { name: "Choose template" }).click();
    });
    await when("A opens the assignee picker", async () => {
      await page.getByRole("combobox", { name: tasks[0].name, exact: true }).click();
    });

    await thenStep(
      page,
      {
        clause: "A sees the emails of B, of the administrator and of V, and no names, roles or other profile data.",
        visible: [
          "the open list shows the emails of manager B, of the administrator and of vendor V",
          "every entry of the list except «Me» is an email, with no name or role next to it",
        ],
        hidden: ["the picker data has only the fields id and email for each user (read with A's own session)"],
      },
      async () => {
        const options = page.getByRole("option");
        for (const email of [managerB.email, administrator.email, vendorV.email]) {
          await expect(options.filter({ hasText: email })).toHaveCount(1);
        }
        const labels = (await options.allInnerTexts()).map((text) => text.trim()).filter((text) => text !== "Me");
        for (const label of labels) expect(label).toMatch(/^[^\s@]+@[^\s@]+$/);

        const client = await userClient(managerA);
        const { data, error } = await client.rpc("list_assignable_users");
        expect(error).toBeNull();
        for (const row of data ?? []) expect(Object.keys(row).sort()).toEqual(["email", "id"]);
      },
    );
  },
);

test(
  'AC-VENDOR-03: vendor V opens the list of runs and sees only the run "Apartment 12, move-in" with its run status and "Your tasks: 0 of 2 done", and does not see "Apartment 14, repair"',
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-03" } },
  async ({ page }) => {
    let scenario!: Awaited<ReturnType<typeof createVendorScenario>>;

    await given(
      'vendor V who is the assignee of 2 tasks in the run "Apartment 12, move-in" and of no task in the run "Apartment 14, repair"',
      async () => {
        scenario = await createVendorScenario("v03");
        await signedInAs(page, scenario.vendorV);
      },
    );
    await when("V opens the list of runs", async () => {
      await page.goto("/runs");
    });

    await thenStep(
      page,
      {
        clause:
          'V sees only the run "Apartment 12, move-in" with its run status and "Your tasks: 0 of 2 done", and does not see "Apartment 14, repair".',
        visible: [
          'one row, the run "Apartment 12, move-in"',
          'the run status "in progress" in that row',
          'the text "Your tasks: 0 of 2 done" in that row',
          'no "Apartment 14, repair" anywhere on the page',
        ],
      },
      async () => {
        const main = page.getByRole("main");
        const rows = main.getByRole("row").filter({ hasNot: page.getByRole("columnheader") });
        await expect(rows).toHaveCount(1);
        await expect(rows.first()).toContainText("Apartment 12, move-in");
        await expect(rows.first()).toContainText("in progress");
        await expect(rows.first()).toContainText("Your tasks: 0 of 2 done");
        await expect(main.getByText("Apartment 14, repair")).toHaveCount(0);
      },
    );
  },
);

test(
  "AC-VENDOR-04: vendor V opens the run «Apartment 12, move-in» and sees exactly tasks 3 and 4, each with its name, its section, the mark «required» or «optional» and its status, and not tasks 1, 2 and 5, the emails of other users or the progress of the whole run",
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-04" } },
  async ({ page }) => {
    const { tasks } = await templateTasks();
    let scenario!: Awaited<ReturnType<typeof createVendorScenario>>;

    await given('vendor V who is the assignee of tasks 3 and 4 in the run "Apartment 12, move-in" (5 tasks)', async () => {
      scenario = await createVendorScenario("v04");
      await signedInAs(page, scenario.vendorV);
    });
    await when("V opens this run", async () => {
      await page.goto(`/runs/${scenario.moveInRunId}`);
    });

    await thenStep(
      page,
      {
        clause:
          "V sees exactly tasks 3 and 4, each with its name, its section, the mark \"required\" or \"optional\" and its status, and does not see tasks 1, 2 and 5, the emails of other users or the progress of the whole run.",
        visible: [
          "exactly two tasks, tasks 3 and 4, each under its section heading",
          'each of them with the mark "required" or "optional" and the status "to do"',
          "no tasks 1, 2 and 5",
          "no email of any user and no progress of the whole run (only «Your tasks: 0 of 2 done»)",
        ],
      },
      async () => {
        const main = page.getByRole("main");
        await expect(main.getByTestId("run-task")).toHaveCount(2);
        for (const n of [3, 4]) {
          const task = tasks[n - 1];
          const row = taskRow(page, task.section, task.name);
          await expect(row).toHaveCount(1);
          await expect(row).toContainText(task.required ? "required" : "optional");
          await expect(row).toContainText("to do");
        }
        for (const n of [1, 2, 5]) {
          await expect(main.getByTestId("run-task").filter({ hasText: tasks[n - 1].name })).toHaveCount(0);
        }
        await expect(main.getByText("@")).toHaveCount(0);
        await expect(main.getByText("of 5 done")).toHaveCount(0);
        await expect(page.getByTestId("run-progress")).toHaveText("Your tasks: 0 of 2 done");
      },
    );
  },
);

test(
  'AC-VENDOR-05: vendor V marks task 3 as done; task 3 has status "done" and V sees "Your tasks: 1 of 2 done"',
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-05" } },
  async ({ page }) => {
    const { tasks } = await templateTasks();
    const task3 = tasks[2];
    let scenario!: Awaited<ReturnType<typeof createVendorScenario>>;

    await given(
      'vendor V who is the assignee of task 3 with status "to do", which is not the last required task of the run "Apartment 12, move-in"',
      async () => {
        scenario = await createVendorScenario("v05");
        await signedInAs(page, scenario.vendorV);
        await page.goto(`/runs/${scenario.moveInRunId}`);
        await expect(taskRow(page, task3.section, task3.name)).toContainText("to do");
      },
    );
    await when("V marks task 3 as done", async () => {
      await taskRow(page, task3.section, task3.name).getByRole("button", { name: "Mark as done" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
    });

    await thenStep(
      page,
      {
        clause: 'Task 3 has status "done", and V sees "Your tasks: 1 of 2 done".',
        // Задачі в застосунку без номерів: task 3 — «${task3.name}» за знімком шаблону (його тримає база, не сторінка).
        visible: [
          `task 3 of the template, «${task3.name}», shows the status "done"`,
          'the text "Your tasks: 1 of 2 done"',
        ],
        hidden: ['the status of task 3 in the database is "done"'],
      },
      async () => {
        await expect(taskRow(page, task3.section, task3.name)).toContainText("done");
        await expect(taskRow(page, task3.section, task3.name)).not.toContainText("to do");
        await expect(page.getByTestId("run-progress")).toHaveText("Your tasks: 1 of 2 done");
        expect((await runTasks(scenario.moveInRunId))[2].status).toBe("done");
      },
    );
  },
);

test(
  'AC-VENDOR-06: vendor V opens by a direct link the page of the run "Apartment 14, repair" in which V has no task and sees "Run not found" and none of the tasks of the run',
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-06" } },
  async ({ page }) => {
    let scenario!: Awaited<ReturnType<typeof createVendorScenario>>;

    await given('the run "Apartment 14, repair" in which vendor V has no task', async () => {
      scenario = await createVendorScenario("v06");
      await signedInAs(page, scenario.vendorV);
    });
    await when("V opens the page of this run by a direct link", async () => {
      await page.goto(`/runs/${scenario.repairRunId}`);
    });

    await thenStep(
      page,
      {
        clause: 'V sees the message "Run not found" and none of the tasks of the run.',
        visible: ['the message "Run not found"', "no tasks of the run on the page"],
      },
      async () => {
        const main = page.getByRole("main");
        await expect(main.getByRole("heading", { level: 1, name: "Run not found" })).toBeVisible();
        await expect(main.getByTestId("run-task")).toHaveCount(0);
        await expect(main.getByText("Apartment 14, repair")).toHaveCount(0);
      },
    );
  },
);

test(
  'AC-VENDOR-07: vendor V tries to mark task 1 of manager A as done directly, bypassing the pages of the application; task 1 stays "to do"',
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-07" } },
  async ({ page }) => {
    const { tasks } = await templateTasks();
    const task1 = tasks[0];
    let scenario!: Awaited<ReturnType<typeof createVendorScenario>>;
    let rejected: string | undefined;

    await given(
      'the run "Apartment 12, move-in" in which task 1 is assigned to manager A and tasks 3 and 4 to vendor V',
      async () => {
        scenario = await createVendorScenario("v07");
        expect((await runTasks(scenario.moveInRunId))[0].assigneeId).toBe(scenario.managerA.id);
      },
    );
    await when("V tries to mark task 1 as done directly, bypassing the pages of the application", async () => {
      const vendor = await userClient(scenario.vendorV);
      const { error } = await vendor.rpc("mark_task_done", { p_task_id: await runTaskId(scenario.moveInRunId, 1) });
      rejected = error?.message;
    });

    await thenStep(
      page,
      {
        clause: 'Task 1 stays "to do".',
        visible: ['on the page of the run, opened by manager A, task 1 shows the status "to do"'],
        hidden: ["the direct request of V was rejected (an error came back)", 'the status of task 1 in the database is "to_do"'],
      },
      async () => {
        expect(rejected, "прямий запит вендора мав бути відхилений").toBeTruthy();
        await signedInAs(page, scenario.managerA);
        await page.goto(`/runs/${scenario.moveInRunId}`);
        await expect(taskRow(page, task1.section, task1.name)).toContainText("to do");
        // Слово «done» як статус — окремий елемент; кнопка «Mark as done» має інший текст, тож точний збіг її не зачіпає.
        await expect(taskRow(page, task1.section, task1.name).getByText("done", { exact: true })).toHaveCount(0);
        expect((await runTasks(scenario.moveInRunId))[0].status).toBe("to_do");
      },
    );
  },
);

test(
  'AC-VENDOR-08: vendor V signed in opens the list of templates by a direct link and sees "Not enough rights" and no template',
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-08" } },
  async ({ page }) => {
    await given("vendor V signed in", async () => {
      await signedInAs(page, await createUatUser("v08-v", "vendor"));
    });
    await when("V opens the list of templates by a direct link", async () => {
      await page.goto("/templates");
    });

    await thenStep(
      page,
      {
        clause: 'V sees the message "Not enough rights" and no template.',
        visible: ['the message "Not enough rights"', "no template: no table and no template names"],
      },
      async () => {
        const main = page.getByRole("main");
        await expect(main.getByRole("heading", { level: 1, name: "Not enough rights" })).toBeVisible();
        await expect(main.getByRole("table")).toHaveCount(0);
        await expect(main.getByText("Tenant move-in")).toHaveCount(0);
      },
    );
  },
);

test(
  'AC-VENDOR-09: vendor V tries to launch the template "Tenant move-in" directly, bypassing the pages of the application; no run is created and the list of runs does not change',
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-09" } },
  async ({ page }) => {
    const { templateId, tasks } = await templateTasks();
    let scenario!: Awaited<ReturnType<typeof createVendorScenario>>;
    let before!: string[];
    let rejected: string | undefined;

    await given('vendor V signed in and the template "Tenant move-in" with current version 1', async () => {
      scenario = await createVendorScenario("v09");
      await signedInAs(page, scenario.vendorV);
      await page.goto("/runs");
      // textContent, а не innerText: toHaveText порівнює саме textContent, і пробіли в них різні.
      before = await page.getByRole("main").getByRole("row").allTextContents();
    });
    await when("V tries to launch this template directly, bypassing the pages of the application", async () => {
      const vendor = await userClient(scenario.vendorV);
      const { error } = await vendor.rpc("launch_run", {
        p_template_id: templateId,
        p_case_name: "Direct launch by vendor",
        p_assignments: [{ template_task_id: tasks[0].id, assignee_id: scenario.vendorV.id }],
      });
      rejected = error?.message;
    });

    await thenStep(
      page,
      {
        clause: "No run is created, and the list of runs does not change.",
        // «До» — з умови Дано: у V рівно один запуск. Кадр «після» має показувати саме його і нічого більше.
        visible: [
          'the list of runs of V, opened again, has exactly one row: the run "Apartment 12, move-in" with "Your tasks: 0 of 2 done" (the only run V had before the attempt)',
          'no run "Direct launch by vendor" and no other new row in the list',
        ],
        hidden: [
          "the direct request of V was rejected (an error came back)",
          "V is the manager of no run in the database and no run «Direct launch by vendor» exists",
        ],
      },
      async () => {
        expect(rejected, "прямий запит вендора мав бути відхилений").toBeTruthy();
        expect(await runsManagedBy(scenario.vendorV.id)).toBe(0);
        await page.goto("/runs");
        await expect(page.getByRole("main").getByText("Direct launch by vendor")).toHaveCount(0);
        await expect(page.getByRole("main").getByRole("row")).toHaveText(before);
      },
    );
  },
);

test(
  'AC-VENDOR-10: vendor V to whom no task is assigned opens the list of runs and sees "No tasks assigned to you yet." and no empty table',
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-10" } },
  async ({ page }) => {
    await given("vendor V to whom no task is assigned", async () => {
      await signedInAs(page, await createUatUser("v10-v", "vendor"));
    });
    await when("V opens the list of runs", async () => {
      await page.goto("/runs");
    });

    await thenStep(
      page,
      {
        clause: 'V sees the message "No tasks assigned to you yet." and no empty table.',
        visible: ['the message "No tasks assigned to you yet."', "no table on the page"],
      },
      async () => {
        const main = page.getByRole("main");
        await expect(main.getByText("No tasks assigned to you yet.", { exact: true })).toBeVisible();
        await expect(main.getByRole("table")).toHaveCount(0);
      },
    );
  },
);
