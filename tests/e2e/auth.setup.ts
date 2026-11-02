// Вхід ролей один раз за прогін → playwright/.auth/<role>.json (у .gitignore: там живі cookie сесії).
// Наші три AC (AC-DSYS-02, AC-EDITOR-07, AC-DSYS-04) йдуть під СИНТЕТИЧНИМИ користувачами uat-<запуск>-<мітка>@example.test,
// яких створює й видаляє сама специфікація (tests/e2e/support/data.ts): так «менеджер без запусків» і «менеджер, чужий
// для запуску» справді такі на проді, а паролі акаунтів зі «accounts.zip» тут не потрібні.
// Для AC, що потребують готового акаунта, додайте роль: адреса з D0.5, пароль — з DEMO_USER_PASSWORD чи
// UAT_PASSWORD_<РОЛЬ> у .env.local (ніколи в коді).
import { expect, test as setup } from "@playwright/test";
import { signIn } from "./support/uat";

const ROLES: Record<string, string> = {};

for (const [role, email] of Object.entries(ROLES)) {
  setup(`вхід: ${role}`, async ({ page }) => {
    const password = process.env[`UAT_PASSWORD_${role.toUpperCase()}`] ?? process.env.DEMO_USER_PASSWORD;
    expect(password, `немає пароля для ролі ${role}: DEMO_USER_PASSWORD або UAT_PASSWORD_${role.toUpperCase()}`).toBeTruthy();
    await signIn(page, email, password!);
    await expect(page.getByTestId("user-email")).toHaveText(email);
    await page.context().storageState({ path: `playwright/.auth/${role}.json` });
  });
}
