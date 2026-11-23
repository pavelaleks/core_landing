"""Native module versions must work under language and GitHub Pages prefixes."""
import importlib.util
import json
from pathlib import Path
import re
import shutil
import tempfile
import unittest
import uuid


PROJECT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("core_site_build", PROJECT / "tools" / "build_site.py")
BUILD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILD)


class ModuleVersionTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.gettempdir()) / ("core-module-versions-" + uuid.uuid4().hex)
        self.root.mkdir()
        self.original_root = BUILD.ROOT
        BUILD.ROOT = str(self.root)
        (self.root / "assets" / "js" / "pages").mkdir(parents=True)
        (self.root / "app").mkdir()
        (self.root / "assets" / "catalog-page.js").write_text(
            'import "./js/pages/catalog.js";', encoding="utf-8"
        )
        (self.root / "assets" / "js" / "pages" / "catalog.js").write_text(
            "export const version = 1;", encoding="utf-8"
        )
        (self.root / "app" / "app.js").write_text(
            'import "../assets/js/pages/catalog.js";', encoding="utf-8"
        )

    def tearDown(self):
        BUILD.ROOT = self.original_root
        self.assertEqual(self.root.resolve().parent, Path(tempfile.gettempdir()).resolve())
        self.assertTrue(self.root.name.startswith("core-module-versions-"))
        shutil.rmtree(self.root)

    def mapping(self, html):
        match = re.search(r'<script type="importmap" data-core-modules>(.*?)</script>', html)
        return json.loads(match.group(1))["imports"]

    def test_language_paths_and_repeated_builds(self):
        html = '<main>Каталог</main>\n<script type="module" src="../assets/catalog-page.js"></script>'
        output = BUILD.version_modules(html, "ru")
        self.assertIn("../assets/js/pages/catalog.js", self.mapping(output))
        self.assertEqual(BUILD.version_modules(output, "ru"), output)
        self.assertEqual(output.count("data-core-modules"), 1)
        self.assertIn("<main>Каталог</main>", output)

    def test_dependency_edit_changes_import_url_with_an_unchanged_entry(self):
        html = '<script type="module" src="assets/catalog-page.js"></script>'
        first = BUILD.version_modules(html, "")
        (self.root / "assets" / "js" / "pages" / "catalog.js").write_text(
            "export const version = 2;", encoding="utf-8"
        )
        second = BUILD.version_modules(first, "")
        key = "./assets/js/pages/catalog.js"
        self.assertNotEqual(self.mapping(first)[key], self.mapping(second)[key])
        self.assertEqual(
            re.search(r'<script type="module" src="([^"]+)"', first).group(1),
            re.search(r'<script type="module" src="([^"]+)"', second).group(1),
        )

    def test_cabinet_entry_and_existing_vendor_import_maps(self):
        vendor = '<script type="importmap">{"imports":{"three":"https://example.test/three.js"}}</script>'
        html = vendor + '\n<script type="module" src="app.js?v=old"></script>'
        output = BUILD.version_modules(html, "app")
        self.assertIn(vendor, output)
        self.assertIn("../assets/js/pages/catalog.js", self.mapping(output))
        self.assertNotIn("app.js?v=old", output)


if __name__ == "__main__":
    unittest.main()
