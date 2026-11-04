import Link from "next/link";
import { PageMessage } from "@/components/page-message";
import { PageShell } from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { createClient } from "@/lib/supabase/server";
import { formatVendorProgress } from "@/lib/runs/progress";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type VendorRun = {
  id: string;
  case_name: string;
  status: string;
  tasks_total: number;
  tasks_done: number;
};

// Дані списку вендора: його запуски, статус і «Your tasks: N of K done» віддає list_vendor_runs (рядків runs вендор не читає).
// Помилку не маскуємо порожнім списком: error.tsx покаже «Something went wrong».
export async function renderVendorRuns(supabase: Supabase) {
  const { data: runs, error } = await supabase.rpc("list_vendor_runs");
  if (error) {
    throw new Error("Failed to load runs");
  }
  return <VendorRuns runs={runs ?? []} />;
}

// Список запусків вендора (AC-VENDOR-03, AC-VENDOR-10): лише запуски з його задачами, кожен — назва випадку, статус
// запуску й «Your tasks: N of K done»; без назви шаблону й прогресу всього запуску (робоче рішення до
// solomchaak/property-workflows-spec#42, варіант A). Нема запусків — повідомлення без порожньої таблиці й без «New run».
export function VendorRuns({ runs }: { runs: readonly VendorRun[] }) {
  return (
    <PageShell>
      <Link href="/" className="text-sm text-muted-foreground underline">
        Home
      </Link>
      <h1 className="text-2xl font-semibold">Runs</h1>

      {runs.length === 0 ? (
        <PageMessage level={2} title="No tasks assigned to you yet." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Case</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Your tasks</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => (
              <TableRow key={run.id}>
                <TableCell className="font-medium">
                  <Link href={`/runs/${run.id}`} className="underline underline-offset-4">
                    {run.case_name}
                  </Link>
                </TableCell>
                <TableCell>
                  <StatusBadge status={run.status} />
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {formatVendorProgress(run.tasks_done, run.tasks_total)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </PageShell>
  );
}
