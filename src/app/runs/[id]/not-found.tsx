import { PageMessage } from "@/components/page-message";
import { PageShell } from "@/components/page-shell";

// Запуск не знайдено або його не видно користувачеві (RLS): однакова відповідь, щоб не розкривати чужі запуски.
export default function RunNotFound() {
  return (
    <PageShell>
      <PageMessage title="Run not found" link={{ href: "/runs", label: "Back to runs" }} />
    </PageShell>
  );
}
