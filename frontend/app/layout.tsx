import type { Metadata } from "next";
import localFont from "next/font/local";
import { Instrument_Serif } from "next/font/google";
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

const instrumentSerif = Instrument_Serif({
	subsets: ["latin"],
	weight: "400",
	variable: "--font-instrument-serif",
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
