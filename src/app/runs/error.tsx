"use client"; // Error boundaries мають бути Client Components

import { useEffect } from "react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";

// Помилка завантаження запусків: показуємо коротке повідомлення замість хибного порожнього стану.
export default function RunsError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageShell>
      <section className="flex flex-col items-start gap-3">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <Button type="button" variant="outline" onClick={() => retry()}>
          Try again
        </Button>
      </section>
    </PageShell>
  );
}
