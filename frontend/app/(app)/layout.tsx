import { type ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";

// TODO: auth guard — verify session token + redirect ke /login kalau tidak authenticated.
export default function AppLayout({ children }: { children: ReactNode }) {
	return (
		<div className="flex min-h-screen bg-gray-50">
			<Sidebar />
			<main className="flex-1 overflow-x-hidden">{children}</main>
		</div>
	);
}
