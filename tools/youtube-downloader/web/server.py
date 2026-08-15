#!/usr/bin/env python3
"""유튜브 다운로더 웹앱 (로컬 실행용).

브라우저에서 주소를 넣으면 서버가 내려받고, 진행률을 실시간으로 보여준 뒤
완성된 파일을 브라우저로 내려받을 수 있게 해 줍니다.

    python server.py            # http://127.0.0.1:8765 자동 열림
    python server.py --port 9000 --no-browser

기본적으로 127.0.0.1 에만 바인딩하므로 같은 PC에서만 접속됩니다.
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import threading
import uuid
import webbrowser
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ytdl import DEFAULT_OUTPUT_DIR, build_options  # noqa: E402

try:
    from yt_dlp import YoutubeDL
except ImportError:  # pragma: no cover - 설치 안내용
    sys.exit("yt-dlp 가 설치되어 있지 않습니다.  pip install -r ../requirements.txt")

STATIC_DIR = Path(__file__).resolve().parent
MAX_LOG_LINES = 200


class Job:
    """다운로드 작업 하나의 상태."""

    def __init__(self, url: str, options: dict) -> None:
        self.id = uuid.uuid4().hex[:12]
        self.url = url
        self.options = options
        self.status = "대기 중"
        self.state = "queued"  # queued | running | done | error | cancelled
        self.percent = 0.0
        self.title = url
        self.speed = ""
        self.eta = ""
        self.files: list[Path] = []
        self.error = ""
        self.log: list[str] = []
        self.created_at = datetime.now().strftime("%H:%M:%S")
        self.cancel = threading.Event()
        self.lock = threading.Lock()

    def add_log(self, line: str) -> None:
        with self.lock:
            self.log.append(line)
            del self.log[:-MAX_LOG_LINES]

    def to_dict(self) -> dict:
        with self.lock:
            return {
                "id": self.id,
                "url": self.url,
                "title": self.title,
                "state": self.state,
                "status": self.status,
                "percent": round(self.percent, 1),
                "speed": self.speed,
                "eta": self.eta,
                "error": self.error,
                "createdAt": self.created_at,
                "files": [
                    {"name": f.name, "size": f.stat().st_size if f.exists() else 0}
                    for f in self.files
                ],
                "log": self.log[-40:],
            }


class JobManager:
    def __init__(self) -> None:
        self.jobs: dict[str, Job] = {}
        self.order: list[str] = []
        self.lock = threading.Lock()

    def add(self, job: Job) -> None:
        with self.lock:
            self.jobs[job.id] = job
            self.order.insert(0, job.id)

    def get(self, job_id: str) -> Job | None:
        with self.lock:
            return self.jobs.get(job_id)

    def list(self) -> list[dict]:
        with self.lock:
            jobs = [self.jobs[i] for i in self.order]
        return [job.to_dict() for job in jobs]

    def clear_finished(self) -> None:
        with self.lock:
            keep = [i for i in self.order if self.jobs[i].state in {"queued", "running"}]
            self.jobs = {i: self.jobs[i] for i in keep}
            self.order = keep


MANAGER = JobManager()


class _Cancelled(Exception):
    """진행 훅에서 취소를 알리기 위한 예외."""


class _JobLogger:
    def __init__(self, job: Job) -> None:
        self.job = job

    def debug(self, msg: str) -> None:
        if msg and not msg.startswith("[debug]"):
            self.job.add_log(msg)

    def info(self, msg: str) -> None:
        self.debug(msg)

    def warning(self, msg: str) -> None:
        self.job.add_log(f"[경고] {msg}")

    def error(self, msg: str) -> None:
        self.job.add_log(f"[오류] {msg}")


def run_job(job: Job) -> None:
    """백그라운드 스레드에서 실제 다운로드를 수행한다."""

    def progress_hook(data: dict) -> None:
        if job.cancel.is_set():
            raise _Cancelled
        if data["status"] == "downloading":
            total = data.get("total_bytes") or data.get("total_bytes_estimate")
            if total:
                job.percent = data.get("downloaded_bytes", 0) / total * 100
            job.speed = (data.get("_speed_str") or "").strip()
            job.eta = (data.get("_eta_str") or "").strip()
            job.status = f"내려받는 중 — {Path(data.get('filename', '')).name}"
        elif data["status"] == "finished":
            job.percent = 100.0
            job.status = "변환/병합 중..."

    job.options["progress_hooks"] = [progress_hook]
    job.options["logger"] = _JobLogger(job)

    job.state = "running"
    job.status = "정보를 가져오는 중..."
    try:
        with YoutubeDL(job.options) as ydl:
            info = ydl.extract_info(job.url, download=True)

        job.title = info.get("title") or job.url
        job.files = _collect_files(info)
        job.state = "done"
        job.percent = 100.0
        job.status = "완료"
    except _Cancelled:
        job.state = "cancelled"
        job.status = "취소됨"
    except Exception as exc:  # noqa: BLE001 - 화면에 그대로 보여준다
        if job.cancel.is_set():
            job.state = "cancelled"
            job.status = "취소됨"
        else:
            job.state = "error"
            job.status = "실패"
            job.error = str(exc)


def _collect_files(info: dict) -> list[Path]:
    """다운로드 결과에서 실제로 만들어진 파일 목록을 뽑아낸다."""
    entries = info.get("entries") if info.get("_type") == "playlist" else [info]
    files: list[Path] = []
    for entry in entries or []:
        if not entry:
            continue
        for requested in entry.get("requested_downloads") or []:
            path = requested.get("filepath")
            if path and Path(path).exists():
                files.append(Path(path))
    return files


def fetch_info(url: str) -> dict:
    """다운로드 없이 제목/길이/화질만 조회한다."""
    options = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "logger": _SilentLogger(),
    }
    with YoutubeDL(options) as ydl:
        info = ydl.extract_info(url, download=False)

    heights = sorted({f["height"] for f in info.get("formats", []) if f.get("height")}, reverse=True)
    return {
        "title": info.get("title"),
        "uploader": info.get("uploader"),
        "duration": info.get("duration"),
        "thumbnail": info.get("thumbnail"),
        "viewCount": info.get("view_count"),
        "uploadDate": info.get("upload_date"),
        "qualities": [f"{h}p" for h in heights],
    }


class _SilentLogger:
    def debug(self, msg: str) -> None: ...
    def info(self, msg: str) -> None: ...
    def warning(self, msg: str) -> None: ...
    def error(self, msg: str) -> None: ...


class Handler(BaseHTTPRequestHandler):
    server_version = "YtdlWeb/1.0"

    # --- 응답 도우미 -------------------------------------------------
    def _json(self, payload: dict | list, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        if not length:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return {}

    def log_message(self, fmt: str, *args) -> None:  # 콘솔을 조용하게
        pass

    # --- 라우팅 -----------------------------------------------------
    def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler 규약
        parsed = urlparse(self.path)
        path = parsed.path

        if path in {"/", "/index.html"}:
            self._serve_static("index.html")
        elif path == "/api/jobs":
            self._json(MANAGER.list())
        elif path.startswith("/api/jobs/") and path.endswith("/file"):
            self._serve_result(path.split("/")[3], parse_qs(parsed.query))
        else:
            self._json({"error": "찾을 수 없습니다."}, 404)

    def do_POST(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler 규약
        path = urlparse(self.path).path

        if path == "/api/info":
            self._handle_info()
        elif path == "/api/jobs":
            self._handle_create_job()
        elif path.startswith("/api/jobs/") and path.endswith("/cancel"):
            self._handle_cancel(path.split("/")[3])
        elif path == "/api/jobs/clear":
            MANAGER.clear_finished()
            self._json({"ok": True})
        else:
            self._json({"error": "찾을 수 없습니다."}, 404)

    # --- 핸들러 -----------------------------------------------------
    def _serve_static(self, name: str) -> None:
        target = STATIC_DIR / name
        if not target.exists():
            self._json({"error": "파일이 없습니다."}, 404)
            return
        body = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _handle_info(self) -> None:
        url = (self._read_json().get("url") or "").strip()
        if not url:
            self._json({"error": "주소를 입력해 주세요."}, 400)
            return
        try:
            self._json(fetch_info(url))
        except Exception as exc:  # noqa: BLE001 - 사용자에게 사유를 보여준다
            self._json({"error": str(exc)}, 502)

    def _handle_create_job(self) -> None:
        data = self._read_json()
        urls = [u.strip() for u in (data.get("urls") or []) if u.strip()]
        if not urls:
            self._json({"error": "주소를 입력해 주세요."}, 400)
            return

        output_dir = Path(data.get("outputDir") or DEFAULT_OUTPUT_DIR).expanduser()
        try:
            output_dir.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            self._json({"error": f"저장 폴더를 만들 수 없습니다: {exc}"}, 400)
            return

        quality = data.get("quality")
        created = []
        for url in urls:
            options = build_options(
                output_dir,
                audio_only=data.get("mode") == "audio",
                audio_format=data.get("audioFormat") or "mp3",
                max_height=int(quality) if quality else None,
                playlist=bool(data.get("playlist")),
                subtitles=bool(data.get("subtitles")),
                thumbnail=bool(data.get("thumbnail")),
                quiet=True,
            )
            job = Job(url, options)
            MANAGER.add(job)
            threading.Thread(target=run_job, args=(job,), daemon=True).start()
            created.append(job.id)

        self._json({"ids": created})

    def _handle_cancel(self, job_id: str) -> None:
        job = MANAGER.get(job_id)
        if not job:
            self._json({"error": "작업을 찾을 수 없습니다."}, 404)
            return
        job.cancel.set()
        job.status = "취소하는 중..."
        self._json({"ok": True})

    def _serve_result(self, job_id: str, query: dict) -> None:
        job = MANAGER.get(job_id)
        if not job or not job.files:
            self._json({"error": "받을 수 있는 파일이 없습니다."}, 404)
            return

        wanted = unquote((query.get("name") or [""])[0])
        target = next((f for f in job.files if f.name == wanted), job.files[0])
        if not target.exists():
            self._json({"error": "파일이 사라졌습니다."}, 404)
            return

        ctype = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        size = target.stat().st_size
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(size))
        quoted = target.name.encode("utf-8").decode("latin-1", "replace")
        self.send_header(
            "Content-Disposition",
            f"attachment; filename*=UTF-8''{_url_quote(target.name)}; filename=\"{quoted}\"",
        )
        self.end_headers()
        with target.open("rb") as fh:
            while chunk := fh.read(256 * 1024):
                try:
                    self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    break


def _url_quote(name: str) -> str:
    from urllib.parse import quote

    return quote(name, safe="")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="유튜브 다운로더 웹앱 (로컬 실행)")
    parser.add_argument("--port", type=int, default=8765, help="포트 (기본: 8765)")
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="바인딩 주소 (기본: 127.0.0.1 — 같은 PC에서만 접속)",
    )
    parser.add_argument("--no-browser", action="store_true", help="브라우저 자동 실행 안 함")
    args = parser.parse_args(argv)

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    url = f"http://{args.host}:{args.port}"
    print(f"유튜브 다운로더 웹앱이 열렸습니다: {url}")
    print("종료하려면 Ctrl+C 를 누르세요.")

    if not args.no_browser:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n종료합니다.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
