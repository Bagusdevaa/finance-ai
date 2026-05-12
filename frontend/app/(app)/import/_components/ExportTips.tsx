"use client";

import { lookupTips } from "@/lib/import-tips";

interface ExportTipsProps {
	accountName: string | null | undefined;
}

export function ExportTips({ accountName }: ExportTipsProps) {
	const tips = lookupTips(accountName);
	if (!tips) return null;

	return (
		<div className="border border-gray-200 bg-gray-50 px-[22px] py-5">
			<h3 className="mb-3 text-[11px] font-medium uppercase tracking-label text-gray-500">
				Cara export dari {tips.title}
			</h3>
			<ol className="m-0 list-none space-y-0 p-0">
				{tips.steps.map((step, i) => (
					<li key={i} className="flex gap-3.5 py-2 text-[13px] leading-relaxed text-gray-700">
						<span className="min-w-[24px] font-mono text-[11px] font-medium tracking-[0.04em] text-gray-400">
							{String(i + 1).padStart(2, "0")}
						</span>
						{step}
					</li>
				))}
			</ol>
		</div>
	);
}
