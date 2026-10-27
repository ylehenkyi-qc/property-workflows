import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PageMessageLink = { href: string; label: string };

// Відмова в доступі, «Run not found», порожній стан: заголовок + необов'язковий пояснювальний текст і посилання на
// наступний крок. Завжди в тому самому місці й стилі (DESIGN.md, розділ 6). level=2 — коли сторінка вже має свій h1
// (порожній список під заголовком «Runs»).
export function PageMessage({
  title,
  description,
  link,
  level = 1,
}: {
  title: string;
  description?: string;
  link?: PageMessageLink;
  level?: 1 | 2;
}) {
  const Heading = level === 1 ? "h1" : "h2";
  return (
    <section data-testid="page-message" className="flex flex-col items-start gap-3">
      <Heading className={level === 1 ? "text-2xl font-semibold" : "text-lg font-semibold"}>{title}</Heading>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      {link ? (
        <Link href={link.href} className={cn(buttonVariants({ variant: "link" }), "h-auto px-0")}>
          {link.label}
        </Link>
      ) : null}
    </section>
  );
}
