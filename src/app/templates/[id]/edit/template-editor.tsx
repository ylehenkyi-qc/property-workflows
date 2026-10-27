"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppSelect } from "@/components/app-select";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addSection,
  addTask,
  moveSection,
  moveTask,
  moveTaskToSection,
  removeSection,
  removeTask,
  renameSection,
  renameTask,
  sectionKeyOfTask,
  setTaskRequired,
  toContent,
  type Draft,
} from "@/lib/templates/draft";
import { ALL_CHANGES_KEPT, DRAFT_NOT_SAVED } from "@/lib/templates/messages";
import { publishTemplate, saveTemplateDraft } from "../../actions";

const AUTOSAVE_DELAY_MS = 800;

type SaveState = "idle" | "saving" | "saved" | "error";
type Notice = { kind: "success" | "error"; text: string };
type PendingRemoval = { kind: "section" | "task"; key: string; name: string };

// Редактор шаблону (AC-EDITOR-01, 03, 04): зміни зберігаються автоматично (debounce) у робочу копію, поки шаблон не
// збережено як версію з'являється «Unpublished changes»; «Save version» спершу дозберігає чернетку, потім створює версію.
// Правило «є обов'язкова задача» перевіряє база (publish_template); текст відмови показуємо дослівно.
export function TemplateEditor({
  templateId,
  templateName,
  initialDraft,
  initialDirty,
}: {
  templateId: string;
  templateName: string;
  initialDraft: Draft;
  initialDirty: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [dirty, setDirty] = useState(initialDirty);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval | null>(null);

  const latest = useRef(initialDraft);
  const unsaved = useRef(false); // є правки, ще не відправлені на сервер
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inFlight = useRef<Promise<boolean> | null>(null);

  // Відправляє останній стан чернетки; запити йдуть по черзі, щоб старіша відповідь не затерла новішу.
  const flush = useCallback(async (): Promise<boolean> => {
    clearTimeout(timer.current);
    for (;;) {
      // Запит уже летить (автозбереження): чекаємо його, а не відправляємо паралельно.
      if (inFlight.current) {
        if (!(await inFlight.current)) return false;
        continue;
      }
      if (!unsaved.current) {
        setSaveState("saved");
        return true;
      }

      unsaved.current = false;
      setSaveState("saving");
      const request = saveTemplateDraft(templateId, toContent(latest.current))
        .then((result) => {
          if (!result.ok) setSaveError(result.error);
          return result.ok;
        })
        .catch(() => {
          setSaveError(DRAFT_NOT_SAVED);
          return false;
        });
      inFlight.current = request;
      const ok = await request;
      if (inFlight.current === request) inFlight.current = null;

      if (!ok) {
        unsaved.current = true; // наступне редагування чи «Save version» спробує ще раз
        setSaveState("error");
        return false;
      }
      setSaveError(null);
      // Якщо за час запиту з'явились нові правки, цикл відправить їх наступним кроком.
    }
  }, [templateId]);

  // Вихід із редактора не губить правки (AC-EDITOR-01): незбережене відправляємо при розмонтуванні й закритті вкладки.
  useEffect(() => {
    const onHide = () => {
      if (unsaved.current) void flush();
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      onHide();
    };
  }, [flush]);

  function change(next: Draft) {
    latest.current = next;
    unsaved.current = true;
    setDraft(next);
    setDirty(true);
    setNotice(null);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), AUTOSAVE_DELAY_MS);
  }

  async function saveVersion() {
    setPublishing(true);
    setNotice(null);
    // Спершу чернетка: якщо версію відхилено (AC-EDITOR-04), шаблон лишає секції, задачі й «Unpublished changes».
    if (await flush()) {
      const result = await publishTemplate(templateId).catch(
        () => ({ ok: false, error: DRAFT_NOT_SAVED }) as const,
      );
      if (result.ok) {
        setDirty(unsaved.current);
        // «Version N saved» показує сторінка шаблону (AC-EDITOR-03)
        router.push(`/templates/${templateId}?saved=${result.version}`);
      } else {
        setNotice({ kind: "error", text: result.error });
      }
    }
    setPublishing(false);
  }

  function confirmRemoval() {
    if (!pendingRemoval) return;
    change(
      pendingRemoval.kind === "section"
        ? removeSection(draft, pendingRemoval.key)
        : removeTask(draft, pendingRemoval.key),
    );
    setPendingRemoval(null);
  }

  const sectionOptions = draft.map((section) => ({ value: section.key, label: section.name || "Untitled section" }));

  return (
    <>
      <Link href="/templates" className="text-sm text-muted-foreground underline">
        Templates
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{templateName}</h1>
        <p className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground" aria-live="polite">
          {dirty ? (
            <span data-testid="unpublished-changes">
              <StatusBadge status="unpublished" />
            </span>
          ) : null}
          <span
            data-testid="save-state"
            className={saveState === "error" ? "text-destructive" : undefined}
          >
            {saveState === "saving"
              ? "Saving…"
              : saveState === "saved"
                ? ALL_CHANGES_KEPT
                : saveState === "error"
                  ? (saveError ?? DRAFT_NOT_SAVED)
                  : null}
          </span>
        </p>
      </div>

      {notice ? (
        <Alert variant={notice.kind === "error" ? "destructive" : "default"}>
          <AlertDescription>{notice.text}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-4">
        {draft.map((section, sectionIndex) => (
          <Card key={section.key} className="flex-col gap-3 px-4 py-4">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex min-w-40 flex-1 flex-col gap-2">
                <Label htmlFor={`section-${section.key}`}>Section name</Label>
                <Input
                  id={`section-${section.key}`}
                  value={section.name}
                  onChange={(event) => change(renameSection(draft, section.key, event.target.value))}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={sectionIndex === 0}
                aria-label={`Move section ${section.name} up`}
                onClick={() => change(moveSection(draft, section.key, -1))}
              >
                Move up
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={sectionIndex === draft.length - 1}
                aria-label={`Move section ${section.name} down`}
                onClick={() => change(moveSection(draft, section.key, 1))}
              >
                Move down
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                aria-label={`Remove section ${section.name}`}
                onClick={() => setPendingRemoval({ kind: "section", key: section.key, name: section.name })}
              >
                Remove
              </Button>
            </div>

            <ul className="flex flex-col gap-3">
              {section.tasks.map((task, taskIndex) => (
                <li key={task.key} className="flex flex-wrap items-end gap-2 border-t pt-3">
                  <div className="flex min-w-40 flex-1 flex-col gap-2">
                    <Label htmlFor={`task-${task.key}`}>Task name</Label>
                    <Input
                      id={`task-${task.key}`}
                      value={task.name}
                      onChange={(event) => change(renameTask(draft, task.key, event.target.value))}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-pressed={task.required}
                    aria-label={`Task ${task.name} is ${task.required ? "required" : "optional"}. Change`}
                    onClick={() => change(setTaskRequired(draft, task.key, !task.required))}
                  >
                    {task.required ? "required" : "optional"}
                  </Button>
                  {draft.length > 1 ? (
                    <div className="w-44">
                      <AppSelect
                        aria-label={`Move task ${task.name} to section`}
                        options={sectionOptions}
                        value={sectionKeyOfTask(draft, task.key)}
                        onValueChange={(target) => change(moveTaskToSection(draft, task.key, target))}
                      />
                    </div>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={taskIndex === 0}
                    aria-label={`Move task ${task.name} up`}
                    onClick={() => change(moveTask(draft, task.key, -1))}
                  >
                    Move up
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={taskIndex === section.tasks.length - 1}
                    aria-label={`Move task ${task.name} down`}
                    onClick={() => change(moveTask(draft, task.key, 1))}
                  >
                    Move down
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    aria-label={`Remove task ${task.name}`}
                    onClick={() => setPendingRemoval({ kind: "task", key: task.key, name: task.name })}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => change(addTask(draft, section.key, crypto.randomUUID()))}
            >
              Add task
            </Button>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => change(addSection(draft, crypto.randomUUID()))}
        >
          Add section
        </Button>
        <Button type="button" disabled={publishing || !dirty} onClick={() => void saveVersion()}>
          Save version
        </Button>
        <Link href={`/templates/${templateId}/versions`} className="text-sm text-muted-foreground underline">
          Versions
        </Link>
      </div>

      <ConfirmDialog
        open={pendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemoval(null);
        }}
        title={pendingRemoval ? `Remove ${pendingRemoval.kind} “${pendingRemoval.name}”?` : "Remove"}
        confirmLabel="Confirm"
        destructive
        onConfirm={confirmRemoval}
      />
    </>
  );
}
