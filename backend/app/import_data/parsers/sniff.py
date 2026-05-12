"""MIME detection + BNI signature peek — pure utilities for dispatcher.

sniff_mime: magic-byte detection (PNG/JPEG/WebP/PDF) + CSV heuristic.
has_bni_signature: open PDF with pdfplumber, check page 1 text for BNI markers.

Tidak depend ke parser classes (penghindaran circular import). Dispatcher
yang nge-link sniff result ke parser.
"""

import io

import pdfplumber


def sniff_mime(file_bytes: bytes) -> str | None:
	"""Magic-byte MIME detection. Returns None kalau format tidak dikenal."""
	if not file_bytes:
		return None
	if file_bytes[:8] == b"\x89PNG\r\n\x1a\n":
		return "image/png"
	if file_bytes[:3] == b"\xff\xd8\xff":
		return "image/jpeg"
	if len(file_bytes) >= 12 and file_bytes[:4] == b"RIFF" and file_bytes[8:12] == b"WEBP":
		return "image/webp"
	if file_bytes[:5] == b"%PDF-":
		return "application/pdf"
	if _looks_like_csv(file_bytes):
		return "text/csv"
	return None


def _looks_like_csv(file_bytes: bytes) -> bool:
	"""Heuristic: decodes as UTF-8, has line breaks, first line has delimiter."""
	sample = file_bytes[:5120]
	try:
		text = sample.decode("utf-8-sig")
	except UnicodeDecodeError:
		try:
			text = sample.decode("utf-8")
		except UnicodeDecodeError:
			return False

	# Must have line breaks (any flavor).
	if "\n" not in text and "\r" not in text:
		return False

	# Find first non-empty line (handle CR, LF, CRLF).
	normalized = text.replace("\r\n", "\n").replace("\r", "\n")
	lines = [l for l in normalized.split("\n") if l]
	if not lines:
		return False
	first_line = lines[0]

	# Must have at least one common delimiter on the first line.
	delim_counts = {d: first_line.count(d) for d in (",", ";", "\t", "|")}
	return max(delim_counts.values()) > 0


def has_bni_signature(file_bytes: bytes) -> bool:
	"""Open PDF, peek page 1 text, return True kalau match BNI marker.

	BNI e-Statement (PDFium-generated via wondr app) selalu punya:
	- "Laporan Mutasi Rekening" header
	- Branding "wondr" atau " BNI " (with word boundaries)

	Defensive: kalau pdfplumber error atau text kosong (image-only PDF) → False.
	"""
	try:
		with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
			if not pdf.pages:
				return False
			raw = pdf.pages[0].extract_text() or ""
			text = raw.lower()
	except Exception:
		return False
	if "laporan mutasi rekening" not in text:
		return False
	# Use space-padded match for " bni " to avoid substring false-positives
	# like "BNIDAGANG" or merchant names containing "bni".
	padded = f" {text} "
	return "wondr" in text or " bni " in padded
