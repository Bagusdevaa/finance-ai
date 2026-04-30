"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

export function QueryProvider({ children }: { children: ReactNode }) {
	const [client] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						staleTime: 30_000,
						refetchOnWindowFocus: false,
						retry: (count, err: unknown) => {
							const e = err as { response?: { status?: number } };
							const status = e?.response?.status ?? 0;
							if (status >= 400 && status < 500) return false;
							return count < 2;
						},
					},
				},
			}),
	);
	return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
