import { beforeEach, describe, expect, it, vi } from "vitest";

// Мокаємо лише межу з Supabase: роль читає справжній requireRole з profiles.role (ніколи з user_metadata).
const state = vi.hoisted(() => ({
  claims: null as { sub: string } | null,
  // Сира відповідь getClaims, якщо потрібна несправжня форма (data є, а claims немає).
  rawClaims: undefined as unknown,
  profile: null as { role: string } | null,
  profileQuery: [] as unknown[][],
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    const client = {
      auth: {
        getClaims: async () =>
          state.rawClaims ?? { data: state.claims ? { claims: state.claims } : null },
      },
      from: (table: string) => ({
        select: (columns: string) => ({
          eq: (column: string, value: string) => {
            state.profileQuery.push([table, columns, column, value]);
            return { maybeSingle: async () => ({ data: state.profile }) };
          },
        }),
      }),
    };
    return client;
  },
}));

import { requireRole } from "./require-role";

beforeEach(() => {
  state.claims = null;
  state.rawClaims = undefined;
  state.profile = null;
  state.profileQuery = [];
});

describe("AC-DSYS-02: хто має доступ до сторінки лише для адміністратора", () => {
  it("AC-DSYS-02: менеджер B отримує відмову з роллю manager, роль береться з рядка його профілю", async () => {
    state.claims = { sub: "manager-b" };
    state.profile = { role: "manager" };

    const result = await requireRole("admin");

    expect(result).toEqual({ status: "forbidden", role: "manager" });
    expect(state.profileQuery).toEqual([["profiles", "role", "id", "manager-b"]]);
  });

  it("AC-DSYS-02: адміністратор проходить: статус ok, його id і роль admin", async () => {
    state.claims = { sub: "admin-1" };
    state.profile = { role: "admin" };

    const result = await requireRole("admin");

    expect(result).toMatchObject({ status: "ok", userId: "admin-1", role: "admin" });
  });

  it("AC-DSYS-02: користувач без рядка профілю не отримує доступу й не ламає сторінку, відмова без ролі", async () => {
    state.claims = { sub: "no-profile" };
    state.profile = null;

    expect(await requireRole("admin")).toEqual({ status: "forbidden", role: null });
  });

  it("AC-DSYS-02: невідома роль у профілі — відмова без ролі, а не доступ", async () => {
    state.claims = { sub: "someone" };
    state.profile = { role: "superuser" };

    expect(await requireRole("admin")).toEqual({ status: "forbidden", role: null });
  });

  it("AC-DSYS-02: відвідувач без входу — unauthenticated, профіль не читається", async () => {
    state.claims = null;

    expect(await requireRole("admin")).toEqual({ status: "unauthenticated" });
    expect(state.profileQuery).toEqual([]);
  });

  it("AC-DSYS-02: сторінка для кількох ролей пускає менеджера й адміністратора", async () => {
    state.claims = { sub: "manager-b" };
    state.profile = { role: "manager" };

    expect(await requireRole(["manager", "admin"])).toMatchObject({ status: "ok", role: "manager" });
  });
});

describe("AC-EDITOR-09: відвідувач без входу", () => {
  it("AC-EDITOR-09: відповідь getClaims без claims — це гість, а не збій сторінки", async () => {
    state.rawClaims = { data: {} };

    expect(await requireRole("admin")).toEqual({ status: "unauthenticated" });
    expect(state.profileQuery).toEqual([]);
  });
});
