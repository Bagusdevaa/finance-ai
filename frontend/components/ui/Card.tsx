"use client";

import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type CardVariant = "default" | "dark";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
	variant?: CardVariant;
	hoverable?: boolean;
	children?: ReactNode;
}

const variantClasses: Record<CardVariant, string> = {
	default: "bg-white border-gray-200 text-black",
	dark: "bg-black border-black text-white",
};

// Base container — sharp corners (0px radius), 1px border, padding 24px.
// Hoverable: sedikit lift + border darken di hover.
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
	{ variant = "default", hoverable = false, className, children, ...props },
	ref,
) {
	return (
		<div
			ref={ref}
			className={cn(
				"border rounded-none p-6",
				"transition-[transform,border-color] duration-150 ease-out",
				variantClasses[variant],
				hoverable && variant === "default" && "hover:-translate-y-0.5 hover:border-gray-400",
				hoverable && variant === "dark" && "hover:-translate-y-0.5 hover:border-gray-700",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
});
