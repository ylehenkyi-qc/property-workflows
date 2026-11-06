import { PageMessage } from "@/components/page-message";
import { PageShell } from "@/components/page-shell";
import { refusalLink, type RefusalLink } from "@/lib/auth/refusal-link";
import type { AppRole } from "@/lib/auth/require-role";
import { NOT_ENOUGH_RIGHTS } from "@/lib/templates/messages";

// Відмова в доступі «Not enough rights» (AC-DSYS-02, AC-VENDOR-08) у загальному макеті, без даних сторінки. Посилання
// назад: для вендора — «Back to runs», для решти — fallback сторінки (за замовчуванням головна).
export function NotEnoughRights({ role, fallback }: { role: AppRole | null; fallback?: RefusalLink }) {
  return (
    <PageShell>
      <PageMessage title={NOT_ENOUGH_RIGHTS} link={refusalLink(role, fallback)} />
    </PageShell>
  );
}
