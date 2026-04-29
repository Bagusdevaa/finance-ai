"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";

type Mode = "login" | "register";

const ease = [0.2, 0.7, 0.2, 1] as const;

function GoogleIcon() {
	return (
		<svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
			<path
				fill="#FFC107"
				d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
			/>
			<path
				fill="#FF3D00"
				d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"
			/>
			<path
				fill="#4CAF50"
				d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.6 39.5 16.2 44 24 44z"
			/>
			<path
				fill="#1976D2"
				d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C41.2 36 44 30.5 44 24c0-1.3-.1-2.3-.4-3.5z"
			/>
		</svg>
	);
}

function CheckIcon({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			viewBox="0 0 16 16"
			fill="none"
			aria-hidden="true"
		>
			<path
				d="M3 8.5l3.2 3.2L13 5"
				stroke="currentColor"
				strokeWidth="1.8"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function getPasswordStrength(password: string): number {
	if (!password) return 0;
	let score = 0;
	if (password.length >= 8) score++;
	if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
	if (/\d/.test(password)) score++;
	if (/[^A-Za-z0-9]/.test(password) || password.length >= 12) score++;
	return score;
}

const strengthLabels = ["", "Lemah", "Cukup", "Bagus", "Kuat"];
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
	const router = useRouter();
	const [mode, setMode] = useState<Mode>("login");
	const [showSuccess, setShowSuccess] = useState(false);
	const [successTitle, setSuccessTitle] = useState("");
	const [successText, setSuccessText] = useState("");

	const [loginEmail, setLoginEmail] = useState("");
	const [loginPassword, setLoginPassword] = useState("");
	const [loginShowPw, setLoginShowPw] = useState(false);
	const [loginErrors, setLoginErrors] = useState<Record<string, string>>({});
	const [loginTouched, setLoginTouched] = useState<Record<string, boolean>>({});
	const [loginLoading, setLoginLoading] = useState(false);

	const [regName, setRegName] = useState("");
	const [regEmail, setRegEmail] = useState("");
	const [regPassword, setRegPassword] = useState("");
	const [regConfirm, setRegConfirm] = useState("");
	const [regShowPw, setRegShowPw] = useState(false);
	const [regErrors, setRegErrors] = useState<Record<string, string>>({});
	const [regTouched, setRegTouched] = useState<Record<string, boolean>>({});
	const [regLoading, setRegLoading] = useState(false);

	const initialHash = useRef(false);

	useEffect(() => {
		if (!initialHash.current) {
			initialHash.current = true;
			if (window.location.hash === "#register") {
				setMode("register");
			}
		}
	}, []);

	useEffect(() => {
		history.replaceState(null, "", "#" + mode);
	}, [mode]);

	const validateLoginField = useCallback(
		(field: string): string => {
			if (field === "email") {
				if (!loginEmail.trim()) return "Email wajib diisi.";
				if (!emailRe.test(loginEmail.trim())) return "Format email tidak valid.";
			}
			if (field === "password") {
				if (loginPassword.length < 8) return "Password minimal 8 karakter.";
			}
			return "";
		},
		[loginEmail, loginPassword],
	);

	const validateRegField = useCallback(
		(field: string): string => {
			if (field === "name") {
				if (regName.trim().length < 2) return "Nama lengkap wajib diisi.";
			}
			if (field === "email") {
				if (!regEmail.trim()) return "Email wajib diisi.";
				if (!emailRe.test(regEmail.trim())) return "Format email tidak valid.";
			}
			if (field === "password") {
				if (regPassword.length < 8) return "Password minimal 8 karakter.";
			}
			if (field === "confirm") {
				if (!regConfirm) return "Konfirmasi wajib diisi.";
				if (regConfirm !== regPassword) return "Password tidak cocok.";
			}
			return "";
		},
		[regName, regEmail, regPassword, regConfirm],
	);

	const handleLoginBlur = (field: string) => {
		setLoginTouched((p) => ({ ...p, [field]: true }));
		const err = validateLoginField(field);
		setLoginErrors((p) => ({ ...p, [field]: err }));
	};

	const handleLoginInput = (field: string) => {
		if (loginTouched[field] || loginErrors[field]) {
			const err = validateLoginField(field);
			setLoginErrors((p) => ({ ...p, [field]: err }));
		}
	};

	const handleRegBlur = (field: string) => {
		setRegTouched((p) => ({ ...p, [field]: true }));
		const err = validateRegField(field);
		setRegErrors((p) => ({ ...p, [field]: err }));
	};

	const handleRegInput = (field: string) => {
		if (regTouched[field] || regErrors[field]) {
			const err = validateRegField(field);
			setRegErrors((p) => ({ ...p, [field]: err }));
		}
		if (field === "password" && regTouched.confirm) {
			const err = validateRegField("confirm");
			setRegErrors((p) => ({ ...p, confirm: err }));
		}
	};

	const handleLoginSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const fields = ["email", "password"];
		const touched: Record<string, boolean> = {};
		const errors: Record<string, string> = {};
		let ok = true;
		fields.forEach((f) => {
			touched[f] = true;
			const err = validateLoginField(f);
			errors[f] = err;
			if (err) ok = false;
		});
		setLoginTouched(touched);
		setLoginErrors(errors);
		if (!ok) return;
		setLoginLoading(true);
		setTimeout(() => {
			setSuccessTitle("Berhasil masuk.");
			setSuccessText("Mengarahkan ke dashboard kamu...");
			setShowSuccess(true);
			setTimeout(() => router.push("/dashboard"), 1800);
		}, 700);
	};

	const handleRegSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const fields = ["name", "email", "password", "confirm"];
		const touched: Record<string, boolean> = {};
		const errors: Record<string, string> = {};
		let ok = true;
		fields.forEach((f) => {
			touched[f] = true;
			const err = validateRegField(f);
			errors[f] = err;
			if (err) ok = false;
		});
		setRegTouched(touched);
		setRegErrors(errors);
		if (!ok) return;
		setRegLoading(true);
		setTimeout(() => {
			setSuccessTitle("Akun kamu siap.");
			setSuccessText("Mari kita setup dulu...");
			setShowSuccess(true);
			setTimeout(() => router.push("/onboarding"), 1800);
		}, 900);
	};

	const pwStrength = getPasswordStrength(regPassword);

	const isRegEmailValid =
		regTouched.email && !regErrors.email && regEmail.trim().length > 0;
	const isRegConfirmValid =
		regTouched.confirm &&
		!regErrors.confirm &&
		regConfirm.length > 0 &&
		regConfirm === regPassword;

	return (
		<main className="grid min-h-screen grid-cols-1 min-[880px]:grid-cols-2">
			<aside className="relative hidden min-[880px]:flex flex-col justify-between bg-black text-white p-10 pr-14 pl-14 overflow-hidden">
				<div
					className="absolute inset-0 pointer-events-none"
					style={{
						background:
							"radial-gradient(600px 360px at 80% 20%, rgba(255,255,255,.05), transparent 60%), radial-gradient(500px 360px at 10% 90%, rgba(255,255,255,.04), transparent 60%)",
					}}
				/>

				<div className="relative z-[1]">
					<Link
						href="/"
						className="font-serif text-[22px] leading-none tracking-tight2 inline-flex items-center gap-2 text-white"
					>
						<span className="relative inline-block w-[22px] h-[22px] rounded-full bg-white">
							<span className="absolute inset-[6px] rounded-full bg-black" />
						</span>
						FinanceAI
					</Link>
				</div>

				<div className="relative z-[1] my-auto max-w-[480px]">
					<div className="text-[11px] uppercase tracking-[0.16em] text-gray-500 font-medium mb-9 inline-flex items-center gap-3">
						<span className="inline-block w-7 h-px bg-gray-700" />
						Filosofi kami
					</div>
					<h2 className="font-serif font-light text-[clamp(28px,3.2vw,40px)] leading-[1.2] tracking-tight2 text-white mb-5">
						Angka tidak berbohong.
						<br />
						<em className="italic text-gray-400 font-normal">
							Keuangan kamu seharusnya juga&nbsp;tidak.
						</em>
					</h2>
					<div className="text-[13px] text-gray-500 tracking-[0.02em]">
						&mdash; FinanceAI
					</div>

					<div className="mt-9 flex flex-col gap-[10px] p-[18px_20px] border border-gray-800 rounded-[14px] bg-white/[0.02] max-w-[340px]">
						<div className="flex items-center justify-between text-[12px] text-gray-400">
							<span className="text-gray-300 font-medium">IHSG</span>
							<span className="tabular-nums text-gray-500 flex items-center gap-[6px]">
								<span className="inline-block w-0 h-0 border-[4px] border-transparent border-b-gray-300 mb-[2px]" />
								7.428,12
							</span>
						</div>
						<div className="flex items-center justify-between text-[12px] text-gray-400">
							<span className="text-gray-300 font-medium">USD / IDR</span>
							<span className="tabular-nums text-gray-500">16.190</span>
						</div>
						<div className="flex items-center justify-between text-[12px] text-gray-400">
							<span className="text-gray-300 font-medium">Emas Antam</span>
							<span className="tabular-nums text-gray-500 flex items-center gap-[6px]">
								<span className="inline-block w-0 h-0 border-[4px] border-transparent border-b-gray-300 mb-[2px]" />
								1.358.000 / gr
							</span>
						</div>
					</div>
				</div>

				<div className="relative z-[1] flex items-center gap-[14px] text-gray-500 text-[13px]">
					<div className="flex" aria-hidden="true">
						<span className="w-[30px] h-[30px] rounded-full border-[1.5px] border-black inline-flex items-center justify-center text-[11px] font-medium text-white font-serif bg-[#3a3a3a]">
							R
						</span>
						<span className="w-[30px] h-[30px] rounded-full border-[1.5px] border-black inline-flex items-center justify-center text-[11px] font-medium text-white font-serif bg-[#5e5e5e] -ml-2">
							A
						</span>
						<span className="w-[30px] h-[30px] rounded-full border-[1.5px] border-black inline-flex items-center justify-center text-[11px] font-medium text-white font-serif bg-[#8a8a8a] -ml-2">
							D
						</span>
					</div>
					Dipercaya 2.400+ pengguna aktif di Indonesia
				</div>
			</aside>

			<section className="relative flex flex-col items-center justify-center bg-white px-6 py-10 min-[880px]:px-14 min-h-screen">
				<div
					className="absolute top-9 right-12 min-[880px]:right-12 text-[12px] text-gray-500 inline-flex items-center gap-[6px]"
					aria-hidden="true"
				>
					<span>&#x1F1EE;&#x1F1E9;</span>{" "}
					<strong className="text-gray-900 font-medium">ID</strong> &middot;
					Bahasa Indonesia
				</div>

				<div className="w-full max-w-[380px] min-[880px]:max-w-[380px] max-[880px]:max-w-[420px]">
					<div className="relative flex border-b border-gray-200 mb-9">
						<button
							className={cn(
								"flex-1 text-center pb-[14px] pt-3 text-[13px] font-medium tracking-[0.01em] transition-colors duration-250 ease-designhub",
								mode === "login" ? "text-gray-950" : "text-gray-400 hover:text-gray-700",
							)}
							onClick={() => setMode("login")}
						>
							Masuk
						</button>
						<button
							className={cn(
								"flex-1 text-center pb-[14px] pt-3 text-[13px] font-medium tracking-[0.01em] transition-colors duration-250 ease-designhub",
								mode === "register" ? "text-gray-950" : "text-gray-400 hover:text-gray-700",
							)}
							onClick={() => setMode("register")}
						>
							Daftar
						</button>
						<motion.span
							className="absolute left-0 bottom-[-1px] w-1/2 h-[2px] bg-gray-950"
							animate={{ x: mode === "register" ? "100%" : "0%" }}
							transition={{ duration: 0.35, ease }}
						/>
					</div>

					<div className="relative">
						<AnimatePresence mode="wait">
							{mode === "login" ? (
								<motion.form
									key="login"
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									transition={{ duration: 0.2, ease }}
									onSubmit={handleLoginSubmit}
									noValidate
								>
									<h1 className="font-serif font-normal text-[30px] leading-[1.15] tracking-tight2 text-gray-950 mb-2">
										Selamat datang <em className="italic text-gray-700">kembali.</em>
									</h1>
									<p className="text-[14px] text-gray-500 mb-7">
										Masuk ke akun FinanceAI kamu.
									</p>

									<div className="mb-[18px]">
										<div className="flex justify-between items-baseline mb-2">
											<label className="text-[11px] uppercase tracking-labelWide text-gray-500 font-medium">
												Email
											</label>
										</div>
										<div className="relative">
											<input
												type="email"
												className={cn(
													"w-full h-[46px] px-[14px] text-[14px] font-sans text-gray-950 bg-white border rounded-lg outline-none transition-all duration-150 ease-designhub placeholder:text-gray-400 hover:border-gray-400 focus:border-gray-950 focus:shadow-[0_0_0_3px_rgba(10,10,10,0.06)]",
													loginErrors.email
														? "border-[#c0322a] bg-[#fdecea] focus:shadow-[0_0_0_3px_rgba(192,50,42,0.12)]"
														: "border-gray-300",
												)}
												placeholder="kamu@email.com"
												autoComplete="email"
												value={loginEmail}
												onChange={(e) => {
													setLoginEmail(e.target.value);
													handleLoginInput("email");
												}}
												onBlur={() => handleLoginBlur("email")}
											/>
										</div>
										{loginErrors.email && (
											<p className="mt-[6px] text-[12px] text-[#c0322a] leading-[1.4]">
												{loginErrors.email}
											</p>
										)}
									</div>

									<div className="mb-[18px]">
										<div className="flex justify-between items-baseline mb-2">
											<label className="text-[11px] uppercase tracking-labelWide text-gray-500 font-medium">
												Password
											</label>
											<a
												href="#"
												className="text-[12px] text-gray-500 transition-colors duration-200 ease-designhub hover:text-gray-950"
											>
												Lupa password?
											</a>
										</div>
										<div className="relative">
											<input
												type={loginShowPw ? "text" : "password"}
												className={cn(
													"w-full h-[46px] px-[14px] pr-[42px] text-[14px] font-sans text-gray-950 bg-white border rounded-lg outline-none transition-all duration-150 ease-designhub placeholder:text-gray-400 hover:border-gray-400 focus:border-gray-950 focus:shadow-[0_0_0_3px_rgba(10,10,10,0.06)]",
													loginErrors.password
														? "border-[#c0322a] bg-[#fdecea] focus:shadow-[0_0_0_3px_rgba(192,50,42,0.12)]"
														: "border-gray-300",
												)}
												placeholder="••••••••"
												autoComplete="current-password"
												value={loginPassword}
												onChange={(e) => {
													setLoginPassword(e.target.value);
													handleLoginInput("password");
												}}
												onBlur={() => handleLoginBlur("password")}
											/>
											<button
												type="button"
												className="absolute right-[14px] top-1/2 -translate-y-1/2 text-gray-400 text-[13px] leading-none select-none transition-colors duration-200 ease-designhub hover:text-gray-950"
												onClick={() => setLoginShowPw(!loginShowPw)}
											>
												{loginShowPw ? "Sembunyi" : "Lihat"}
											</button>
										</div>
										{loginErrors.password && (
											<p className="mt-[6px] text-[12px] text-[#c0322a] leading-[1.4]">
												{loginErrors.password}
											</p>
										)}
									</div>

									<button
										type="submit"
										disabled={loginLoading}
										className="group relative w-full h-12 rounded-full text-[14px] font-medium bg-gray-950 text-white mt-2 overflow-hidden isolate inline-flex items-center justify-center gap-2 transition-transform duration-200 ease-designhub hover:translate-y-[-1px] disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
									>
										<span className="absolute inset-0 bg-black -translate-x-[101%] transition-transform duration-[400ms] ease-designhub group-hover:translate-x-0 group-disabled:hidden -z-10" />
										{loginLoading ? "Memuat..." : "Masuk"}
									</button>

									<div className="flex items-center gap-[14px] my-6 text-gray-400 text-[11px] uppercase tracking-[0.14em] font-medium">
										<span className="flex-1 h-px bg-gray-200" />
										<span>atau</span>
										<span className="flex-1 h-px bg-gray-200" />
									</div>

									<button
										type="button"
										className="group relative w-full h-12 rounded-full text-[14px] font-medium bg-white text-gray-950 border border-gray-300 overflow-hidden isolate inline-flex items-center justify-center gap-2 transition-all duration-200 ease-designhub hover:border-gray-950"
									>
										<span className="absolute inset-0 bg-gray-100 -translate-x-[101%] transition-transform duration-[400ms] ease-designhub group-hover:translate-x-0 -z-10" />
										<GoogleIcon />
										Masuk dengan Google
									</button>

									<div className="mt-7 text-center text-[13px] text-gray-500">
										Belum punya akun?{" "}
										<button
											type="button"
											onClick={() => setMode("register")}
											className="text-gray-950 font-medium border-b border-transparent transition-colors duration-200 ease-designhub hover:border-gray-950"
										>
											Daftar
										</button>
									</div>
								</motion.form>
							) : (
								<motion.form
									key="register"
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									transition={{ duration: 0.2, ease }}
									onSubmit={handleRegSubmit}
									noValidate
								>
									<h1 className="font-serif font-normal text-[30px] leading-[1.15] tracking-tight2 text-gray-950 mb-2">
										Mulai <em className="italic text-gray-700">gratis</em> hari ini.
									</h1>
									<p className="text-[14px] text-gray-500 mb-7">
										Buat akun FinanceAI dalam 60 detik.
									</p>

									<div className="mb-[18px]">
										<div className="flex justify-between items-baseline mb-2">
											<label className="text-[11px] uppercase tracking-labelWide text-gray-500 font-medium">
												Nama lengkap
											</label>
										</div>
										<div className="relative">
											<input
												type="text"
												className={cn(
													"w-full h-[46px] px-[14px] text-[14px] font-sans text-gray-950 bg-white border rounded-lg outline-none transition-all duration-150 ease-designhub placeholder:text-gray-400 hover:border-gray-400 focus:border-gray-950 focus:shadow-[0_0_0_3px_rgba(10,10,10,0.06)]",
													regErrors.name
														? "border-[#c0322a] bg-[#fdecea] focus:shadow-[0_0_0_3px_rgba(192,50,42,0.12)]"
														: "border-gray-300",
												)}
												placeholder="Rizky Adiputra"
												autoComplete="name"
												value={regName}
												onChange={(e) => {
													setRegName(e.target.value);
													handleRegInput("name");
												}}
												onBlur={() => handleRegBlur("name")}
											/>
										</div>
										{regErrors.name && (
											<p className="mt-[6px] text-[12px] text-[#c0322a] leading-[1.4]">
												{regErrors.name}
											</p>
										)}
									</div>

									<div className="mb-[18px]">
										<div className="flex justify-between items-baseline mb-2">
											<label className="text-[11px] uppercase tracking-labelWide text-gray-500 font-medium">
												Email
											</label>
										</div>
										<div className="relative">
											<input
												type="email"
												className={cn(
													"w-full h-[46px] px-[14px] pr-[42px] text-[14px] font-sans text-gray-950 bg-white border rounded-lg outline-none transition-all duration-150 ease-designhub placeholder:text-gray-400 hover:border-gray-400 focus:border-gray-950 focus:shadow-[0_0_0_3px_rgba(10,10,10,0.06)]",
													regErrors.email
														? "border-[#c0322a] bg-[#fdecea] focus:shadow-[0_0_0_3px_rgba(192,50,42,0.12)]"
														: "border-gray-300",
												)}
												placeholder="kamu@email.com"
												autoComplete="email"
												value={regEmail}
												onChange={(e) => {
													setRegEmail(e.target.value);
													handleRegInput("email");
												}}
												onBlur={() => handleRegBlur("email")}
											/>
											{isRegEmailValid && (
												<motion.div
													initial={{ opacity: 0, scale: 0.6 }}
													animate={{ opacity: 1, scale: 1 }}
													transition={{ duration: 0.35, ease }}
													className="absolute right-[14px] top-1/2 -translate-y-1/2 text-gray-950"
												>
													<CheckIcon className="w-4 h-4" />
												</motion.div>
											)}
										</div>
										{regErrors.email && (
											<p className="mt-[6px] text-[12px] text-[#c0322a] leading-[1.4]">
												{regErrors.email}
											</p>
										)}
									</div>

									<div className="mb-[18px]">
										<div className="flex justify-between items-baseline mb-2">
											<label className="text-[11px] uppercase tracking-labelWide text-gray-500 font-medium">
												Password
											</label>
										</div>
										<div className="relative">
											<input
												type={regShowPw ? "text" : "password"}
												className={cn(
													"w-full h-[46px] px-[14px] pr-[42px] text-[14px] font-sans text-gray-950 bg-white border rounded-lg outline-none transition-all duration-150 ease-designhub placeholder:text-gray-400 hover:border-gray-400 focus:border-gray-950 focus:shadow-[0_0_0_3px_rgba(10,10,10,0.06)]",
													regErrors.password
														? "border-[#c0322a] bg-[#fdecea] focus:shadow-[0_0_0_3px_rgba(192,50,42,0.12)]"
														: "border-gray-300",
												)}
												placeholder="Minimal 8 karakter"
												autoComplete="new-password"
												value={regPassword}
												onChange={(e) => {
													setRegPassword(e.target.value);
													handleRegInput("password");
												}}
												onBlur={() => handleRegBlur("password")}
											/>
											<button
												type="button"
												className="absolute right-[14px] top-1/2 -translate-y-1/2 text-gray-400 text-[13px] leading-none select-none transition-colors duration-200 ease-designhub hover:text-gray-950"
												onClick={() => setRegShowPw(!regShowPw)}
											>
												{regShowPw ? "Sembunyi" : "Lihat"}
											</button>
										</div>
										<div className="flex gap-1 mt-2" aria-hidden="true">
											{[1, 2, 3, 4].map((i) => (
												<span
													key={i}
													className={cn(
														"flex-1 h-[3px] rounded-sm transition-colors duration-250 ease-designhub",
														i <= pwStrength
															? pwStrength === 1
																? "bg-gray-400"
																: pwStrength === 2
																	? "bg-gray-700"
																	: pwStrength === 3
																		? "bg-gray-900"
																		: "bg-gray-950"
															: "bg-gray-200",
													)}
												/>
											))}
										</div>
										<div className="mt-[6px] flex justify-between text-[11px] text-gray-400">
											<span>8+ karakter, kombinasi huruf &amp; angka</span>
											{pwStrength > 0 && (
												<span className="text-gray-600 font-medium">
													{strengthLabels[pwStrength]}
												</span>
											)}
										</div>
										{regErrors.password && (
											<p className="mt-[6px] text-[12px] text-[#c0322a] leading-[1.4]">
												{regErrors.password}
											</p>
										)}
									</div>

									<div className="mb-[18px]">
										<div className="flex justify-between items-baseline mb-2">
											<label className="text-[11px] uppercase tracking-labelWide text-gray-500 font-medium">
												Konfirmasi password
											</label>
										</div>
										<div className="relative">
											<input
												type="password"
												className={cn(
													"w-full h-[46px] px-[14px] pr-[42px] text-[14px] font-sans text-gray-950 bg-white border rounded-lg outline-none transition-all duration-150 ease-designhub placeholder:text-gray-400 hover:border-gray-400 focus:border-gray-950 focus:shadow-[0_0_0_3px_rgba(10,10,10,0.06)]",
													regErrors.confirm
														? "border-[#c0322a] bg-[#fdecea] focus:shadow-[0_0_0_3px_rgba(192,50,42,0.12)]"
														: "border-gray-300",
												)}
												placeholder="Ulangi password"
												autoComplete="new-password"
												value={regConfirm}
												onChange={(e) => {
													setRegConfirm(e.target.value);
													handleRegInput("confirm");
												}}
												onBlur={() => handleRegBlur("confirm")}
											/>
											{isRegConfirmValid && (
												<motion.div
													initial={{ opacity: 0, scale: 0.6 }}
													animate={{ opacity: 1, scale: 1 }}
													transition={{ duration: 0.35, ease }}
													className="absolute right-[14px] top-1/2 -translate-y-1/2 text-gray-950"
												>
													<CheckIcon className="w-4 h-4" />
												</motion.div>
											)}
										</div>
										{regErrors.confirm && (
											<p className="mt-[6px] text-[12px] text-[#c0322a] leading-[1.4]">
												{regErrors.confirm}
											</p>
										)}
									</div>

									<button
										type="submit"
										disabled={regLoading}
										className="group relative w-full h-12 rounded-full text-[14px] font-medium bg-gray-950 text-white mt-2 overflow-hidden isolate inline-flex items-center justify-center gap-2 transition-transform duration-200 ease-designhub hover:translate-y-[-1px] disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
									>
										<span className="absolute inset-0 bg-black -translate-x-[101%] transition-transform duration-[400ms] ease-designhub group-hover:translate-x-0 group-disabled:hidden -z-10" />
										{regLoading ? "Membuat akun..." : "Buat Akun"}
									</button>

									<div className="flex items-center gap-[14px] my-6 text-gray-400 text-[11px] uppercase tracking-[0.14em] font-medium">
										<span className="flex-1 h-px bg-gray-200" />
										<span>atau</span>
										<span className="flex-1 h-px bg-gray-200" />
									</div>

									<button
										type="button"
										className="group relative w-full h-12 rounded-full text-[14px] font-medium bg-white text-gray-950 border border-gray-300 overflow-hidden isolate inline-flex items-center justify-center gap-2 transition-all duration-200 ease-designhub hover:border-gray-950"
									>
										<span className="absolute inset-0 bg-gray-100 -translate-x-[101%] transition-transform duration-[400ms] ease-designhub group-hover:translate-x-0 -z-10" />
										<GoogleIcon />
										Daftar dengan Google
									</button>

									<div className="mt-7 text-center text-[13px] text-gray-500">
										Sudah punya akun?{" "}
										<button
											type="button"
											onClick={() => setMode("login")}
											className="text-gray-950 font-medium border-b border-transparent transition-colors duration-200 ease-designhub hover:border-gray-950"
										>
											Masuk
										</button>
									</div>

									<p className="mt-5 text-center text-[11px] text-gray-400 leading-[1.5] max-w-[300px] mx-auto">
										Dengan mendaftar, kamu menyetujui{" "}
										<a
											href="#"
											className="text-gray-600 border-b border-gray-300 transition-colors duration-200 ease-designhub hover:text-gray-950 hover:border-gray-950"
										>
											Syarat &amp; Ketentuan
										</a>{" "}
										dan{" "}
										<a
											href="#"
											className="text-gray-600 border-b border-gray-300 transition-colors duration-200 ease-designhub hover:text-gray-950 hover:border-gray-950"
										>
											Kebijakan Privasi
										</a>{" "}
										kami.
									</p>
								</motion.form>
							)}
						</AnimatePresence>

						<AnimatePresence>
							{showSuccess && (
								<motion.div
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									transition={{ duration: 0.35, ease }}
									className="absolute inset-0 bg-white flex flex-col items-center justify-center text-center p-10 z-10"
								>
									<motion.div
										initial={{ scale: 0.6, opacity: 0 }}
										animate={{ scale: 1, opacity: 1 }}
										transition={{ duration: 0.45, ease, delay: 0.1 }}
										className="w-[72px] h-[72px] rounded-full bg-gray-950 grid place-items-center mb-5"
									>
										<svg
											viewBox="0 0 24 24"
											fill="none"
											className="w-8 h-8 text-white"
										>
											<motion.path
												d="M5 12.5l4.5 4.5L19 7.5"
												stroke="currentColor"
												strokeWidth="2.4"
												strokeLinecap="round"
												strokeLinejoin="round"
												initial={{ pathLength: 0 }}
												animate={{ pathLength: 1 }}
												transition={{ duration: 0.5, ease, delay: 0.35 }}
											/>
										</svg>
									</motion.div>
									<h3 className="font-serif font-normal text-[28px] text-gray-950 tracking-tight2 mb-2">
										{successTitle}
									</h3>
									<p className="text-[14px] text-gray-500">{successText}</p>
								</motion.div>
							)}
						</AnimatePresence>
					</div>
				</div>
			</section>
		</main>
	);
}
