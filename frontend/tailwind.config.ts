import type { Config } from "tailwindcss";

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
			},
			fontFamily: {
				sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
				mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
				serif: ["var(--font-instrument-serif)", "Georgia", "serif"],
			},
			letterSpacing: {
				display: "-0.02em",
				label: "0.08em",
			},
			transitionTimingFunction: {
				expo: "cubic-bezier(0.16, 1, 0.3, 1)",
			},
		},
	},
	plugins: [],
};
export default config;
