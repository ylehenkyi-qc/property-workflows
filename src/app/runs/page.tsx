import Link from "next/link";
import { redirect } from "next/navigation";
import { PageMessage } from "@/components/page-message";
import { PageShell } from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/auth/require-role";
import { loginPath } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/supabase/server";
import { linkButtonClass } from "@/lib/ui/link-button";
import { loadRunList } from "./load-runs";
import { renderVendorRuns } from "./vendor-runs";

// Список запусків (AC-TASK-06, 09, 13, 14, 17, AC-DSYS-01, AC-DSYS-04). Які запуски бачить користувач, вирішує RLS:
// admin — усі, manager — де він менеджер запуску або виконавець хоча б однієї задачі. Вендор (AC-VENDOR-03, AC-VENDOR-10)
// рядків runs не читає: його запуски, статус і «Your tasks: N of K done» віддає функція list_vendor_runs.
export default async function RunsPage() {
  // requireRole: getClaims() перевіряє JWT, роль — з profiles.role. Не вендор (forbidden) іде звичайним шляхом нижче.
  const vendor = await requireRole("vendor");
  if (vendor.status === "unauthenticated") {
    redirect(loginPath("/runs"));
  }
  if (vendor.status === "ok") return renderVendorRuns(vendor.supabase);

  const supabase = await createClient();

  // getClaims() перевіряє JWT. getSession() для авторизації на сервері не використовуємо.
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    redirect(loginPath("/runs"));
  }

  const items = await loadRunList(supabase);

  return (
    <PageShell>
      <Link href="/" className="text-sm text-muted-foreground underline">
        Home
      </Link>
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold">Runs</h1>
        {items.length > 0 ? (
          <Link href="/runs/new" className={linkButtonClass()}>
            New run
          </Link>
        ) : null}
      </div>

      {items.length === 0 ? (
        <PageMessage
          level={2}
          title="No runs yet. Launch a template to start one."
          link={{ href: "/runs/new", label: "Launch a template" }}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Case</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">
                  <Link href={`/runs/${item.id}`} className="underline underline-offset-4">
                    {item.caseName}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{item.templateName}</TableCell>
                <TableCell>
                  <StatusBadge status={item.status} />
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">{item.progress}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </PageShell>
  );
}
