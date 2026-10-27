"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type AppSelectOption = { value: string; label: string };

// Випадний список у стилі застосунку: список малює компонент (токени, тема, фокус, клавіатура), а не ОС. Нативний
// <select> заборонено (DESIGN.md, розділ 5; ESLint no-restricted-syntax). У формі бере участь через name; у клієнтському
// компоненті можна керувати значенням через value + onValueChange.
export function AppSelect({
  id,
  name,
  options,
  defaultValue,
  value,
  onValueChange,
  placeholder,
  className,
  "aria-label": ariaLabel,
}: {
  id?: string;
  name?: string;
  options: readonly AppSelectOption[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <Select
      name={name}
      items={[...options]}
      {...(value !== undefined ? { value } : { defaultValue: defaultValue ?? null })}
      onValueChange={(next) => {
        if (next != null) onValueChange?.(next);
      }}
    >
      <SelectTrigger id={id} aria-label={ariaLabel} className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
