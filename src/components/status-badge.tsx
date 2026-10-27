import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { statusInfo } from "@/lib/ui/status";

// Статус завжди як слово + колір із токенів status-* (DESIGN.md): колір сам по собі статус не передає.
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const info = statusInfo(status);
  return (
    <Badge data-status={status} className={cn(info.className, className)}>
      {info.label}
    </Badge>
  );
}
