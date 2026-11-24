"""New database records must survive static generation in every language."""
import importlib.util
import json
from pathlib import Path
import re
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("core_public_build", ROOT / "tools" / "build_site.py")
BUILD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILD)
PUBLIC = BUILD.public_data


class PublicRecordTests(unittest.TestCase):
    def test_university_rankings_count_published_external_cards_and_known_work_counts(self):
        universities = [{"id": uid, "works_count": n} for uid, n in [("A", 1), ("B", 1), ("C", 0), ("D", None)]]
        card = {"id": "one", "organization_id": "A", "category": "Medicine", "kind": "open", "publication_status": "published"}
        records = [card, card, dict(card, id="two", category="Computer Science"), dict(card, id="three", organization_id="D"),
                   dict(card, id="demo", kind="prep"), dict(card, id="private", publication_status="draft"),
                   dict(card, id="unknown", organization_id="other")]
        result = BUILD.rankings.collect(universities, records, None)
        def positions(rows):
            return [(row["id"], row["value"], row["place"]) for row in rows]
        self.assertEqual(positions(result["works"]), [("A", 1, 1), ("B", 1, 1), ("C", 0, 3)])
        self.assertEqual(positions(result["open"][""]), [("A", 2, 1), ("D", 1, 2)])
        self.assertEqual(positions(result["open"]["Medicine"]), [("A", 1, 1), ("D", 1, 1)])

    def test_landing_uses_first_three_of_each_full_ranking_in_all_languages(self):
        BUILD.build()
        def payload(path):
            page = BUILD.OUT[path].decode("utf-8")
            return json.loads(re.search(r'<script type="application/json" data-ranking-lists>(.*?)</script>', page, re.S)[1])
        for prefix in ("", "ru/", "uz/"):
            full = payload(prefix + "rankings.html")
            preview = payload(prefix + "index.html")
            self.assertEqual(preview["works"], full["works"][:3])
            self.assertEqual(preview["open"], {key: rows[:3] for key, rows in full["open"].items()})

    def test_catalog_metrics_count_public_datasets_unique_organizations_and_known_sizes(self):
        rows = [
            {"id": "one", "organization_id": "ORG-A", "publication_status": "published", "record_count": 10},
            {"id": "two", "organization_id": "ORG-A", "publication_status": "published", "record_count": None},
            {"id": "three", "organization_id": "ORG-B", "publication_status": "published", "record_count": 0},
            {"id": "private", "organization_id": "ORG-C", "publication_status": "draft", "record_count": 999},
        ]
        with patch.object(PUBLIC, "SNAPSHOT", {"datasets": rows}):
            self.assertEqual(PUBLIC.catalog_metrics(), {"datasets": 3, "organizations": 2, "records": 10, "sized_datasets": 2})
            for lang in ["en", "ru", "uz"]:
                rendered = PUBLIC.metrics_html(lang)
                self.assertEqual(rendered.count('class="catalog-scale-item"'), 3)
                self.assertNotIn("data-count", rendered)
                self.assertNotIn("999", rendered)
        with patch.object(PUBLIC, "SNAPSHOT", {"datasets": [rows[1]]}):
            self.assertIn('class="catalog-scale-value">—', PUBLIC.metrics_html("ru"))

    def test_source_and_preparation_links_keep_the_existing_organization_id(self):
        row = {"organization_id": "UNI-UZ-0180", "organization": {"name": "University <source>"}, "kind": "prep"}
        for lang in ["en", "ru", "uz"]:
            rendered = PUBLIC.provenance_html(row, lang)
            self.assertIn("organization.html?id=UNI-UZ-0180", rendered)
            self.assertIn("organization.html?id=ORG-CORE", rendered)
            self.assertIn("University &lt;source&gt;", rendered)

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

    def test_card_shows_only_available_sections_and_keeps_access_terms(self):
        row = dict(PUBLIC.SNAPSHOT["datasets"][0])
        row.update(id="card-test", kind="dataset", token_count=None, source_url="https://example.org/source",
                   links=[{"type": "data", "url": "https://example.org/files"}, {"type": "code", "url": "https://example.org/code"}])
        row["license_id"] = "metadata-only"
        page = PUBLIC.record_html(row, "ru")
        self.assertNotIn('id="sheet-data"', page)
        self.assertNotIn('id="sheet-api"', page)
        self.assertNotIn("https://example.org/files", page)
        self.assertIn("https://example.org/code", page)
        row.update(license_id="open-cc-by-4-0", token_count=0, tokenizer="test-v1")
        page = PUBLIC.record_html(row, "ru")
        self.assertIn('<dt>Количество токенов</dt><dd>0</dd>', page)
        self.assertIn('class="sheet-primary" href="https://example.org/files"', page)
        self.assertIn('href="https://example.org/source"', page)

    def test_base_cards_distinguish_full_registry_and_public_samples(self):
        for ds in BUILD.CAT:
            with self.subTest(dataset=ds["slug"]):
                page = BUILD.base_details(ds, "ru")
                section_ids = [page.index('id="sheet-' + name + '"') for name in ("data", "api", "passport", "access")]
                self.assertEqual(section_ids, sorted(section_ids))
                self.assertEqual(page.count('class="sheet-section" open'), 1)
                self.assertIn("Весь справочник" if ds["slug"] == "universities" else "Открытый образец", page)
                self.assertIn('href="../api/v0/datasets/' + ds["slug"] + '/sample.json"', page)


if __name__ == "__main__":
    unittest.main()
