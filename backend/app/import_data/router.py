"""Import HTTP endpoints.

Upload return 202 segera; parsing dijalankan via BackgroundTasks supaya
client tidak blocking saat file besar (PDF berhalaman banyak, image OCR).
"""

from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_session
from app.import_data import service
from app.import_data.models import ImportSourceType
from app.import_data.schemas import (
	ImportConfirmResponse,
	ImportJobDetailResponse,
	ImportJobResponse,
	ImportRowResponse,
	ImportRowUpdate,
)
from app.users.models import User


router = APIRouter()


@router.post(
	"/upload",
	response_model=ImportJobResponse,
	status_code=status.HTTP_202_ACCEPTED,
)
async def upload(
	background_tasks: BackgroundTasks,
	file: UploadFile = File(...),
	source_type: ImportSourceType = Form(...),
	account_id: UUID | None = Form(default=None),
	user: User = Depends(get_current_user),
	session: AsyncSession = Depends(get_session),
):
	file_bytes = await file.read()
	job = await service.create_job(
		session,
		user,
		source_type=source_type,
		account_id=account_id,
		file_name=file.filename or "upload",
		file_size=len(file_bytes),
		mime_type=file.content_type,
		file_bytes=file_bytes,
	)
	# Background task: buka session sendiri, tidak share dengan request session.
	background_tasks.add_task(service.process_job, job.id)
	return job


@router.get("/jobs", response_model=list[ImportJobResponse])
async def list_jobs(
	user: User = Depends(get_current_user),
	session: AsyncSession = Depends(get_session),
):
	return await service.list_jobs(session, user)


@router.get("/jobs/{job_id}", response_model=ImportJobDetailResponse)
async def get_job(
	job_id: UUID,
	user: User = Depends(get_current_user),
	session: AsyncSession = Depends(get_session),
):
	job = await service.get_job(session, user, job_id)
	rows = service.visible_rows(job)
	return ImportJobDetailResponse(
		id=job.id,
		source_type=job.source_type,
		status=job.status,
		file_name=job.file_name,
		account_id=job.account_id,
		rows_total=job.rows_total,
		rows_ok=job.rows_ok,
		rows_warn=job.rows_warn,
		rows_err=job.rows_err,
		created_at=job.created_at,
		confirmed_at=job.confirmed_at,
		error_message=job.error_message,
		items=[ImportRowResponse.model_validate(r) for r in rows],
	)


@router.patch(
	"/jobs/{job_id}/rows/{row_id}",
	response_model=ImportRowResponse,
)
async def update_row(
	job_id: UUID,
	row_id: UUID,
	data: ImportRowUpdate,
	user: User = Depends(get_current_user),
	session: AsyncSession = Depends(get_session),
):
	return await service.update_row(session, user, job_id, row_id, data)


@router.delete(
	"/jobs/{job_id}/rows/{row_id}",
	status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_row(
	job_id: UUID,
	row_id: UUID,
	user: User = Depends(get_current_user),
	session: AsyncSession = Depends(get_session),
) -> None:
	await service.exclude_row(session, user, job_id, row_id)


@router.post("/jobs/{job_id}/confirm", response_model=ImportConfirmResponse)
async def confirm_job(
	job_id: UUID,
	background_tasks: BackgroundTasks,
	user: User = Depends(get_current_user),
	session: AsyncSession = Depends(get_session),
):
	return await service.confirm_job(session, user, job_id, background_tasks)


@router.post(
	"/jobs/{job_id}/cancel",
	status_code=status.HTTP_204_NO_CONTENT,
)
async def cancel_job(
	job_id: UUID,
	user: User = Depends(get_current_user),
	session: AsyncSession = Depends(get_session),
) -> None:
	await service.cancel_job(session, user, job_id)
