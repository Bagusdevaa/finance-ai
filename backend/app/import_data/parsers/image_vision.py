"""Image vision parser via Groq Llama 3.2 Vision.

TODO: implement when GROQ_API_KEY wiring + prompt is finalized.
"""

from app.import_data.models import ImportSourceType
from app.import_data.parsers.base import ParsedRow, register


@register(ImportSourceType.image_vision.value)
class ImageVisionParser:
	def parse(self, file_bytes: bytes) -> list[ParsedRow]:
		raise NotImplementedError(
			"Image Vision parser belum diimplementasikan; pakai manual_csv untuk sekarang"
		)
