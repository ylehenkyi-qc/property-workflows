import type { VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Клас для посилання, що виглядає як кнопка (<Link className={linkButtonClass({ variant: "outline" })}>).
// buttonVariants сам класи не зливає: у результаті разом стоять border-transparent (база) і border-input (варіант), і в
// світлій темі перемагає прозора межа. cn() зливає конфлікти. Тому голий buttonVariants у className не використовуємо.
export function linkButtonClass(options?: VariantProps<typeof buttonVariants>, extra?: string): string {
  return cn(buttonVariants(options), extra);
}
