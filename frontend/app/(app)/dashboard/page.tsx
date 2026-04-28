"use client";

import { motion } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { dashboardStats, recentTransactions } from "@/lib/dummy-data";
import { formatRupiah } from "@/lib/formatRupiah";
import { cn } from "@/lib/cn";

const todayLabel = new Intl.DateTimeFormat("id-ID", {
	weekday: "long",
	day: "numeric",
	month: "long",
	year: "numeric",
}).format(new Date("2026-04-28"));

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

export default function DashboardPage() {
	return (
		<>
			<Header
				title="Dashboard"
				subtitle={`Selamat sore, Bagus — ${todayLabel}`}
				actions={
					<Button variant="secondary" size="sm">
						Export
					</Button>
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
					className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
				>
					<StatCard
						label="Net Worth"
						value={dashboardStats.netWorth}
						format="rupiah"
						delta={{ percent: dashboardStats.deltaNetWorth, direction: "up" }}
						subtext="vs bulan lalu"
					/>
					<StatCard
						label="Pemasukan Bulan Ini"
						value={dashboardStats.monthlyIncome}
						format="rupiah"
						delta={{ percent: dashboardStats.deltaIncome, direction: "up" }}
						subtext="April 2026"
					/>
					<StatCard
						label="Pengeluaran Bulan Ini"
						value={dashboardStats.monthlyExpense}
						format="rupiah"
						delta={{ percent: dashboardStats.deltaExpense, direction: "down" }}
						subtext="April 2026"
					/>
					<StatCard
						label="Savings Rate"
						value={dashboardStats.savingsRate}
						format="percent"
						delta={{ percent: dashboardStats.deltaSavings, direction: "up" }}
						subtext="vs target 40%"
					/>
				</motion.section>

				<motion.section variants={itemVariants}>
					<Card className="flex flex-col gap-6">
						<div className="flex items-baseline justify-between">
							<div className="flex flex-col gap-1">
								<span className="text-[11px] font-medium uppercase tracking-label text-gray-500">
									Cashflow 6 Bulan
								</span>
								<h2 className="font-serif text-2xl leading-none text-black">
									Pemasukan vs Pengeluaran
								</h2>
							</div>
							<div className="flex items-center gap-4 text-xs text-gray-500">
								<LegendDot variant="solid" label="Pemasukan" />
								<LegendDot variant="dashed" label="Pengeluaran" />
							</div>
						</div>
						{/* Placeholder chart area — chart library wire-up belum di scope phase ini. */}
						<div
							role="img"
							aria-label="Placeholder cashflow chart"
							className="relative h-72 w-full border border-dashed border-gray-300 bg-gray-50"
						>
							<div className="absolute inset-0 flex items-center justify-center">
								<span className="text-[11px] uppercase tracking-label text-gray-400">
									Chart placeholder
								</span>
							</div>
						</div>
					</Card>
				</motion.section>

				<motion.section variants={itemVariants}>
					<Card className="flex flex-col gap-0 p-0">
						<div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
							<div className="flex flex-col gap-1">
								<span className="text-[11px] font-medium uppercase tracking-label text-gray-500">
									Transaksi Terbaru
								</span>
								<h2 className="font-serif text-2xl leading-none text-black">
									5 transaksi terakhir
								</h2>
							</div>
							<Button variant="ghost" size="sm">
								Lihat semua →
							</Button>
						</div>
						<ul>
							{recentTransactions.map((tx) => (
								<TransactionRow key={tx.id} tx={tx} />
							))}
						</ul>
					</Card>
				</motion.section>
			</motion.div>
		</>
	);
}

function LegendDot({ variant, label }: { variant: "solid" | "dashed"; label: string }) {
	return (
		<span className="inline-flex items-center gap-2 font-mono">
			<span
				aria-hidden="true"
				className={cn(
					"h-px w-6",
					variant === "solid" ? "bg-black" : "border-t border-dashed border-black",
				)}
			/>
			<span>{label}</span>
		</span>
	);
}

function TransactionRow({ tx }: { tx: import("@/lib/dummy-data").DummyTransaction }) {
	const isIncome = tx.amount > 0;
	const dateLabel = new Intl.DateTimeFormat("id-ID", {
		day: "numeric",
		month: "short",
	}).format(new Date(tx.date));

	return (
		<li className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-gray-100 px-6 py-4 last:border-b-0 hover:bg-gray-50">
			<div className="flex min-w-0 flex-col gap-1">
				<span className="truncate text-sm font-medium text-black">{tx.merchant}</span>
				<span className="text-xs text-gray-500">
					{tx.category} · {tx.account} · {dateLabel}
				</span>
			</div>
			<span
				className={cn(
					"font-mono text-sm",
					isIncome ? "font-medium text-black" : "text-gray-600",
				)}
			>
				{isIncome ? "+" : ""}
				{formatRupiah(tx.amount)}
			</span>
		</li>
	);
}
