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
import { createClient } from "@/lib/supabase/server";
import { linkButtonClass } from "@/lib/ui/link-button";
import { buildRunList } from "@/lib/runs/runList";

// Список запусків (AC-TASK-06, AC-TASK-09, AC-DSYS-01, AC-DSYS-04). Які запуски бачить користувач, вирішує RLS:
// admin — усі, manager — де він менеджер запуску або виконавець хоча б однієї задачі.
export default async function RunsPage() {
  const supabase = await createClient();

  // getClaims() перевіряє JWT. getSession() для авторизації на сервері не використовуємо.
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    redirect("/login");
  }

  const { data: runs, error: runsError } = await supabase
    .from("runs")
    .select("id, case_name, status, created_at")
    .order("created_at", { ascending: false });
  // Помилку не маскуємо порожнім списком: error.tsx покаже «Something went wrong».
  if (runsError) {
    throw new Error("Failed to load runs");
  }

  // Задачі беремо окремим запитом: run_tasks пов'язана з run_sections, а не напряму з runs.
  const runIds = (runs ?? []).map((run) => run.id);
  const { data: tasks, error: tasksError } = runIds.length
    ? await supabase.from("run_tasks").select("run_id, status").in("run_id", runIds)
    : { data: [], error: null };
  if (tasksError) {
    throw new Error("Failed to load run tasks");
  }

  const items = buildRunList(runs ?? [], tasks ?? []);

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
