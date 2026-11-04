import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { groupTasksBySection } from "@/lib/runs/groupTasksBySection";

// Задачі запуску за секціями (AC-TASK-12, AC-TASK-15, AC-VENDOR-04): назва секції, кожна задача з назвою й позначкою
// «required»/«optional»; що стоїть праворуч (статус, виконавець, кнопка), задає сторінка через actions — менеджерська й
// вендорська сторінки показують різне, а розмітка списку спільна.
export function TaskSections<
  S extends { id: string; name: string; position: number },
  T extends { id: string; name: string; position: number; required: boolean; section_id: string },
>({
  sections,
  tasks,
  actions,
}: {
  sections: readonly S[];
  tasks: readonly T[];
  actions: (task: T) => React.ReactNode;
}) {
  return (
    <>
      {groupTasksBySection(sections, tasks).map(({ section, tasks: sectionTasks }) => (
        <section key={section.id} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{section.name}</h2>
          <ul className="flex flex-col gap-2">
            {sectionTasks.map((task) => (
              <li key={task.id} data-testid="run-task">
                <Card className="flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span className="flex flex-wrap items-center gap-2">
                    {task.name}
                    <Badge variant="outline">{task.required ? "required" : "optional"}</Badge>
                  </span>
                  <span className="flex flex-wrap items-center gap-3 text-muted-foreground">{actions(task)}</span>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
