"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"

// Вибір файла без системного віджета: видима кнопка в темі, а нативне поле файлу сховане всередині цього компонента
// (DESIGN.md, розділ 5; ESLint дозволяє input type=file лише в src/components/ui). Тип і розширення перевіряє викликач.
function FileButton({
  children,
  accept,
  onFile,
  disabled,
}: {
  children: React.ReactNode
  accept?: string
  onFile: (file: File) => void
  disabled?: boolean
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  return (
    <>
      <Button type="button" variant="outline" disabled={disabled} onClick={() => inputRef.current?.click()}>
        {children}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = "" // той самий файл можна вибрати ще раз
          if (file) onFile(file)
        }}
      />
    </>
  )
}

export { FileButton }
