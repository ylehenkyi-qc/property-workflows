"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type AppSelectOption = { value: string; label: string };

// Випадний список у стилі застосунку: список малює компонент (токени, тема, фокус, клавіатура), а не ОС. Нативний
// <select> заборонено (DESIGN.md, розділ 5; ESLint no-restricted-syntax). Бере участь у формі через name.
export function AppSelect({
  id,
  name,
  options,
  defaultValue,
  placeholder,
  className,
}: {
  id?: string;
  name: string;
  options: readonly AppSelectOption[];
  defaultValue?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Select name={name} items={[...options]} defaultValue={defaultValue ?? null}>
      <SelectTrigger id={id} className={cn("w-full", className)}>
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
