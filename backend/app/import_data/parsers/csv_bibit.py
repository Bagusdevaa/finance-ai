"""Bibit CSV parser. TODO: implement when sample export CSVs are available."""

from app.import_data.models import ImportSourceType
from app.import_data.parsers.base import ParsedRow, register


@register(ImportSourceType.csv_bibit.value)
class CsvBibitParser:
	def parse(self, file_bytes: bytes) -> list[ParsedRow]:
		raise NotImplementedError(
			"CSV Bibit parser belum diimplementasikan; pakai manual_csv untuk sekarang"
		)
