"""Refresh official RuStore screenshots and build lossless, responsive WebP assets.

Requires Python 3 and Pillow. No RuStore/CDN requests are made by the website.
"""
from __future__ import annotations

import argparse
import base64
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
from html import unescape
from io import BytesIO
import json
from pathlib import Path
import re
import shutil
import tempfile
import time
from urllib.request import Request, urlopen

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
APPS = {
    "stories": ("magical-stories", "com.volshebnye.istorii"),
    "keys": ("hanzi-keys", "com.enotessa.chinesekeys"),
    "bloom": ("hanzi-bloom", "com.enotessa.hanzi"),
    "muropolis": ("muropolis", "com.cozyraccoon.muropolis"),
    "neon": ("neon-cyber-wall-kicker", "com.enotessa.neoncyberwallkicker"),
    "food": ("what-to-eat", "com.whatoeat.app"),
    "dokupit": ("dokupit", "com.cozyraccoon.dokupit"),
}
SOURCE_RE = re.compile(r"https://static\.rustore\.ru/\d{4}/\d{1,2}/\d{1,2}/[^/\s\"<>\\]+/apk/(\d+)/content/SCREENSHOT/[a-fA-F0-9-]+\.(?:png|jpe?g|webp)")


def download(url: str) -> bytes:
    for attempt in range(3):
        try:
            request = Request(url, headers={"User-Agent": "RaccoonAppLabs-AssetUpdater/1.0"})
            with urlopen(request, timeout=30) as response:
                return response.read()
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))
    raise AssertionError("unreachable")


def source_urls(markup: str) -> list[str]:
    # The public store now uses React server components, rather than __NEXT_DATA__.
    # Its first screenshot preload belongs to the requested app. Exclude recommendations.
    normalized = unescape(markup).replace("\\/", "/")
    found = list(SOURCE_RE.finditer(normalized))
    if not found:
        raise ValueError("RuStore returned no screenshots; refusing to replace existing assets")
    app_id = found[0].group(1)
    return list(dict.fromkeys(m.group(0) for m in found if m.group(1) == app_id))


def encode(image: Image.Image, path: Path) -> None:
    image.save(path, "WEBP", lossless=True, method=6, exact=True)


def build_screen(job: tuple[str, int, str, Path]) -> dict:
    slug, number, url, stage = job
    data = download(url)
    with Image.open(BytesIO(data)) as opened:
        image = ImageOps.exif_transpose(opened)
        image = image.convert("RGBA" if "A" in image.getbands() or "transparency" in image.info else "RGB")
        width, height = image.size
        if min(width, height) < 100:
            raise ValueError(f"Unexpected screenshot dimensions for {url}: {image.size}")
        prefix = f"{number:02d}"
        original = stage / f"{prefix}-hq.webp"
        encode(image, original)
        variants = []
        for suffix, target in [("", 480 if width > height else 320), ("-medium", 960 if width > height else 640)]:
            resized = image.copy()
            resized.thumbnail((min(target, width), height), Image.Resampling.LANCZOS)
            path = stage / f"{prefix}{suffix}.webp"
            encode(resized, path)
            revision = hashlib.sha256(path.read_bytes()).hexdigest()[:12]
            variants.append({"src": f"/assets/screens/{slug}/ru/{path.name}?v={revision}",
                             "width": resized.width, "height": resized.height, "bytes": path.stat().st_size})
        tiny = image.copy()
        tiny.thumbnail((96 if width > height else 48, height), Image.Resampling.LANCZOS)
        buffer = BytesIO()
        tiny.save(buffer, "WEBP", lossless=True, method=6)
        original_revision = hashlib.sha256(original.read_bytes()).hexdigest()[:12]
        return {"index": number, "source": url, "width": width, "height": height,
                "original": f"/assets/screens/{slug}/ru/{original.name}?v={original_revision}",
                "originalBytes": original.stat().st_size, "variants": variants,
                "placeholder": "data:image/webp;base64," + base64.b64encode(buffer.getvalue()).decode()}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--html-dir", type=Path, help="Use store HTML fetched during the current refresh")
    args = parser.parse_args()
    manifest = {"updatedAt": datetime.now(timezone.utc).isoformat(), "apps": {}}
    temporary_root = Path(tempfile.gettempdir()).resolve()
    with tempfile.TemporaryDirectory(prefix="raccoon-store-screens-", dir=temporary_root) as temporary:
        temporary = Path(temporary).resolve()
        if temporary.parent != temporary_root or not temporary.name.startswith("raccoon-store-screens-"):
            raise ValueError("Unexpected staging directory")
        jobs = []
        for key, (slug, package) in APPS.items():
            store = f"https://www.rustore.ru/catalog/app/{package}"
            markup = ((args.html_dir / f"{key}.html").read_text(encoding="utf-8")
                      if args.html_dir else download(store).decode("utf-8"))
            urls = source_urls(markup)
            if not 2 <= len(urls) <= 20:
                raise ValueError(f"Unexpected number of screenshots for {key}: {len(urls)}")
            stage = temporary / slug
            stage.mkdir()
            manifest["apps"][slug] = {"key": key, "package": package, "store": store, "screens": []}
            jobs.extend((slug, i, url, stage) for i, url in enumerate(urls, 1))
            print(f"{slug}: {len(urls)} official screenshots", flush=True)
        with ThreadPoolExecutor(max_workers=3) as pool:
            for (slug, number, _, _), result in zip(jobs, pool.map(build_screen, jobs)):
                manifest["apps"][slug]["screens"].append(result)
                print(f"{slug}/{number:02d}: {result['width']}x{result['height']} -> "
                      f"{result['variants'][0]['bytes']} B preview", flush=True)
        # Publish the complete collection only after every download and conversion succeeds.
        for slug in manifest["apps"]:
            target = ROOT / "assets/screens" / slug / "ru"
            target.mkdir(parents=True, exist_ok=True)
            for path in (temporary / slug).glob("*.webp"):
                shutil.copy2(path, target / path.name)
        (ROOT / "assets/screens/manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("All screenshots refreshed; original resolution and alpha retained in HQ WebP.", flush=True)


if __name__ == "__main__":
    main()
