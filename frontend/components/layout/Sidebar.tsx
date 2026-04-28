"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";

interface NavItem {
	href: string;
	label: string;
	icon: (props: { className?: string }) => JSX.Element;
	badge?: string;
}

// Inline SVG icons (mirroring design hub paths exactly).
const DashboardIcon = ({ className }: { className?: string }) => (
	<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
		<rect x="3" y="3" width="7" height="9" rx="1" />
		<rect x="14" y="3" width="7" height="5" rx="1" />
		<rect x="14" y="12" width="7" height="9" rx="1" />
		<rect x="3" y="16" width="7" height="5" rx="1" />
	</svg>
);
const TxIcon = ({ className }: { className?: string }) => (
	<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
		<path d="M8 3L4 7l4 4" />
		<path d="M4 7h16" />
		<path d="M16 21l4-4-4-4" />
		<path d="M20 17H4" />
	</svg>
);
const PieIcon = ({ className }: { className?: string }) => (
	<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
		<path d="M21 12A9 9 0 1 1 12 3v9z" />
		<path d="M21 12A9 9 0 0 0 12 3v9z" fill="currentColor" fillOpacity=".15" />
	</svg>
);
const TargetIcon = ({ className }: { className?: string }) => (
	<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
		<circle cx="12" cy="12" r="9" />
		<circle cx="12" cy="12" r="5" />
		<circle cx="12" cy="12" r="1.5" />
	</svg>
);
const UploadIcon = ({ className }: { className?: string }) => (
	<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
		<path d="M12 4v12" />
		<path d="M7 9l5-5 5 5" />
		<path d="M5 20h14" />
	</svg>
);
const ChatIcon = ({ className }: { className?: string }) => (
	<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
		<path d="M21 11.5a8.5 8.5 0 1 1-3.4-6.8L21 4l-1 3.5A8.5 8.5 0 0 1 21 11.5z" />
	</svg>
);
const SettingsIcon = ({ className }: { className?: string }) => (
	<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
		<circle cx="12" cy="12" r="3" />
		<path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8 2 2 0 1 1-2.8 2.8 1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5 2 2 0 1 1-4 0 1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3 2 2 0 1 1-2.8-2.8 1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1 2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8 2 2 0 1 1 2.8-2.8 1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5 2 2 0 1 1 4 0 1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3 2 2 0 1 1 2.8 2.8 1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1 2 2 0 1 1 0 4 1.7 1.7 0 0 0-1.5 1z" />
	</svg>
);
const ToggleIcon = ({ className }: { className?: string }) => (
	<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
		<rect x="3" y="4" width="18" height="16" rx="2" />
		<path d="M9 4v16" />
	</svg>
);

