import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { ChatSessionDetailResponse, ChatSessionResponse } from "./types";

export async function listSessions(): Promise<ChatSessionResponse[]> {
	const r = await api.get<ChatSessionResponse[]>("/v1/chat/sessions");
	return r.data;
}

export async function createSession(title?: string): Promise<ChatSessionResponse> {
	const r = await api.post<ChatSessionResponse>("/v1/chat/sessions", { title });
	return r.data;
}

export async function getSession(id: string): Promise<ChatSessionDetailResponse> {
	const r = await api.get<ChatSessionDetailResponse>(`/v1/chat/sessions/${id}`);
	return r.data;
}

export async function deleteSession(id: string): Promise<void> {
	await api.delete(`/v1/chat/sessions/${id}`);
}

export interface SseEvent {
	type: "user_saved" | "context" | "token" | "done" | "error";
	id?: string;
	content?: string;
	sources?: string[];
	message?: string;
}

// Stream SSE events from POST /sessions/{id}/messages.
// Backend yields lines: `data: {...}\n\n` and final `data: [DONE]\n\n`.
export async function* postMessageStream(
	sessionId: string,
	content: string,
	signal?: AbortSignal,
): AsyncGenerator<SseEvent> {
	const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
	const token = useAuthStore.getState().accessToken;
	const r = await fetch(`${baseURL}/v1/chat/sessions/${sessionId}/messages`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token ?? ""}`,
		},
		body: JSON.stringify({ content }),
		credentials: "include",
		signal,
	});
	if (!r.ok || !r.body) {
		throw new Error(`Stream failed: ${r.status}`);
	}
	const reader = r.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	while (true) {
		const { value, done } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		let idx;
		while ((idx = buffer.indexOf("\n\n")) !== -1) {
			const chunk = buffer.slice(0, idx).trim();
			buffer = buffer.slice(idx + 2);
			if (!chunk.startsWith("data: ")) continue;
			const data = chunk.slice(6);
			if (data === "[DONE]") return;
			try {
				yield JSON.parse(data) as SseEvent;
			} catch {
				// malformed — skip
			}
		}
	}
}
