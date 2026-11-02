"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth/user-id";
import { createClient } from "@/lib/supabase/server";
import { markTaskErrorCode } from "@/lib/runs/markTaskErrors";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Позначення задачі виконаною (AC-TASK-01, 02, 03, 04, 07). Права й автозавершення запуску гарантує
// mark_task_done у базі; тут — авторизація, виклик rpc і повернення на сторінку запуску з кодом помилки.
export async function markTaskDone(taskId: string, runId: string) {
  const supabase = await createClient();

  if (!(await currentUserId(supabase))) {
    redirect("/login");
  }

  // runId лише для повернення на сторінку: чужий формат не підставляємо в адресу.
  const target = UUID.test(runId) ? `/runs/${runId}` : "/runs";

  const { error } = await supabase.rpc("mark_task_done", { p_task_id: taskId });
  if (error) {
    redirect(`${target}?error=${markTaskErrorCode(error)}`);
  }

  revalidatePath(target);
  redirect(target);
}
