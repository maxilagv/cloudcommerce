"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { Skeleton } from "../primitives/skeleton.js";

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  /** Row click handler (e.g. navigate to detail). */
  onRowClick?: (row: TData) => void;
  loading?: boolean;
  /** Rendered when data is empty and not loading. */
  emptyState?: ReactNode;
  /** Number of skeleton rows while loading. */
  skeletonRows?: number;
}

export function DataTable<TData>({
  columns,
  data,
  onRowClick,
  loading = false,
  emptyState,
  skeletonRows = 6,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const colCount = columns.length;

  return (
    <div className="ui-table-scroll">
      <table className="ui-table">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sorted = header.column.getIsSorted();
                return (
                  <th key={header.id} className={cn(canSort && "ui-table__sortable")}>
                    {header.isPlaceholder ? null : (
                      <span
                        className="ui-table__th"
                        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort &&
                          (sorted === "asc" ? (
                            <ArrowUp size={12} />
                          ) : sorted === "desc" ? (
                            <ArrowDown size={12} />
                          ) : (
                            <ChevronsUpDown size={12} className="ui-table__sorticon" />
                          ))}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: skeletonRows }).map((_, i) => (
              <tr key={`sk-${i}`}>
                {Array.from({ length: colCount }).map((__, j) => (
                  <td key={j}>
                    <Skeleton height={12} width={j === 0 ? "70%" : "45%"} />
                  </td>
                ))}
              </tr>
            ))
          ) : table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={colCount}>
                <div className="ui-table__empty">{emptyState ?? "Sin resultados"}</div>
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={cn(onRowClick && "ui-table__row--click")}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export type { ColumnDef } from "@tanstack/react-table";
