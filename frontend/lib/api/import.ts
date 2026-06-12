import { api } from "@/lib/api";
import type {
	ImportConfirmResponse,
	ImportJobDetailResponse,
	ImportJobResponse,
	ImportRowResponse,
	ImportRowUpdate,
	ImportSourceType,
} from "./types";

export interface UploadImportParams {
	file: File;
	source_type: ImportSourceType;
	account_id?: string | null;
}

export async function uploadImport(params: UploadImportParams): Promise<ImportJobResponse> {
	const fd = new FormData();
	fd.append("file", params.file);
	fd.append("source_type", params.source_type);
	if (params.account_id) fd.append("account_id", params.account_id);
	const r = await api.post<ImportJobResponse>("/v1/import/upload", fd, {
		headers: { "Content-Type": "multipart/form-data" },
	});
	return r.data;
}

export async function listImportJobs(): Promise<ImportJobResponse[]> {
	const r = await api.get<ImportJobResponse[]>("/v1/import/jobs");
	return r.data;
}

export async function getImportJob(id: string): Promise<ImportJobDetailResponse> {
	const r = await api.get<ImportJobDetailResponse>(`/v1/import/jobs/${id}`);
	return r.data;
}

export async function updateImportRow(
	jobId: string,
	rowId: string,
	data: ImportRowUpdate,
): Promise<ImportRowResponse> {
	const r = await api.patch<ImportRowResponse>(
		`/v1/import/jobs/${jobId}/rows/${rowId}`,
		data,
	);
	return r.data;
}

export async function excludeImportRow(jobId: string, rowId: string): Promise<void> {
	await api.delete(`/v1/import/jobs/${jobId}/rows/${rowId}`);
}

export async function confirmImportJob(id: string): Promise<ImportConfirmResponse> {
	const r = await api.post<ImportConfirmResponse>(`/v1/import/jobs/${id}/confirm`);
	return r.data;
}

export async function cancelImportJob(id: string): Promise<void> {
	await api.post(`/v1/import/jobs/${id}/cancel`);
}
