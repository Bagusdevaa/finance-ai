"use client";

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSidebar } from "@/components/layout/Sidebar";
import { cn } from "@/lib/cn";

const easeDesignhub = [0.2, 0.7, 0.2, 1] as const;

type SectionId = "profil" | "security" | "notif" | "kategori" | "data" | "tampilan" | "danger";

interface NavItem {
	id: SectionId;
	label: string;
	icon: ReactNode;
	danger?: boolean;
}

const NAV_ITEMS: NavItem[] = [
	{ id: "profil", label: "Profil", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg> },
	{ id: "security", label: "Akun & Keamanan", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg> },
	{ id: "notif", label: "Notifikasi", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg> },
	{ id: "kategori", label: "Kategori", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg> },
	{ id: "data", label: "Data & Privacy", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg> },
	{ id: "tampilan", label: "Tampilan", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /></svg> },
	{ id: "danger", label: "Danger Zone", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>, danger: true },
];

const ACCOUNT_GROUP: SectionId[] = ["profil", "security", "notif"];
const CONTENT_GROUP: SectionId[] = ["kategori", "data", "tampilan"];

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
	return (
		<button
			type="button"
			onClick={onToggle}
			className={cn(
				"relative h-[22px] w-[38px] shrink-0 rounded-full transition-[background-color] duration-[250ms] ease-designhub",
				on ? "bg-gray-950" : "bg-gray-300",
			)}
		>
			<span
				className={cn(
					"absolute top-[2px] left-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform duration-[250ms] ease-designhub",
					on && "translate-x-4",
				)}
			/>
		</button>
	);
}

function ToggleRow({ title, subtitle, defaultOn }: { title: string; subtitle: string; defaultOn?: boolean }) {
	const [on, setOn] = useState(defaultOn ?? false);
	return (
		<div className="flex items-start justify-between gap-4 border-b border-gray-100 py-3.5 last:border-b-0">
			<div>
				<div className="text-sm font-medium text-gray-950">{title}</div>
				<div className="mt-0.5 text-[12.5px] text-gray-500">{subtitle}</div>
			</div>
			<Toggle on={on} onToggle={() => setOn(!on)} />
		</div>
	);
}

function Card({ header, children, footer, danger }: { header?: ReactNode; children: ReactNode; footer?: ReactNode; danger?: boolean }) {
	return (
		<div className={cn("mb-5 border bg-white", danger ? "border-[#dc2626] bg-[#fdf6f6]" : "border-gray-200")}>
			{header && (
				<div className={cn("flex items-center justify-between border-b px-[22px] py-4 text-sm font-medium text-gray-950", danger ? "border-[#dc2626] bg-[#fff7f7] text-[#dc2626]" : "border-gray-200")}>
					{header}
				</div>
			)}
			<div className={cn("px-[22px] py-[22px]", danger && "text-gray-700")}>{children}</div>
			{footer && (
				<div className={cn("flex items-center justify-between gap-2.5 border-t px-[22px] py-3.5", danger ? "border-[#dc2626] bg-[#fdf6f6]" : "border-gray-200 bg-gray-50")}>
					{footer}
				</div>
			)}
		</div>
	);
}

function FieldLabel({ children }: { children: ReactNode }) {
	return <label className="mb-2 block text-[11px] font-medium uppercase tracking-label text-gray-500">{children}</label>;
}

function TextInput({ type = "text", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
	return (
		<input
			type={type}
			{...props}
			className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-[13px] text-gray-950 outline-none transition-[border-color] duration-200 focus:border-gray-950"
		/>
	);
}

function SelectInput({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
	return (
		<select
			{...props}
			className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-[13px] text-gray-950 outline-none transition-[border-color] duration-200 focus:border-gray-950"
		>
			{children}
		</select>
	);
}

const fadeVariants = {
	hidden: { opacity: 0, y: 8 },
	show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: easeDesignhub } },
};

const EXPENSE_CATEGORIES = [
	{ initial: "M", name: "Makanan", budget: "Rp 1.500.000 / bulan" },
	{ initial: "T", name: "Transportasi", budget: "Rp 800.000 / bulan" },
	{ initial: "B", name: "Belanja", budget: "Rp 600.000 / bulan" },
	{ initial: "G", name: "Tagihan", budget: "Rp 500.000 / bulan" },
	{ initial: "H", name: "Hiburan", budget: "Rp 200.000 / bulan" },
];

