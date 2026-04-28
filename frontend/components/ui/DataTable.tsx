"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Skeleton } from "./Skeleton";

export type ColumnAlign = "left" | "right" | "center";

export interface DataTableColumn<T> {
	key: string;
	header: ReactNode;
	// Custom renderer per cell. Kalau nggak ada, fallback ke `row[key]` as string.
	render?: (row: T, rowIndex: number) => ReactNode;
	align?: ColumnAlign;
	// Width hint via Tailwind class (mis. "w-24") atau CSS string.
	width?: string;
	// Hint header buat sortable; logic-nya nggak diimplementasi di phase ini.
	sortable?: boolean;
	// Apply font-mono to all cells in this column (for numeric cols).
	mono?: boolean;
}

interface DataTableProps<T> {
	columns: DataTableColumn<T>[];
	data: T[];
	// Optional: handler klik baris.
	onRowClick?: (row: T, rowIndex: number) => void;
	// Render skeleton rows kalau lagi loading.
	loading?: boolean;
	loadingRows?: number;
	// Sort hooks — disiapkan biar nggak refactor besar nanti.
	sortKey?: string;
	sortDirection?: "asc" | "desc";
	onSort?: (key: string) => void;
	// Empty-state custom node.
	emptyState?: ReactNode;
	className?: string;
	// Extract key buat React.
	getRowKey?: (row: T, rowIndex: number) => string;
	// Sticky header (default false — mengikuti design hub Aset/Transaksi yg bukan sticky).
	stickyHeader?: boolean;
	// Footer row (mis. summary "Total saham · 5 ticker").
	footer?: ReactNode;
	// Min width — utk responsive overflow.
	minWidth?: string;
	// Header background — design hub pakai gray-50 bg di thead.
	headerTone?: "white" | "gray";
}

const alignClasses: Record<ColumnAlign, string> = {
	left: "text-left",
	right: "text-right",
	center: "text-center",
};

// Generic, type-safe table — sharp corners, monochrome borders, compact rows
// sesuai design hub. Hover row gray-50, no row borders dlm baris (cuma divider tipis).
export function DataTable<T>({
	columns,
	data,
	onRowClick,
	loading = false,
	loadingRows = 6,
	sortKey,
	sortDirection,
	onSort,
	emptyState,
	className,
	getRowKey,
	stickyHeader = false,
	footer,
	minWidth = "760px",
	headerTone = "gray",
}: DataTableProps<T>) {
	const showEmpty = !loading && data.length === 0;

	return (
		<div className={cn("w-full overflow-x-auto border border-gray-200 bg-white", className)}>
			<table className="w-full border-collapse text-[13px]" style={{ minWidth }}>
				<thead
					className={cn(
						headerTone === "gray" ? "bg-gray-50" : "bg-white",
						stickyHeader && "sticky top-0 z-[1]",
					)}
				>
					<tr className="border-b border-gray-200">
						{columns.map((col) => {
							const align = col.align ?? "left";
							const isSorted = sortKey === col.key;
							const arrow = isSorted ? (sortDirection === "desc" ? "↓" : "↑") : null;
							const sortable = col.sortable && onSort;

							return (
								<th
									key={col.key}
									scope="col"
									style={col.width ? { width: col.width } : undefined}
									className={cn(
										"whitespace-nowrap px-4 py-3.5 text-[11px] font-medium uppercase tracking-label text-gray-400",
										alignClasses[align],
										sortable && "cursor-pointer select-none hover:text-gray-950",
									)}
									onClick={sortable ? () => onSort?.(col.key) : undefined}
								>
									<span className="inline-flex items-center gap-1">
										{col.header}
										{arrow && <span aria-hidden="true">{arrow}</span>}
									</span>
								</th>
							);
						})}
					</tr>
				</thead>
				<tbody>
					{loading &&
						Array.from({ length: loadingRows }).map((_, i) => (
							<tr key={`skeleton-${i}`} className="border-b border-gray-100 last:border-b-0">
								{columns.map((col) => (
									<td key={col.key} className="h-12 px-4 py-3.5">
										<Skeleton variant="text" height={12} />
									</td>
								))}
							</tr>
						))}

					{!loading &&
						data.map((row, rowIndex) => {
							const key = getRowKey ? getRowKey(row, rowIndex) : String(rowIndex);
							const clickable = Boolean(onRowClick);
							return (
								<tr
									key={key}
									onClick={clickable ? () => onRowClick?.(row, rowIndex) : undefined}
									className={cn(
										"border-b border-gray-100 last:border-b-0",
										"transition-colors duration-150 ease-designhub",
										clickable && "cursor-pointer hover:bg-gray-50",
										!clickable && "hover:bg-gray-50",
									)}
								>
									{columns.map((col) => {
										const align = col.align ?? "left";
										const value = col.render
											? col.render(row, rowIndex)
											: renderFallback(row, col.key);
										return (
											<td
												key={col.key}
												className={cn(
													"px-4 py-3.5 align-middle text-[13px] text-gray-950",
													alignClasses[align],
													col.mono && "font-mono tabular-nums",
												)}
											>
												{value}
											</td>
										);
									})}
								</tr>
							);
						})}

					{showEmpty && (
						<tr>
							<td
								colSpan={columns.length}
								className="px-4 py-16 text-center text-sm text-gray-500"
							>
								{emptyState ?? <DefaultEmptyState />}
							</td>
						</tr>
					)}
				</tbody>
				{footer && (
					<tfoot>
						<tr className="border-t border-gray-200 bg-gray-50 text-[13px] font-medium text-gray-950">
							{footer}
						</tr>
					</tfoot>
				)}
			</table>
		</div>
	);
}

function renderFallback<T>(row: T, key: string): ReactNode {
	const value = (row as Record<string, unknown>)[key];
	if (value === null || value === undefined) return "—";
	if (typeof value === "string" || typeof value === "number") return value;
	return String(value);
}

function DefaultEmptyState() {
	return (
		<div className="flex flex-col items-center gap-2 py-4">
			<span className="text-[11px] uppercase tracking-label text-gray-400">No data</span>
			<span className="text-xs text-gray-500">Belum ada data untuk ditampilkan.</span>
		</div>
	);
}
