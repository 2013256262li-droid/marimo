/* Copyright 2026 Marimo. All rights reserved. */
"use no memo";

import type {
  ColumnFilter,
  ColumnFiltersState,
  Table,
} from "@tanstack/react-table";
import { Trash2Icon, XIcon } from "lucide-react";
import { type DateFormatter, useDateFormatter } from "react-aria";
import { logNever } from "@/utils/assertNever";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import type { ColumnFilterValue } from "./filters";
import { stringifyUnknownValue } from "./utils";

interface Props<TData> {
  filters: ColumnFiltersState | undefined;
  table: Table<TData>;
  onResetSearch?: () => void;
}

export const FilterPills = <TData,>({
  filters,
  table,
  onResetSearch,
}: Props<TData>) => {
  const timeFormatter = useDateFormatter({
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  if (!filters || filters.length === 0) {
    return null;
  }

  function renderFilterPill(filter: ColumnFilter) {
    const formattedValue = formatValue(
      filter.value as ColumnFilterValue,
      timeFormatter,
    );
    if (!formattedValue) {
      return null;
    }

    return (
      <Badge key={filter.id} variant="secondary" className="dark:invert">
        {filter.id} {formattedValue}{" "}
        <span
          className="cursor-pointer opacity-60 hover:opacity-100 pl-1 py-[2px]"
          onClick={() => {
            table.setColumnFilters((filters) =>
              filters.filter((f) => f.id !== filter.id),
            );
          }}
        >
          <XIcon className="w-3.5 h-3.5" />
        </span>
      </Badge>
    );
  }

  const handleClearAll = () => {
    table.setColumnFilters([]);
    onResetSearch?.();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 px-1">
      {filters.map(renderFilterPill)}
      {filters.length > 0 && (
        <Button
          variant="text"
          size="xs"
          className="h-5 text-xs text-muted-foreground hover:text-foreground gap-1"
          onClick={handleClearAll}
          title={onResetSearch ? "Reset all filters and search" : "Clear all filters"}
        >
          <Trash2Icon className="w-3 h-3" />
          {onResetSearch ? "Reset all" : "Clear all"}
        </Button>
      )}
    </div>
  );
};

function formatValue(value: ColumnFilterValue, timeFormatter: DateFormatter) {
  if (!("type" in value)) {
    return;
  }

  if (value.operator === "is_null") {
    return "is null";
  }
  if (value.operator === "is_not_null") {
    return "is not null";
  }

  if (value.type === "number") {
    return formatMinMax(value.min, value.max);
  }
  if (value.type === "date") {
    return formatMinMax(value.min?.toISOString(), value.max?.toISOString());
  }
  if (value.type === "time") {
    return formatMinMax(
      value.min ? timeFormatter.format(value.min) : undefined,
      value.max ? timeFormatter.format(value.max) : undefined,
    );
  }
  if (value.type === "datetime") {
    return formatMinMax(value.min?.toISOString(), value.max?.toISOString());
  }
  if (value.type === "boolean") {
    return `is ${value.value ? "True" : "False"}`;
  }
  if (value.type === "select") {
    const stringifiedOptions = value.options.map((o) =>
      stringifyUnknownValue({ value: o }),
    );
    const operator = value.operator === "in" ? "is in" : "not in";
    return `${operator} [${stringifiedOptions.join(", ")}]`;
  }
  if (value.type === "text") {
    return `contains "${value.text}"`;
  }
  logNever(value);
  return undefined;
}

function formatMinMax(
  min: string | number | undefined,
  max: string | number | undefined,
) {
  if (min === undefined && max === undefined) {
    return;
  }
  if (min === max) {
    return `== ${min}`;
  }
  if (min === undefined) {
    return `<= ${max}`;
  }
  if (max === undefined) {
    return `>= ${min}`;
  }
  return `${min} - ${max}`;
}
