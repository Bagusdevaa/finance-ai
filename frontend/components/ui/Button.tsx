"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant;
	size?: ButtonSize;
	loading?: boolean;
	children?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
	primary:
		"bg-black text-white hover:bg-gray-900 active:scale-[0.98] disabled:bg-gray-300 disabled:text-gray-500",
	secondary:
		"bg-white text-black border border-black hover:bg-gray-50 active:scale-[0.98] disabled:border-gray-300 disabled:text-gray-400",
	ghost:
		"bg-transparent text-black hover:bg-gray-100 active:scale-[0.98] disabled:text-gray-400",
};

const sizeClasses: Record<ButtonSize, string> = {
	sm: "h-8 px-3 text-xs",
	md: "h-10 px-5 text-sm",
	lg: "h-12 px-6 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
	{ variant = "primary", size = "md", loading = false, disabled, className, children, ...props },
	ref,
) {
	const isDisabled = disabled || loading;

	return (
		<button
			ref={ref}
			disabled={isDisabled}
			aria-busy={loading || undefined}
			className={cn(
				"inline-flex items-center justify-center gap-2 rounded font-medium",
				"transition-[background-color,transform,opacity] duration-150 ease-out",
				"disabled:cursor-not-allowed",
				variantClasses[variant],
				sizeClasses[size],
				loading && "animate-pulse",
				className,
			)}
			{...props}
		>
			{loading ? (
				<span className="inline-flex items-center gap-2">
					<Spinner />
					<span>{children}</span>
				</span>
			) : (
				children
			)}
		</button>
	);
});

function Spinner() {
	return (
		<svg
			className="h-4 w-4 animate-spin"
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
		>
			<circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25" />
			<path
				d="M22 12a10 10 0 0 1-10 10"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
			/>
		</svg>
	);
}
