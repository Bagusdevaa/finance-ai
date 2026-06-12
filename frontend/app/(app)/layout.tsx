"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { SidebarShell } from "@/components/layout/Sidebar";
import { useAuthStore } from "@/lib/auth-store";

function AuthGate({ children }: { children: ReactNode }) {
	const router = useRouter();
	const accessToken = useAuthStore((s) => s.accessToken);
	const hydrated = useAuthStore((s) => s.hydrated);

	useEffect(() => {
		if (hydrated && !accessToken) router.replace("/login");
	}, [hydrated, accessToken, router]);

	if (!hydrated || !accessToken) return null;
	return <>{children}</>;
}

export default function AppLayout({ children }: { children: ReactNode }) {
	return (
		<AuthGate>
			<div className="flex min-h-screen bg-white">
				<SidebarShell>
					<main className="flex min-w-0 flex-1 flex-col overflow-x-hidden bg-white">{children}</main>
				</SidebarShell>
			</div>
		</AuthGate>
	);
}
