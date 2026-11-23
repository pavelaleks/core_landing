"""Native module versions must work under language and GitHub Pages prefixes."""
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import shutil
import tempfile
import unittest
import uuid
from unittest.mock import patch


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
        (self.root / "assets" / "account-session.js").write_text(
            'import "./js/pages/catalog.js";', encoding="utf-8"
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

    def test_auth_bootstrap_and_catalog_entries_share_one_map(self):
        html = '<script type="module" src="../assets/catalog-page.js"></script>\n' + \
               '<script type="module" src="../assets/account-session.js"></script>'
        output = BUILD.version_modules(html, "ru")
        self.assertEqual(output.count("data-core-modules"), 1)
        self.assertRegex(output, r'catalog-page\.js\?v=[a-f0-9]{8}')
        self.assertRegex(output, r'account-session\.js\?v=[a-f0-9]{8}')
        self.assertEqual(BUILD.version_modules(output, "ru"), output)

    def test_auth_bootstrap_resolves_on_dataset_pages(self):
        html = '<script type="module" src="../../assets/account-session.js"></script>'
        output = BUILD.version_modules(html, "ru/datasets")
        self.assertIn("../../assets/js/pages/catalog.js", self.mapping(output))
        self.assertRegex(output, r'account-session\.js\?v=[a-f0-9]{8}')


class BuildLineEndingTests(unittest.TestCase):
    def test_windows_and_linux_text_assets_generate_identical_files(self):
        real_open = open

        def build_with_line_endings(newline):
            def asset_open(file, mode="r", *args, **kwargs):
                with real_open(file, mode, *args, **kwargs) as source:
                    data = source.read()
                text_asset = isinstance(file, (str, os.PathLike)) and Path(file).suffix in (".js", ".css")
                if "b" in mode:
                    if text_asset:
                        data = data.replace(b"\r\n", b"\n").replace(b"\n", newline)
                    return io.BytesIO(data)
                return io.StringIO(data)

            BUILD._VER.clear()
            with patch("builtins.open", asset_open):
                BUILD.build()
            return dict(BUILD.OUT)

        try:
            linux = build_with_line_endings(b"\n")
            windows = build_with_line_endings(b"\r\n")
            different = sorted(path for path in linux if linux[path] != windows[path])
            self.assertEqual(different, [], "Generated files depend on CSS/JavaScript line endings")
        finally:
            BUILD._VER.clear()
            BUILD.OUT.clear()


if __name__ == "__main__":
    unittest.main()