const navItems: NavItem[] = [
	{ href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
	{ href: "/transactions", label: "Transaksi", icon: TxIcon, badge: "12" },
	{ href: "/assets", label: "Aset & Portofolio", icon: PieIcon },
	{ href: "/budget", label: "Anggaran", icon: TargetIcon },
	{ href: "/import", label: "Import Data", icon: UploadIcon },
	{ href: "/chat", label: "Chat AI", icon: ChatIcon },
];

interface SidebarProps {
	collapsed: boolean;
	onToggle: () => void;
}

// Sidebar mengikuti spec design hub: 240px collapsible ke 64px, border-left 2px hitam saat active.
export function Sidebar({ collapsed, onToggle }: SidebarProps) {
	const pathname = usePathname();

	return (
		<aside
			className={cn(
				"sticky top-0 flex h-screen shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-white",
				"transition-[width] duration-[350ms] ease-designhub",
				collapsed ? "w-[64px]" : "w-[240px]",
			)}
		>
			{/* TOP */}
			<div className="flex h-16 items-center justify-between border-b border-gray-200 px-5">
				<Link href="/dashboard" className="inline-flex items-center gap-2 whitespace-nowrap font-serif text-[20px] leading-none text-gray-950">
					<span aria-hidden className="relative inline-block h-5 w-5 flex-none rounded-full bg-gray-950 after:absolute after:inset-[5px] after:rounded-full after:bg-white after:content-['']" />
					<span
						className={cn(
							"overflow-hidden transition-[opacity,max-width] duration-[350ms] ease-designhub",
							collapsed ? "max-w-0 opacity-0" : "max-w-[120px] opacity-100",
						)}
					>
						FinanceAI
					</span>
				</Link>
				{!collapsed && (
					<button
						type="button"
						onClick={onToggle}
						aria-label="Toggle sidebar"
						className="grid h-7 w-7 place-items-center rounded-md text-gray-500 transition-colors duration-150 ease-designhub hover:bg-gray-100 hover:text-gray-950"
					>
						<ToggleIcon className="h-4 w-4" />
					</button>
				)}
			</div>

			{/* NAV */}
			<nav className="flex flex-1 flex-col gap-0.5 px-3 py-3.5">
				<div
					className={cn(
						"px-3 py-1.5 pt-2.5 font-mono text-[10px] font-medium uppercase tracking-labelWide text-gray-400",
						collapsed && "h-0 overflow-hidden p-0 opacity-0",
					)}
				>
					Menu
				</div>
				{navItems.map((item) => {
					const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
					return (
						<SidebarLink key={item.href} item={item} active={active} collapsed={collapsed} />
					);
				})}
			</nav>

			{/* BOTTOM */}
			<div className="flex flex-col gap-1.5 border-t border-gray-200 px-3 py-3.5">
				<SidebarLink
					item={{ href: "/settings", label: "Pengaturan", icon: SettingsIcon }}
					active={pathname.startsWith("/settings")}
					collapsed={collapsed}
					noBorder
				/>
				<UserPill collapsed={collapsed} />
				{collapsed && (
					<button
						type="button"
						onClick={onToggle}
						aria-label="Expand sidebar"
						className="mx-auto mt-1 grid h-7 w-7 place-items-center rounded-md text-gray-500 transition-colors duration-150 ease-designhub hover:bg-gray-100 hover:text-gray-950"
					>
						<ToggleIcon className="h-4 w-4" />
					</button>
				)}
			</div>
		</aside>
	);
}

function SidebarLink({
	item,
	active,
	collapsed,
	noBorder,
}: {
	item: NavItem;
	active: boolean;
	collapsed: boolean;
	noBorder?: boolean;
}) {
	const Icon = item.icon;
	return (
		<Link
			href={item.href}
			className={cn(
				"relative flex h-[38px] items-center gap-3 whitespace-nowrap text-sm",
				"transition-[background-color,color,border-color] duration-200 ease-designhub",
				collapsed ? "justify-center px-0" : "px-3",
				noBorder ? "border-l-2 border-transparent" : "border-l-2 border-transparent",
				active
					? "bg-gray-50 font-medium text-gray-950 rounded-r-lg" + (noBorder ? "" : " border-l-gray-950")
					: "text-gray-500 hover:bg-gray-50 hover:text-gray-900 rounded-lg",
			)}
		>
			<Icon className="h-[18px] w-[18px] flex-none" />
			{!collapsed && (
				<>
					<span className="flex-1 transition-opacity duration-200 ease-designhub">{item.label}</span>
					{item.badge && (
						<span className="ml-auto rounded-full bg-gray-950 px-1.5 py-0.5 font-mono text-[10px] font-medium text-white">
							{item.badge}
						</span>
					)}
				</>
			)}
		</Link>
	);
}

function UserPill({ collapsed }: { collapsed: boolean }) {
	const name = "Bagus Deva";
	const email = "bagus@constructland.com";
	const initial = name.charAt(0).toUpperCase();

	return (
		<div
			className={cn(
				"flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors duration-200 ease-designhub hover:bg-gray-50",
				collapsed && "justify-center px-0",
			)}
		>
			<div
				aria-hidden
				className="grid h-8 w-8 flex-none place-items-center rounded-full font-serif text-sm text-white"
				style={{ background: "linear-gradient(135deg,#1a1a1a,#525252)" }}
			>
				{initial}
			</div>
			{!collapsed && (
				<div className="min-w-0">
					<div className="truncate text-[13px] font-medium leading-tight text-gray-950">{name}</div>
					<div className="truncate text-[11px] leading-tight text-gray-500">{email}</div>
				</div>
			)}
		</div>
	);
}

// Stateful wrapper buat dipakai di layout — manage collapsed state.
export function SidebarShell() {
	const [collapsed, setCollapsed] = useState(false);
	return <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />;
}
