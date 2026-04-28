import type { Config } from "tailwindcss";

// Tokens diambil langsung dari .claude/design-hub/project/Dashboard.html dan Aset Portofolio.html
// (ditambahkan ke Tailwind biar konsisten dgn HTML mockup design hub).
const config: Config = {
	content: [
		"./pages/**/*.{js,ts,jsx,tsx,mdx}",
		"./components/**/*.{js,ts,jsx,tsx,mdx}",
		"./app/**/*.{js,ts,jsx,tsx,mdx}",
		"./hooks/**/*.{js,ts,jsx,tsx,mdx}",
		"./lib/**/*.{js,ts,jsx,tsx,mdx}",
	],
	theme: {
		extend: {
			colors: {
				background: "var(--background)",
				foreground: "var(--foreground)",
				gray: {
					50: "#fafafa",
					100: "#f4f4f4",
					200: "#e8e8e8",
					300: "#d4d4d4",
					400: "#a3a3a3",
					500: "#737373",
					600: "#525252",
					700: "#404040",
					800: "#262626",
					900: "#171717",
					950: "#0a0a0a",
				},
			},
			fontFamily: {
				sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
				mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
				serif: ["var(--font-instrument-serif)", "Georgia", "serif"],
			},
			fontSize: {
				// Scale dari design hub
				"hero-xl": ["78px", { lineHeight: "1", letterSpacing: "-0.02em" }],
				"hero-lg": ["56px", { lineHeight: "1", letterSpacing: "-0.02em" }],
			},
			letterSpacing: {
				display: "-0.02em",
				tight2: "-0.01em",
				label: "0.1em",
				labelWide: "0.12em",
				labelExtra: "0.14em",
			},
			transitionTimingFunction: {
				expo: "cubic-bezier(0.16, 1, 0.3, 1)",
				// Easing yg dipakai di seluruh design hub (lihat --ease di Dashboard.html).
				designhub: "cubic-bezier(0.2, 0.7, 0.2, 1)",
			},
		},
	},
	plugins: [],
};
export default config;
