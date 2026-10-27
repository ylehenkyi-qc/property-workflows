"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { markTaskDone } from "./actions";

// «Mark as done». Для останньої обов'язкової задачі (вона завершує запуск) спершу діалог із назвою задачі й
// «This cannot be undone»: статус змінюється лише після «Confirm», «Cancel» нічого не викликає (AC-TASK-04, AC-TASK-16).
export function MarkDoneButton({
  taskId,
  runId,
  taskName,
  needsConfirmation,
}: {
  taskId: string;
  runId: string;
  taskName: string;
  needsConfirmation: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!needsConfirmation) {
    return (
      <form action={markTaskDone.bind(null, taskId, runId)}>
        <Button type="submit" variant="outline" size="sm">
          Mark as done
        </Button>
      </form>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-confirm="true"
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        Mark as done
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Mark “${taskName}” as done?`}
        onConfirm={() => {
          startTransition(() => {
            void markTaskDone(taskId, runId);
          });
        }}
      />
    </>
  );
}
