"use client";

import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	label?: string;
	error?: string;
	hint?: string;
}

// Text input — 4px radius, monochrome border, no glow on focus.
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
	{ label, error, hint, className, id, ...props },
	ref,
) {
	const generatedId = useId();
	const inputId = id ?? generatedId;
	const describedById = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

	return (
		<div className="flex flex-col gap-2">
			{label && (
				<label
					htmlFor={inputId}
					className="text-[11px] font-medium uppercase tracking-label text-gray-500"
				>
					{label}
				</label>
			)}
			<input
				ref={ref}
				id={inputId}
				aria-invalid={error ? true : undefined}
				aria-describedby={describedById}
				className={cn(
					"h-10 w-full rounded border bg-white px-4 text-sm text-black",
					"placeholder:text-gray-400",
					"transition-colors duration-150 ease-out",
					"focus:outline-none",
					error
						? "border-black focus:border-black"
						: "border-gray-300 focus:border-black",
					"disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400",
					className,
				)}
				{...props}
			/>
			{error ? (
				<p id={`${inputId}-error`} className="text-xs font-medium text-black">
					{error}
				</p>
			) : hint ? (
				<p id={`${inputId}-hint`} className="text-xs text-gray-500">
					{hint}
				</p>
			) : null}
		</div>
	);
});
