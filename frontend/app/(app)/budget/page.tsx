"use client";

import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { dummyBudgets, dummyBudgetSummary, type DummyBudget } from "@/lib/dummy-data";
import { formatRupiah } from "@/lib/formatRupiah";
import { cn } from "@/lib/cn";

const easeExpo = [0.16, 1, 0.3, 1] as const;

const containerVariants = {
	hidden: {},
	show: {
		transition: { staggerChildren: 0.05 },
	},
};

const itemVariants = {
	hidden: { opacity: 0, y: 16 },
	show: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.3, ease: easeExpo },
	},
};

export default function BudgetPage() {
	const overBudget = dummyBudgetSummary.totalSpent > dummyBudgetSummary.totalBudget;

	return (
		<>
			<Header
				title="Anggaran"
				subtitle="Rencana pengeluaran bulanan per kategori"
				actions={
					<div className="flex items-center gap-2">
						<MonthSelector />
						<Button variant="primary" size="sm">
							<Plus className="h-4 w-4" strokeWidth={1.5} />
							Tambah Budget
						</Button>
					</div>
				}
			/>

			<motion.div
				className="flex flex-col gap-8 px-8 py-8"
				variants={containerVariants}
				initial="hidden"
				animate="show"
			>
				<motion.section
					variants={itemVariants}
					className="grid grid-cols-1 gap-4 md:grid-cols-3"
				>
					<StatCard
						label="Total Budget"
						value={dummyBudgetSummary.totalBudget}
						format="rupiah"
						subtext="April 2026"
					/>
					<StatCard
						label="Total Terpakai"
						value={dummyBudgetSummary.totalSpent}
						format="rupiah"
						subtext={`${((dummyBudgetSummary.totalSpent / dummyBudgetSummary.totalBudget) * 100).toFixed(0)}% dari budget`}
					/>
					<StatCard
						label="Sisa"
						value={Math.abs(dummyBudgetSummary.remaining)}
						format="rupiah"
						valueOverride={
							<RemainingValue
								remaining={dummyBudgetSummary.remaining}
								overBudget={overBudget}
							/>
						}
						subtext={overBudget ? "Melebihi anggaran" : "Tersisa untuk bulan ini"}
					/>
				</motion.section>

				<motion.section variants={itemVariants} className="flex flex-col gap-4">
					<div className="flex items-end justify-between">
						<div className="flex flex-col gap-1">
							<span className="text-[11px] font-medium uppercase tracking-label text-gray-500">
								Per Kategori
							</span>
							<h2 className="font-serif text-2xl leading-none text-black">
								Rincian anggaran
							</h2>
						</div>
						<span className="text-xs text-gray-500">
							{dummyBudgets.length} kategori aktif
						</span>
					</div>
					<Card className="flex flex-col gap-0 p-0">
						{dummyBudgets.map((budget, idx) => (
							<BudgetRow
								key={budget.id}
								budget={budget}
								isLast={idx === dummyBudgets.length - 1}
							/>
						))}
					</Card>
				</motion.section>
			</motion.div>
		</>
	);
}

function MonthSelector() {
	return (
		<button
			type="button"
			className={cn(
				"flex h-9 items-center gap-2 rounded border border-gray-300 bg-white px-3",
				"text-sm text-black",
				"transition-colors duration-150 ease-out hover:border-black",
			)}
		>
			<span className="font-mono">April 2026</span>
			<span aria-hidden="true" className="text-gray-400">
				▾
			</span>
		</button>
	);
}

function RemainingValue({
	remaining,
	overBudget,
}: {
	remaining: number;
	overBudget: boolean;
}) {
	// StatCard wraps this in font-mono text-4xl font-light by default — di sini cuma override warna.
	return (
		<span className={cn(overBudget ? "text-red-700" : "text-black")}>
			{overBudget ? "-" : ""}
			{formatRupiah(Math.abs(remaining))}
		</span>
	);
}

function BudgetRow({ budget, isLast }: { budget: DummyBudget; isLast: boolean }) {
	const percent = (budget.spent / budget.limit) * 100;
	const isOver = budget.spent > budget.limit;
	const isNearLimit = !isOver && percent >= 90;

	return (
		<div
			className={cn(
				"flex flex-col gap-3 px-6 py-5",
				!isLast && "border-b border-gray-100",
			)}
		>
			<div className="flex items-baseline justify-between gap-4">
				<div className="flex items-center gap-3">
					<span className="text-sm font-medium text-black">{budget.category}</span>
					{isOver && (
						<Badge variant="danger" size="sm">
							Over budget
						</Badge>
					)}
					{isNearLimit && (
						<Badge variant="warning" size="sm">
							Hampir habis
						</Badge>
					)}
				</div>
				<div className="flex items-baseline gap-2">
					<span
						className={cn(
							"font-mono text-sm font-medium",
							isOver ? "text-red-700" : "text-black",
						)}
					>
						{formatRupiah(budget.spent)}
					</span>
					<span className="font-mono text-xs text-gray-500">
						/ {formatRupiah(budget.limit)}
					</span>
				</div>
			</div>
			<ProgressBar
				value={budget.spent}
				max={budget.limit}
				height="md"
				overBudget={isOver}
				aria-label={`${budget.category} budget progress`}
			/>
			<div className="flex items-center justify-between text-[11px] text-gray-500">
				<span className="font-mono">
					{percent.toFixed(0)}% terpakai
				</span>
				<span className="font-mono">
					{isOver ? (
						<span className="text-red-700">
							-{formatRupiah(budget.spent - budget.limit)} melebihi
						</span>
					) : (
						<>Sisa {formatRupiah(budget.limit - budget.spent)}</>
					)}
				</span>
			</div>
		</div>
	);
}
