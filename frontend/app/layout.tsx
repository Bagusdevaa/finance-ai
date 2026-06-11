import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { QueryProvider } from "@/lib/query-client";
import { AuthHydrate } from "@/lib/auth-hydrate";

const geistSans = localFont({
	src: "./fonts/GeistVF.woff",
	variable: "--font-geist-sans",
	weight: "100 900",
});

const geistMono = localFont({
	src: "./fonts/GeistMonoVF.woff",
	variable: "--font-geist-mono",
	weight: "100 900",
});

// Self-hosted supaya gak butuh network ke fonts.gstatic.com.
const instrumentSerif = localFont({
	src: "./fonts/InstrumentSerif-Regular.woff2",
	variable: "--font-instrument-serif",
	weight: "400",
	display: "swap",
});

export const metadata: Metadata = {
	title: "FinanceAI",
	description: "Personal finance platform untuk pasar Indonesia",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="id">
			<body
				className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} font-sans antialiased bg-white text-black`}
			>
				<QueryProvider>
					<AuthHydrate />
					{children}
				</QueryProvider>
			</body>
		</html>
	);
}
