import { PageMessage } from "@/components/page-message";
import { PageShell } from "@/components/page-shell";

// Шаблон не знайдено або його не видно користувачеві (RLS): менеджер не бачить ніколи не збережений шаблон, і відповідь
// та сама, що для неіснуючого (рішення до solomchaak/property-workflows-spec#25, #26).
export default function TemplateNotFound() {
  return (
    <PageShell>
      <PageMessage title="Template not found" link={{ href: "/templates", label: "Back to templates" }} />
    </PageShell>
  );
}
