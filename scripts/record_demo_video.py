#!/usr/bin/env python3
"""Record a short demo video of the KAN-146 Analytics heatmap UI."""

from __future__ import annotations

import shutil
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS_DIR = ROOT / "artifacts"
WEBM_PATH = ARTIFACTS_DIR / "kan-146-ui-demo.webm"
MP4_PATH = ARTIFACTS_DIR / "kan-146-ui-demo.mp4"
BASE_URL = "http://127.0.0.1:8080/"


def is_server_up() -> bool:
    try:
        with urllib.request.urlopen(BASE_URL, timeout=1.5) as response:
            return response.status == 200
    except (urllib.error.URLError, TimeoutError):
        return False


def wait_for_server(timeout_s: float = 15.0) -> bool:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        if is_server_up():
            return True
        time.sleep(0.4)
    return False


def convert_to_mp4(src: Path, dst: Path) -> bool:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return False
    result = subprocess.run(
        [
            ffmpeg,
            "-y",
            "-i",
            str(src),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(dst),
        ],
        capture_output=True,
        text=True,
    )
    return result.returncode == 0


def main() -> int:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    WEBM_PATH.unlink(missing_ok=True)
    MP4_PATH.unlink(missing_ok=True)

    spawned_server = None
    if not is_server_up():
        spawned_server = subprocess.Popen(
            ["python3", "server.py"],
            cwd=str(ROOT),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if not wait_for_server():
            if spawned_server.poll() is None:
                spawned_server.terminate()
            raise RuntimeError("Server did not become ready in time")

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            context = browser.new_context(
                viewport={"width": 1440, "height": 900},
                record_video_dir=str(ARTIFACTS_DIR),
                record_video_size={"width": 1440, "height": 900},
            )
            page = context.new_page()
            page.goto(BASE_URL, wait_until="networkidle")

            # Show tasks shell briefly, then switch to analytics.
            page.wait_for_timeout(1200)
            page.click('[data-page-link="analytics"]')
            page.wait_for_timeout(1200)
            page.wait_for_selector("#heatmapGrid .heatmap-cell", timeout=7000)

            # Hover a couple of cells to demonstrate tooltip-enabled cells.
            cells = page.locator("#heatmapGrid .heatmap-cell")
            total_cells = cells.count()
            if total_cells > 5:
                cells.nth(total_cells // 2).hover()
                page.wait_for_timeout(700)
                cells.nth(total_cells - 3).hover()
                page.wait_for_timeout(700)

            # Pause on final analytics state.
            page.wait_for_timeout(1800)
            video_path = Path(page.video.path())
            context.close()
            browser.close()

        shutil.move(str(video_path), str(WEBM_PATH))
    finally:
        if spawned_server and spawned_server.poll() is None:
            spawned_server.terminate()

    convert_to_mp4(WEBM_PATH, MP4_PATH)
    print(f"webm={WEBM_PATH}")
    if MP4_PATH.exists():
        print(f"mp4={MP4_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
