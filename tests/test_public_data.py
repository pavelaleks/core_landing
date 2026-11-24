"""New database records must survive static generation in every language."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("core_public_build", ROOT / "tools" / "build_site.py")
BUILD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILD)
PUBLIC = BUILD.public_data


class PublicRecordTests(unittest.TestCase):
    def test_shared_license_is_rendered_in_each_language_without_rewriting_source_licenses(self):
        row = dict(PUBLIC.SNAPSHOT["datasets"][0])
        source_license = row["license"]
        license = {"id": "metadata-only", "version": "1.2", "document_path": "documents/metadata-only.html",
                   "name": {"en": "Metadata only", "ru": "Только метаданные", "uz": "Faqat metamaʼlumotlar"},
                   "description": {"en": "Description only", "ru": "Только описание", "uz": "Faqat tavsif"}}
        row.update(license_id=license["id"], license_info=license)
        for lang in ["en", "ru", "uz"]:
            page = PUBLIC.record_html(row, lang)
            self.assertIn(license["name"][lang], page)
            self.assertIn(license["description"][lang], page)
            self.assertIn(("../" if lang == "en" else "../../") + license["document_path"], page)
        self.assertEqual(PUBLIC.catalog_item(row)["license"], license)
        self.assertEqual(row["license"], source_license)
        self.assertIn('"license": "https://example.org/documents/metadata-only.html"', PUBLIC.new_dataset_page(row, "", "", "https://example.org/"))

    def test_published_user_record_has_pages_schema_and_catalog_from_the_same_snapshot(self):
        row = dict(PUBLIC.SNAPSHOT["datasets"][0])
        row.update(id="DS-static-test", kind="dataset", source_url=None,
                   title={"en": "New <dataset>", "ru": "Новый <датасет>", "uz": "Yangi toʻplam"},
                   description={"ru": "Текст <script>alert(1)</script>"}, organization={"id": "ORG-example", "name": "Example"},
                   usage_terms={"ru": "Указывайте источник"}, token_count=0, tokenizer="example@1", token_method="calculated", token_material="text", data_version="1")
        snapshot = {"version": 1, "datasets": [row], "usage": []}
        with patch.object(PUBLIC, "SNAPSHOT", snapshot), patch.dict(PUBLIC.RECORDS, {row["id"]: row}, clear=True):
            BUILD.build()
            for language, prefix in [("en", ""), ("ru", "ru/"), ("uz", "uz/")]:
                html = BUILD.OUT[prefix + "datasets/DS-static-test.html"].decode("utf-8")
                self.assertIn("schema.org", html)
                self.assertIn(PUBLIC.esc(row["title"][language]), html)
                self.assertNotIn("<script>alert(1)</script>", html)
                self.assertIn("DS-static-test", BUILD.OUT["sitemap.xml"].decode("utf-8"))
            self.assertIn("DS-static-test", BUILD.OUT["assets/catalog-index.js"].decode("utf-8"))
            self.assertIn("DS-static-test", BUILD.OUT["api/v0/public-catalog.json"].decode("utf-8"))


if __name__ == "__main__":
    unittest.main()
