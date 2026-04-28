"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	LayoutDashboard,
	ArrowLeftRight,
	PieChart,
	Target,
	Upload,
	MessageSquare,
	Settings,
	type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

interface NavItem {
	href: string;
	label: string;
	icon: LucideIcon;
}

const navItems: NavItem[] = [
	{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
	{ href: "/transactions", label: "Transaksi", icon: ArrowLeftRight },
	{ href: "/assets", label: "Aset & Portofolio", icon: PieChart },
	{ href: "/budget", label: "Anggaran", icon: Target },
	{ href: "/import", label: "Import Data", icon: Upload },
	{ href: "/chat", label: "Chat AI", icon: MessageSquare },
];

export function Sidebar() {
	const pathname = usePathname();

	return (
		<aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-gray-200 bg-white">
			<div className="px-6 py-6">
				<Link href="/dashboard" className="font-serif text-[20px] leading-none text-black">
					FinanceAI
				</Link>
			</div>

			<div className="border-b border-gray-200" />

			<nav className="flex flex-1 flex-col gap-1 px-3 py-4">
				{navItems.map((item) => {
					const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
					return <SidebarLink key={item.href} item={item} active={active} />;
				})}
			</nav>

			<div className="border-t border-gray-200" />

			<div className="flex flex-col gap-1 px-3 py-4">
				<SidebarLink
					item={{ href: "/settings", label: "Pengaturan", icon: Settings }}
					active={pathname.startsWith("/settings")}
				/>
				<UserPill />
			</div>
		</aside>
	);
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
	const Icon = item.icon;
	return (
		<Link
			href={item.href}
			className={cn(
				"group relative flex h-10 items-center gap-3 px-4 text-sm transition-colors duration-150 ease-out",
				active
					? "text-black font-medium"
					: "text-gray-500 hover:text-gray-900",
			)}
		>
			{active && (
				<span
					aria-hidden="true"
					className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 bg-black"
				/>
			)}
			<Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
			<span>{item.label}</span>
		</Link>
	);
}

function UserPill() {
	// Placeholder — diisi dari auth/session store nanti.
	const name = "Bagus Deva";
	const email = "bagus@constructland.com";
	const initial = name.charAt(0).toUpperCase();

	return (
		<div className="mt-2 flex items-center gap-3 px-4 py-3">
			<div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-700">
				{initial}
			</div>
			<div className="min-w-0 flex-1">
				<div className="truncate text-xs font-medium text-black">{name}</div>
				<div className="truncate text-[11px] text-gray-500">{email}</div>
			</div>
		</div>
	);
}
