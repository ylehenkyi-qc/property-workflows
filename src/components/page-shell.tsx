import { cn } from "@/lib/utils";

// Загальний макет сторінки (DESIGN.md, розділ 4): однаковий для сторінок із даними, відмов, порожніх станів і входу
// (AC-DSYS-02, AC-DSYS-03, AC-DSYS-04).
export function PageShell({
  children,
  narrow = false,
  className,
}: {
  children: React.ReactNode;
  narrow?: boolean;
  className?: string;
}) {
  return (
    <main
      className={cn(
        "mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-8 sm:px-6",
        narrow ? "max-w-sm justify-center" : "max-w-3xl",
        className,
      )}
    >
      {children}
    </main>
  );
}
