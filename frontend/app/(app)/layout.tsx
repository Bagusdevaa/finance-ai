import { type ReactNode } from "react";
import { SidebarShell } from "@/components/layout/Sidebar";

// TODO: auth guard — verify session token + redirect ke /login kalau tidak authenticated.
export default function AppLayout({ children }: { children: ReactNode }) {
	return (
		<div className="flex min-h-screen bg-white">
			<SidebarShell>
				<main className="flex min-w-0 flex-1 flex-col overflow-x-hidden bg-white">{children}</main>
			</SidebarShell>
		</div>
	);
}
