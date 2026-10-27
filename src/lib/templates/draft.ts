// Чернетка шаблону в редакторі (AC-EDITOR-01): секції й задачі в порядку відображення. Операції чисті: повертають новий
// список, не змінюють вхідний. Ключі (key) — лише для React і операцій; у базу йде вміст без ключів (toContent).
export type DraftTask = { key: string; name: string; required: boolean };
export type DraftSection = { key: string; name: string; tasks: DraftTask[] };
export type Draft = DraftSection[];

// Формат p_content для save_template_draft: порядок масивів = порядок секцій і задач.
export type DraftContent = { name: string; tasks: { name: string; required: boolean }[] }[];

export function buildDraft(
  sections: readonly { id: string; name: string; position: number }[],
  tasks: readonly { id: string; name: string; required: boolean; position: number; section_id: string }[],
): Draft {
  return [...sections]
    .sort((a, b) => a.position - b.position)
    .map((section) => ({
      key: section.id,
      name: section.name,
      tasks: tasks
        .filter((task) => task.section_id === section.id)
        .sort((a, b) => a.position - b.position)
        .map((task) => ({ key: task.id, name: task.name, required: task.required })),
    }));
}

export function toContent(draft: Draft): DraftContent {
  return draft.map((section) => ({
    name: section.name,
    tasks: section.tasks.map((task) => ({ name: task.name, required: task.required })),
  }));
}

const swap = <T,>(items: readonly T[], from: number, to: number): T[] => {
  if (to < 0 || to >= items.length) return [...items];
  const next = [...items];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
};

const mapSection = (draft: Draft, sectionKey: string, change: (section: DraftSection) => DraftSection): Draft =>
  draft.map((section) => (section.key === sectionKey ? change(section) : section));

export function addSection(draft: Draft, key: string, name = "New section"): Draft {
  return [...draft, { key, name, tasks: [] }];
}

export function renameSection(draft: Draft, sectionKey: string, name: string): Draft {
  return mapSection(draft, sectionKey, (section) => ({ ...section, name }));
}

export function removeSection(draft: Draft, sectionKey: string): Draft {
  return draft.filter((section) => section.key !== sectionKey);
}

// delta: -1 — вище, +1 — нижче; на краю списку нічого не міняється.
export function moveSection(draft: Draft, sectionKey: string, delta: -1 | 1): Draft {
  const index = draft.findIndex((section) => section.key === sectionKey);
  return index < 0 ? draft : swap(draft, index, index + delta);
}

export function addTask(draft: Draft, sectionKey: string, key: string, name = "New task"): Draft {
  return mapSection(draft, sectionKey, (section) => ({
    ...section,
    tasks: [...section.tasks, { key, name, required: false }],
  }));
}

const mapTask = (draft: Draft, taskKey: string, change: (task: DraftTask) => DraftTask): Draft =>
  draft.map((section) => ({
    ...section,
    tasks: section.tasks.map((task) => (task.key === taskKey ? change(task) : task)),
  }));

export function renameTask(draft: Draft, taskKey: string, name: string): Draft {
  return mapTask(draft, taskKey, (task) => ({ ...task, name }));
}

export function setTaskRequired(draft: Draft, taskKey: string, required: boolean): Draft {
  return mapTask(draft, taskKey, (task) => ({ ...task, required }));
}

export function removeTask(draft: Draft, taskKey: string): Draft {
  return draft.map((section) => ({ ...section, tasks: section.tasks.filter((task) => task.key !== taskKey) }));
}

// Зсув задачі в межах її секції; між секціями — moveTaskToSection.
export function moveTask(draft: Draft, taskKey: string, delta: -1 | 1): Draft {
  return draft.map((section) => {
    const index = section.tasks.findIndex((task) => task.key === taskKey);
    return index < 0 ? section : { ...section, tasks: swap(section.tasks, index, index + delta) };
  });
}

// Перенесення задачі в кінець іншої секції (рішення до solomchaak/property-workflows-spec#36).
export function moveTaskToSection(draft: Draft, taskKey: string, targetSectionKey: string): Draft {
  const task = draft.flatMap((section) => section.tasks).find((item) => item.key === taskKey);
  if (!task || !draft.some((section) => section.key === targetSectionKey)) return draft;
  return draft.map((section) => {
    const without = section.tasks.filter((item) => item.key !== taskKey);
    return section.key === targetSectionKey ? { ...section, tasks: [...without, task] } : { ...section, tasks: without };
  });
}

export function sectionKeyOfTask(draft: Draft, taskKey: string): string | undefined {
  return draft.find((section) => section.tasks.some((task) => task.key === taskKey))?.key;
}