const CONNECTED_ACCOUNTS = [
	{ logo: "B", name: "BCA Tahapan ****7823", sub: "PDF Mutasi · Sinkron 3 menit lalu", active: true },
	{ logo: "S", name: "Stockbit", sub: "Screenshot · Sinkron 1 jam lalu", active: true },
	{ logo: "b", name: "Bibit", sub: "CSV · Sinkron 2 hari lalu", active: true },
];

function SettingsMobileMenuButton() {
	const { setMobileOpen } = useSidebar();
	return (
		<button
			type="button"
			onClick={() => setMobileOpen(true)}
			aria-label="Buka menu"
			className="mr-2 grid h-9 w-9 place-items-center rounded-lg text-gray-600 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-950 md:hidden"
		>
			<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
				<line x1="3" y1="6" x2="21" y2="6" />
				<line x1="3" y1="12" x2="21" y2="12" />
				<line x1="3" y1="18" x2="21" y2="18" />
			</svg>
		</button>
	);
}

export default function SettingsPage() {
	const [activeSection, setActiveSection] = useState<SectionId>("profil");
	const [theme, setTheme] = useState("light");
	const [showModal, setShowModal] = useState(false);
	const [confirmInput, setConfirmInput] = useState("");

	const renderNav = () => (
		<>
			<h3 className="mx-3 mb-2 font-mono text-[10px] font-medium uppercase tracking-labelWide text-gray-400 max-[880px]:hidden">Akun</h3>
			{NAV_ITEMS.filter((n) => ACCOUNT_GROUP.includes(n.id)).map((item) => (
				<button
					key={item.id}
					type="button"
					onClick={() => setActiveSection(item.id)}
					className={cn(
						"mb-0.5 flex w-full items-center gap-2.5 border-l-2 border-transparent px-3 py-[9px] text-left text-[13.5px] text-gray-600 transition-[background-color,color,border-color] duration-200",
						"rounded-r-lg max-[880px]:rounded-md max-[880px]:border-b-2 max-[880px]:border-l-0 max-[880px]:whitespace-nowrap",
						activeSection === item.id && "border-l-gray-950 bg-gray-50 font-medium text-gray-950 max-[880px]:border-b-gray-950 max-[880px]:border-l-0",
						activeSection !== item.id && "hover:bg-gray-50 hover:text-gray-950",
					)}
				>
					<span className="h-4 w-4 shrink-0">{item.icon}</span>
					{item.label}
				</button>
			))}

			<h3 className="mx-3 mb-2 mt-[18px] font-mono text-[10px] font-medium uppercase tracking-labelWide text-gray-400 max-[880px]:hidden">Konten</h3>
			{NAV_ITEMS.filter((n) => CONTENT_GROUP.includes(n.id)).map((item) => (
				<button
					key={item.id}
					type="button"
					onClick={() => setActiveSection(item.id)}
					className={cn(
						"mb-0.5 flex w-full items-center gap-2.5 border-l-2 border-transparent px-3 py-[9px] text-left text-[13.5px] text-gray-600 transition-[background-color,color,border-color] duration-200",
						"rounded-r-lg max-[880px]:rounded-md max-[880px]:border-b-2 max-[880px]:border-l-0 max-[880px]:whitespace-nowrap",
						activeSection === item.id && "border-l-gray-950 bg-gray-50 font-medium text-gray-950 max-[880px]:border-b-gray-950 max-[880px]:border-l-0",
						activeSection !== item.id && "hover:bg-gray-50 hover:text-gray-950",
					)}
				>
					<span className="h-4 w-4 shrink-0">{item.icon}</span>
					{item.label}
				</button>
			))}

			<div className="mt-[18px] border-t border-gray-200 pt-[18px] max-[880px]:mt-0 max-[880px]:border-t-0 max-[880px]:pt-0">
				<button
					type="button"
					onClick={() => setActiveSection("danger")}
					className={cn(
						"mb-0.5 flex w-full items-center gap-2.5 border-l-2 border-transparent px-3 py-[9px] text-left text-[13.5px] text-[#dc2626] transition-[background-color,color,border-color] duration-200",
						"rounded-r-lg max-[880px]:rounded-md max-[880px]:border-b-2 max-[880px]:border-l-0 max-[880px]:whitespace-nowrap",
						activeSection === "danger" && "border-l-[#dc2626] bg-[#fdf6f6] max-[880px]:border-b-[#dc2626] max-[880px]:border-l-0",
						activeSection !== "danger" && "hover:bg-[#fdf6f6]",
					)}
				>
					<span className="h-4 w-4 shrink-0">{NAV_ITEMS.find((n) => n.id === "danger")!.icon}</span>
					Danger Zone
				</button>
			</div>
		</>
	);

	return (
		<>
			{/* Header */}
			<header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-gray-200 bg-white/85 px-4 backdrop-blur-[14px] md:px-8">
				<div className="flex items-center">
					<SettingsMobileMenuButton />
					<h1 className="m-0 font-serif text-[24px] font-normal tracking-tight2 text-gray-950">Pengaturan</h1>
				</div>
			</header>

			<div className="grid flex-1 grid-cols-[240px_1fr] max-[1100px]:grid-cols-[200px_1fr] max-[880px]:grid-cols-[1fr]">
				{/* Settings nav */}
				<aside className="sticky top-16 h-[calc(100vh-64px)] overflow-y-auto border-r border-gray-200 bg-white px-3 py-6 max-[880px]:static max-[880px]:flex max-[880px]:h-auto max-[880px]:gap-1.5 max-[880px]:overflow-x-auto max-[880px]:border-b max-[880px]:border-r-0 max-[880px]:px-3 max-[880px]:py-3">
					{renderNav()}
				</aside>

				{/* Content pane */}
				<section className="max-w-[780px] overflow-y-auto px-4 py-6 pb-[60px] md:px-10 md:py-8 max-[1100px]:px-6 max-[1100px]:py-6">
					<AnimatePresence mode="wait">
						{/* Profil */}
						{activeSection === "profil" && (
							<motion.div key="profil" variants={fadeVariants} initial="hidden" animate="show">
								<h2 className="mb-1.5 font-serif text-[32px] font-normal tracking-tight2 text-gray-950">Profil</h2>
								<p className="mb-8 text-sm text-gray-500">Informasi pribadi yang ditampilkan di akun kamu.</p>

								<Card header="Foto profil">
									<div className="flex items-center gap-[18px]">
										<div className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-full font-serif text-[32px] text-white" style={{ background: "linear-gradient(135deg,#1a1a1a,#525252)" }}>
											B
										</div>
										<div>
											<div className="flex gap-2">
												<button type="button" className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-300 px-4 text-[13px] font-medium text-gray-700 transition-[background-color,border-color,color] duration-200 hover:border-gray-950 hover:bg-gray-50 hover:text-gray-950">Unggah foto</button>
												<button type="button" className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-300 px-4 text-[13px] font-medium text-gray-700 transition-[background-color,border-color,color] duration-200 hover:border-gray-950 hover:bg-gray-50 hover:text-gray-950">Hapus</button>
											</div>
											<div className="mt-2 font-mono text-[11px] text-gray-400">JPG atau PNG &middot; maks 2MB &middot; rasio 1:1</div>
										</div>
									</div>
								</Card>

								<Card
									header="Informasi dasar"
									footer={
										<>
											<div className="text-xs text-gray-500">Perubahan terakhir: 14 Feb 2026</div>
											<div className="flex gap-2">
												<button type="button" className="inline-flex h-9 items-center rounded-lg border border-gray-300 px-4 text-[13px] font-medium text-gray-700 hover:border-gray-950 hover:bg-gray-50 hover:text-gray-950">Batal</button>
												<button type="button" className="inline-flex h-9 items-center rounded-lg bg-gray-950 px-4 text-[13px] font-medium text-white hover:bg-black">Simpan profil</button>
											</div>
										</>
									}
								>
									<div className="grid grid-cols-2 gap-3.5 max-[880px]:grid-cols-1">
										<div><FieldLabel>Nama Lengkap</FieldLabel><TextInput defaultValue="Bagus Deva" /></div>
										<div><FieldLabel>Nama Panggilan</FieldLabel><TextInput defaultValue="Bagus" /></div>
									</div>
									<div className="mt-[18px]">
										<FieldLabel>Email</FieldLabel>
										<TextInput type="email" defaultValue="bagus@constructland.com" />
										<div className="mt-1.5 font-mono text-[11px] text-gray-400">Email digunakan untuk login dan notifikasi.</div>
									</div>
									<div className="mt-[18px] grid grid-cols-2 gap-3.5 max-[880px]:grid-cols-1">
										<div><FieldLabel>Nomor HP</FieldLabel><TextInput type="tel" defaultValue="+62 812 3456 7890" /></div>
										<div><FieldLabel>Tanggal Lahir</FieldLabel><TextInput defaultValue="14 Agustus 1995" /></div>
									</div>
									<div className="mt-[18px] grid grid-cols-2 gap-3.5 max-[880px]:grid-cols-1">
										<div><FieldLabel>Pekerjaan</FieldLabel><TextInput defaultValue="Software Engineer" /></div>
										<div>
											<FieldLabel>Mata Uang Utama</FieldLabel>
											<SelectInput>
												<option>IDR &middot; Rupiah</option>
												<option>USD &middot; Dollar AS</option>
												<option>SGD &middot; Dollar Singapura</option>
											</SelectInput>
										</div>
									</div>
								</Card>

								<Card
									header="Tujuan keuangan"
									footer={
										<>
											<div className="text-xs text-gray-500">Disinkronisasi ke widget Dashboard.</div>
											<button type="button" className="inline-flex h-9 items-center rounded-lg bg-gray-950 px-4 text-[13px] font-medium text-white hover:bg-black">Simpan tujuan</button>
										</>
									}
								>
									<div>
										<FieldLabel>Tujuan Utama</FieldLabel>
										<SelectInput defaultValue="Investasi jangka panjang">
											<option>Tabungan dana darurat</option>
											<option>Investasi jangka panjang</option>
											<option>Membeli rumah / properti</option>
											<option>Pensiun dini</option>
										</SelectInput>
									</div>
									<div className="mt-[18px]">
										<FieldLabel>Target tabungan bulanan (Rp)</FieldLabel>
										<TextInput defaultValue="3.000.000" />
										<div className="mt-1.5 font-mono text-[11px] text-gray-400">Saving rate kamu saat ini: 29% &middot; target: 35%</div>
									</div>
								</Card>
							</motion.div>
						)}

						{/* Security */}
						{activeSection === "security" && (
							<motion.div key="security" variants={fadeVariants} initial="hidden" animate="show">
								<h2 className="mb-1.5 font-serif text-[32px] font-normal tracking-tight2 text-gray-950">
									Akun &amp; <em className="italic text-gray-700">Keamanan</em>
								</h2>
								<p className="mb-8 text-sm text-gray-500">Kelola password, dua faktor, dan sesi aktif.</p>

								<Card
									header="Ganti password"
									footer={
										<>
											<div className="text-xs text-gray-500">Password terakhir diubah 2 bulan lalu</div>
											<button type="button" className="inline-flex h-9 items-center rounded-lg bg-gray-950 px-4 text-[13px] font-medium text-white hover:bg-black">Update password</button>
										</>
									}
								>
									<div>
										<FieldLabel>Password Saat Ini</FieldLabel>
										<TextInput type="password" placeholder="••••••••" />
									</div>
									<div className="mt-[18px] grid grid-cols-2 gap-3.5 max-[880px]:grid-cols-1">
										<div><FieldLabel>Password Baru</FieldLabel><TextInput type="password" placeholder="Minimal 8 karakter" /></div>
										<div><FieldLabel>Konfirmasi Password</FieldLabel><TextInput type="password" /></div>
									</div>
								</Card>

								<Card header="Two-factor authentication">
									<ToggleRow title="Google Authenticator" subtitle="Gunakan aplikasi authenticator untuk kode 6-digit setiap login." defaultOn />
									<ToggleRow title="SMS OTP" subtitle="Kode dikirim ke +62 812 ****7890. Kurang aman dibanding authenticator." />
									<div className="flex items-start justify-between gap-4 py-3.5">
										<div>
											<div className="text-sm font-medium text-gray-950">Backup codes</div>
											<div className="mt-0.5 text-[12.5px] text-gray-500">8 kode darurat untuk akses akun jika kehilangan handphone.</div>
										</div>
										<button type="button" className="inline-flex h-[30px] shrink-0 items-center rounded-lg border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:border-gray-950 hover:bg-gray-50 hover:text-gray-950">Lihat codes</button>
									</div>
								</Card>

								<Card
									header="Sesi aktif"
									footer={
										<>
											<div className="text-xs text-gray-500">2 perangkat aktif</div>
											<button type="button" className="inline-flex h-9 items-center rounded-lg border border-gray-300 px-4 text-[13px] font-medium text-gray-700 hover:border-gray-950 hover:bg-gray-50 hover:text-gray-950">Logout semua perangkat lain</button>
										</>
									}
								>
									<div className="flex items-center gap-3.5 border-b border-gray-100 py-3.5">
										<div className="grid h-[38px] w-[38px] shrink-0 place-items-center bg-gray-100 font-serif text-base text-gray-800">M</div>
										<div className="min-w-0 flex-1">
											<div className="text-sm font-medium text-gray-950">Mac &middot; Chrome 124</div>
											<div className="mt-0.5 font-mono text-[11px] text-gray-500">Jakarta &middot; 17 Feb 2026 &middot; 09:42</div>
										</div>
										<span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-gray-500">
											<span className="h-1.5 w-1.5 rounded-full bg-[#16a34a]" />Sekarang
										</span>
									</div>
									<div className="flex items-center gap-3.5 py-3.5">
										<div className="grid h-[38px] w-[38px] shrink-0 place-items-center bg-gray-100 font-serif text-base text-gray-800">i</div>
										<div className="min-w-0 flex-1">
											<div className="text-sm font-medium text-gray-950">iPhone 14 &middot; Safari</div>
											<div className="mt-0.5 font-mono text-[11px] text-gray-500">Jakarta &middot; 16 Feb 2026 &middot; 22:18</div>
										</div>
										<span className="mr-3.5 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-gray-500">
											<span className="h-1.5 w-1.5 rounded-full bg-gray-300" />Aktif
										</span>
										<button type="button" className="inline-flex h-[30px] shrink-0 items-center rounded-lg border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:border-gray-950 hover:bg-gray-50 hover:text-gray-950">Logout</button>
									</div>
								</Card>
							</motion.div>
						)}

						{/* Notifikasi */}
						{activeSection === "notif" && (
							<motion.div key="notif" variants={fadeVariants} initial="hidden" animate="show">
								<h2 className="mb-1.5 font-serif text-[32px] font-normal tracking-tight2 text-gray-950">Notifikasi</h2>
								<p className="mb-8 text-sm text-gray-500">Pilih mana yang penting buat kamu. Kami tidak akan kirim spam.</p>

								<Card
									header={
										<>
											Email
											<span className="font-mono text-[11px] font-normal uppercase tracking-[0.06em] text-gray-400">bagus@constructland.com</span>
										</>
									}
								>
									<ToggleRow title="Laporan bulanan" subtitle="Ringkasan keuangan setiap awal bulan, dikirim tanggal 1." defaultOn />
									<ToggleRow title="Alert overspend" subtitle="Saat pengeluaran kategori sudah lewat 80% anggaran." defaultOn />
									<ToggleRow title="Insight mingguan AI" subtitle="Pola yang menarik dari transaksi minggu lalu." />
									<ToggleRow title="Newsletter & tips" subtitle="Tips finansial dari tim editorial. 1x per minggu." />
								</Card>

								<Card header="Push (mobile)">
									<ToggleRow title="Transaksi besar" subtitle="Notifikasi langsung untuk transaksi > Rp 1.000.000." defaultOn />
									<ToggleRow title="Reminder anggaran" subtitle="Setiap Senin pagi · ringkasan minggu lalu." defaultOn />
									<ToggleRow title="Pasar saham" subtitle="Saat portofolio kamu naik / turun > 5% dalam sehari." />
								</Card>
							</motion.div>
						)}

						{/* Kategori */}
						{activeSection === "kategori" && (
							<motion.div key="kategori" variants={fadeVariants} initial="hidden" animate="show">
								<h2 className="mb-1.5 font-serif text-[32px] font-normal tracking-tight2 text-gray-950">Kategori</h2>
								<p className="mb-8 text-sm text-gray-500">Atur kategori yang dipakai AI saat klasifikasi otomatis transaksi kamu.</p>

								<Card
									header={
										<>
											Kategori Pengeluaran
											<button type="button" className="inline-flex h-[30px] items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:border-gray-950 hover:bg-gray-50 hover:text-gray-950">
												<svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
												Tambah
											</button>
										</>
									}
								>
									<div className="-mx-[22px]">
										{EXPENSE_CATEGORIES.map((cat) => (
											<div key={cat.name} className="flex items-center gap-3 border-b border-gray-100 px-[22px] py-3 text-[13.5px] last:border-b-0">
												<div className="grid h-[30px] w-[30px] shrink-0 place-items-center bg-gray-100 font-serif text-sm text-gray-700">{cat.initial}</div>
												<div className="flex-1 font-medium text-gray-950">{cat.name}</div>
												<div className="font-mono text-xs text-gray-500">{cat.budget}</div>
												<div className="flex gap-1">
													<button type="button" className="grid h-7 w-7 place-items-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-950" title="Edit">
														<svg className="h-[13px] w-[13px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
													</button>
													<button type="button" className="grid h-7 w-7 place-items-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-950" title="Hapus">
														<svg className="h-[13px] w-[13px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-2 14a2 2 0 01-2 2H9a2 2 0 01-2-2L5 6" /></svg>
													</button>
												</div>
											</div>
										))}
									</div>
								</Card>
							</motion.div>
						)}

						{/* Data & Privacy */}
						{activeSection === "data" && (
							<motion.div key="data" variants={fadeVariants} initial="hidden" animate="show">
								<h2 className="mb-1.5 font-serif text-[32px] font-normal tracking-tight2 text-gray-950">
									Data &amp; <em className="italic text-gray-700">Privacy</em>
								</h2>
								<p className="mb-8 text-sm text-gray-500">Data kamu dienkripsi end-to-end. Kamu yang punya kontrol penuh.</p>

								<Card
									header="Akun terhubung"
									footer={
										<>
											<div className="text-xs text-gray-500">3 sumber aktif</div>
											<a href="/import" className="inline-flex h-9 items-center rounded-lg bg-gray-950 px-4 text-[13px] font-medium text-white hover:bg-black">Tambah sumber</a>
										</>
									}
								>
									{CONNECTED_ACCOUNTS.map((acc) => (
										<div key={acc.name} className="flex items-center gap-3.5 border-b border-gray-100 py-3.5 last:border-b-0">
											<div className="grid h-[38px] w-[38px] shrink-0 place-items-center bg-gray-100 font-serif text-base text-gray-800">{acc.logo}</div>
											<div className="min-w-0 flex-1">
												<div className="text-sm font-medium text-gray-950">{acc.name}</div>
												<div className="mt-0.5 font-mono text-[11px] text-gray-500">{acc.sub}</div>
											</div>
											<span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-gray-500">
												<span className="h-1.5 w-1.5 rounded-full bg-[#16a34a]" />Aktif
											</span>
											<button type="button" className="inline-flex h-[30px] shrink-0 items-center rounded-lg border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:border-gray-950 hover:bg-gray-50 hover:text-gray-950">Putus</button>
										</div>
									))}
								</Card>

								<Card header="Privasi data">
									<ToggleRow title="Bagikan data anonim untuk riset" subtitle="Bantu kami meningkatkan model AI. Tidak termasuk identitas atau angka spesifik." />
									<ToggleRow title="Analitik penggunaan aplikasi" subtitle="Page views & klik untuk debugging. Tidak melacak data finansial." defaultOn />
								</Card>

								<Card
									header="Export data"
									footer={<div className="text-xs text-gray-500">Export terakhir: tidak pernah</div>}
								>
									<div className="flex flex-wrap gap-2.5">
										<button type="button" className="inline-flex h-9 items-center rounded-lg border border-gray-300 px-4 text-[13px] font-medium text-gray-700 hover:border-gray-950 hover:bg-gray-50 hover:text-gray-950">Download CSV</button>
										<button type="button" className="inline-flex h-9 items-center rounded-lg border border-gray-300 px-4 text-[13px] font-medium text-gray-700 hover:border-gray-950 hover:bg-gray-50 hover:text-gray-950">Download JSON</button>
										<button type="button" className="inline-flex h-9 items-center rounded-lg border border-gray-300 px-4 text-[13px] font-medium text-gray-700 hover:border-gray-950 hover:bg-gray-50 hover:text-gray-950">Download PDF Report</button>
									</div>
								</Card>
							</motion.div>
						)}

						{/* Tampilan */}
						{activeSection === "tampilan" && (
							<motion.div key="tampilan" variants={fadeVariants} initial="hidden" animate="show">
								<h2 className="mb-1.5 font-serif text-[32px] font-normal tracking-tight2 text-gray-950">Tampilan</h2>
								<p className="mb-8 text-sm text-gray-500">Atur preferensi visual kamu.</p>

								<Card header="Tema">
									<div className="grid grid-cols-3 gap-3 max-[880px]:grid-cols-1">
										{(["light", "dark", "auto"] as const).map((t) => {
											const labels = { light: "Terang", dark: "Gelap", auto: "Otomatis" };
											return (
												<button
													key={t}
													type="button"
													onClick={() => setTheme(t)}
													className={cn(
														"border p-3.5 text-center transition-[border-color,background-color] duration-200",
														theme === t ? "border-gray-950 bg-gray-50" : "border-gray-300 hover:border-gray-700",
														theme === t && "border-2 p-[13px]",
													)}
												>
													<div className={cn(
														"mb-2.5 grid h-14 place-items-center border border-gray-200 font-serif text-lg",
														t === "dark" && "border-[#0a0a0a] bg-[#0a0a0a] text-white",
														t === "auto" && "bg-gradient-to-r from-white via-white to-[#0a0a0a]",
													)}>
														Aa
													</div>
													<div className="text-xs font-medium text-gray-950">{labels[t]}</div>
												</button>
											);
										})}
									</div>
									<div className="mt-3.5 font-mono text-[11px] text-gray-400">Mode gelap akan tersedia segera. Otomatis akan ikuti pengaturan sistem operasi kamu.</div>
								</Card>

								<Card
									header="Bahasa & format angka"
									footer={
										<button type="button" className="inline-flex h-9 items-center rounded-lg bg-gray-950 px-4 text-[13px] font-medium text-white hover:bg-black">Simpan tampilan</button>
									}
								>
									<div className="grid grid-cols-2 gap-3.5 max-[880px]:grid-cols-1">
										<div>
											<FieldLabel>Bahasa</FieldLabel>
											<SelectInput defaultValue="Bahasa Indonesia">
												<option>Bahasa Indonesia</option>
												<option>English</option>
											</SelectInput>
										</div>
										<div>
											<FieldLabel>Format angka</FieldLabel>
											<SelectInput defaultValue="1.234.567 (id)">
												<option>1.234.567 (id)</option>
												<option>1,234,567 (en)</option>
											</SelectInput>
										</div>
									</div>
									<div className="mt-[18px] grid grid-cols-2 gap-3.5 max-[880px]:grid-cols-1">
										<div>
											<FieldLabel>Hari pertama minggu</FieldLabel>
											<SelectInput defaultValue="Senin">
												<option>Senin</option>
												<option>Minggu</option>
											</SelectInput>
										</div>
										<div>
											<FieldLabel>Zona waktu</FieldLabel>
											<SelectInput defaultValue="WIB · Asia/Jakarta">
												<option>WIB &middot; Asia/Jakarta</option>
												<option>WITA &middot; Asia/Makassar</option>
												<option>WIT &middot; Asia/Jayapura</option>
											</SelectInput>
										</div>
									</div>
								</Card>

								<Card header="Sembunyikan angka sensitif">
									<ToggleRow title="Mode privasi default" subtitle="Net worth dan saldo tampil sebagai ●●●● saat aplikasi dibuka. Klik mata untuk reveal." />
								</Card>
							</motion.div>
						)}

						{/* Danger Zone */}
						{activeSection === "danger" && (
							<motion.div key="danger" variants={fadeVariants} initial="hidden" animate="show">
								<h2 className="mb-1.5 font-serif text-[32px] font-normal tracking-tight2 text-[#dc2626]">Danger Zone</h2>
								<p className="mb-8 text-sm text-gray-500">Aksi di sini tidak dapat dibatalkan. Pikirkan baik-baik.</p>

								<Card
									danger
									header="Reset semua data"
									footer={
										<>
											<div className="text-xs text-[#dc2626]">Aksi ini tidak dapat dibatalkan.</div>
											<button type="button" className="inline-flex h-9 items-center rounded-lg border border-[#dc2626] bg-white px-4 text-[13px] font-medium text-[#dc2626] transition-[background-color,color] duration-200 hover:bg-[#dc2626] hover:text-white">Reset data saya</button>
										</>
									}
								>
									Hapus semua transaksi, anggaran, dan akun terhubung. Profil dan password kamu tetap. Cocok kalau ingin mulai dari nol.
								</Card>

								<Card
									danger
									header="Hapus akun permanen"
									footer={
										<>
											<div className="text-xs text-[#dc2626]">Tidak ada cara untuk memulihkan.</div>
											<button
												type="button"
												onClick={() => { setConfirmInput(""); setShowModal(true); }}
												className="inline-flex h-9 items-center rounded-lg border border-[#dc2626] bg-white px-4 text-[13px] font-medium text-[#dc2626] transition-[background-color,color] duration-200 hover:bg-[#dc2626] hover:text-white"
											>
												Hapus akun saya
											</button>
										</>
									}
								>
									Akun kamu dan semua data akan dihapus dari server kami dalam 30 hari. Setelah itu tidak ada cara untuk memulihkan.
								</Card>
							</motion.div>
						)}
					</AnimatePresence>
				</section>
			</div>

			{/* Confirmation modal */}
			<AnimatePresence>
				{showModal && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2, ease: easeDesignhub }}
						className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,10,10,0.4)] p-5"
						onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
					>
						<motion.div
							initial={{ scale: 0.95, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							exit={{ scale: 0.95, opacity: 0 }}
							transition={{ duration: 0.2, ease: easeDesignhub }}
							className="w-full max-w-[440px] rounded-lg border border-gray-200 bg-white p-7"
						>
							<h3 className="mb-2 font-serif text-2xl font-normal text-gray-950">Hapus akun permanen?</h3>
							<p className="mb-[18px] text-[13.5px] leading-relaxed text-gray-500">
								Akun <strong className="text-gray-950">bagus@constructland.com</strong> akan dihapus beserta 423 transaksi, 8 kategori anggaran, dan 3 sumber data terhubung. Data tidak dapat dipulihkan setelah 30 hari.
							</p>
							<div className="mb-[18px]">
								<label className="mb-1.5 block text-[11px] font-medium uppercase tracking-label text-gray-500">
									Ketik <strong className="text-[#dc2626]">HAPUS AKUN</strong> untuk konfirmasi
								</label>
								<input
									type="text"
									value={confirmInput}
									onChange={(e) => setConfirmInput(e.target.value)}
									placeholder="HAPUS AKUN"
									className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-[13px] outline-none focus:border-[#dc2626]"
								/>
							</div>
							<div className="flex justify-end gap-2.5">
								<button
									type="button"
									onClick={() => setShowModal(false)}
									className="inline-flex h-9 items-center rounded-lg border border-gray-300 px-4 text-[13px] font-medium text-gray-700 hover:border-gray-950 hover:bg-gray-50 hover:text-gray-950"
								>
									Batal
								</button>
								<button
									type="button"
									disabled={confirmInput.trim().toUpperCase() !== "HAPUS AKUN"}
									onClick={() => { setShowModal(false); alert("Akun akan dihapus dalam 30 hari. Email konfirmasi sudah dikirim."); }}
									className="inline-flex h-9 items-center rounded-lg border border-[#dc2626] bg-white px-4 text-[13px] font-medium text-[#dc2626] transition-[background-color,color] duration-200 hover:bg-[#dc2626] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
								>
									Hapus permanen
								</button>
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
}
