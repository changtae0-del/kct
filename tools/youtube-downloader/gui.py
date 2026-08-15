#!/usr/bin/env python3
"""유튜브 다운로더 GUI (Tkinter).

터미널이 익숙하지 않은 사용자를 위한 간단한 창 UI입니다.

    python gui.py
"""

from __future__ import annotations

import queue
import sys
import threading
from pathlib import Path

try:
    import tkinter as tk
    from tkinter import filedialog, messagebox, ttk
except ImportError:  # pragma: no cover - 설치 안내용
    sys.exit(
        "tkinter 를 사용할 수 없습니다.\n"
        "  macOS/Windows: python.org 공식 설치본을 쓰면 기본 포함됩니다.\n"
        "  Ubuntu/Debian: sudo apt install python3-tk\n"
        "GUI 대신 CLI 를 쓰시려면: python ytdl.py <주소>"
    )

from ytdl import DEFAULT_OUTPUT_DIR, build_options

try:
    from yt_dlp import YoutubeDL
except ImportError:  # pragma: no cover - 설치 안내용
    sys.exit("yt-dlp 가 설치되어 있지 않습니다.  pip install -r requirements.txt")

QUALITY_CHOICES = ["최고 화질", "1080p", "720p", "480p", "360p"]


class DownloaderApp:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("유튜브 다운로더")
        self.root.geometry("640x460")
        self.root.minsize(560, 420)

        self.messages: queue.Queue[tuple[str, str]] = queue.Queue()
        self.worker: threading.Thread | None = None
        self.cancel_flag = threading.Event()

        self.output_dir = tk.StringVar(value=str(DEFAULT_OUTPUT_DIR))
        self.mode = tk.StringVar(value="video")
        self.quality = tk.StringVar(value=QUALITY_CHOICES[0])
        self.subtitles = tk.BooleanVar(value=False)
        self.playlist = tk.BooleanVar(value=False)
        self.status = tk.StringVar(value="주소를 붙여넣고 [다운로드]를 누르세요.")

        self._build_ui()
        self.root.after(100, self._drain_messages)

    def _build_ui(self) -> None:
        pad = {"padx": 10, "pady": 6}
        frame = ttk.Frame(self.root)
        frame.pack(fill="both", expand=True)

        ttk.Label(frame, text="유튜브 주소 (여러 개면 줄바꿈으로 구분)").pack(anchor="w", **pad)
        self.url_box = tk.Text(frame, height=5, wrap="none")
        self.url_box.pack(fill="x", padx=10)

        options = ttk.Frame(frame)
        options.pack(fill="x", **pad)

        ttk.Radiobutton(options, text="영상 (mp4)", variable=self.mode, value="video").grid(row=0, column=0, sticky="w")
        ttk.Radiobutton(options, text="음원 (mp3)", variable=self.mode, value="audio").grid(row=0, column=1, sticky="w", padx=(12, 0))

        ttk.Label(options, text="화질").grid(row=0, column=2, sticky="e", padx=(20, 4))
        ttk.Combobox(
            options,
            textvariable=self.quality,
            values=QUALITY_CHOICES,
            state="readonly",
            width=10,
        ).grid(row=0, column=3, sticky="w")

        ttk.Checkbutton(options, text="자막 함께 받기", variable=self.subtitles).grid(row=1, column=0, columnspan=2, sticky="w", pady=(6, 0))
        ttk.Checkbutton(options, text="재생목록 전체", variable=self.playlist).grid(row=1, column=2, columnspan=2, sticky="w", pady=(6, 0))

        path_row = ttk.Frame(frame)
        path_row.pack(fill="x", **pad)
        ttk.Label(path_row, text="저장 폴더").pack(side="left")
        ttk.Entry(path_row, textvariable=self.output_dir).pack(side="left", fill="x", expand=True, padx=8)
        ttk.Button(path_row, text="찾아보기", command=self._choose_dir).pack(side="left")

        self.progress = ttk.Progressbar(frame, mode="determinate", maximum=100)
        self.progress.pack(fill="x", padx=10, pady=(4, 0))
        ttk.Label(frame, textvariable=self.status, foreground="#444").pack(anchor="w", padx=10, pady=(4, 0))

        self.log = tk.Text(frame, height=8, state="disabled", wrap="word", background="#f6f6f6")
        self.log.pack(fill="both", expand=True, padx=10, pady=(6, 4))

        buttons = ttk.Frame(frame)
        buttons.pack(fill="x", padx=10, pady=(0, 10))
        self.download_btn = ttk.Button(buttons, text="다운로드", command=self._start)
        self.download_btn.pack(side="right")
        self.cancel_btn = ttk.Button(buttons, text="중지", command=self._cancel, state="disabled")
        self.cancel_btn.pack(side="right", padx=(0, 8))
        ttk.Button(buttons, text="폴더 열기", command=self._open_dir).pack(side="left")

    def _choose_dir(self) -> None:
        chosen = filedialog.askdirectory(initialdir=self.output_dir.get() or str(Path.home()))
        if chosen:
            self.output_dir.set(chosen)

    def _open_dir(self) -> None:
        target = Path(self.output_dir.get()).expanduser()
        target.mkdir(parents=True, exist_ok=True)
        if sys.platform == "darwin":
            cmd = ["open", str(target)]
        elif sys.platform.startswith("win"):
            cmd = ["explorer", str(target)]
        else:
            cmd = ["xdg-open", str(target)]
        import subprocess

        subprocess.Popen(cmd)

    def _log(self, text: str) -> None:
        self.log.configure(state="normal")
        self.log.insert("end", text + "\n")
        self.log.see("end")
        self.log.configure(state="disabled")

    def _start(self) -> None:
        if self.worker and self.worker.is_alive():
            return

        urls = [line.strip() for line in self.url_box.get("1.0", "end").splitlines() if line.strip()]
        if not urls:
            messagebox.showwarning("주소 없음", "유튜브 주소를 입력해 주세요.")
            return

        output_dir = Path(self.output_dir.get()).expanduser()
        try:
            output_dir.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            messagebox.showerror("폴더 오류", f"저장 폴더를 만들 수 없습니다:\n{exc}")
            return

        quality_text = self.quality.get()
        max_height = None if quality_text == QUALITY_CHOICES[0] else int(quality_text.rstrip("p"))

        options = build_options(
            output_dir,
            audio_only=self.mode.get() == "audio",
            max_height=max_height,
            playlist=self.playlist.get(),
            subtitles=self.subtitles.get(),
            quiet=True,
        )
        options["progress_hooks"] = [self._on_progress]
        options["logger"] = _QueueLogger(self.messages)

        self.cancel_flag.clear()
        self.download_btn.configure(state="disabled")
        self.cancel_btn.configure(state="normal")
        self.progress["value"] = 0
        self._log(f"저장 위치: {output_dir}")

        self.worker = threading.Thread(target=self._run, args=(urls, options), daemon=True)
        self.worker.start()

    def _cancel(self) -> None:
        self.cancel_flag.set()
        self.messages.put(("status", "중지 요청됨 — 현재 파일을 정리하는 중..."))

    def _run(self, urls: list[str], options: dict) -> None:
        failed = 0
        try:
            with YoutubeDL(options) as ydl:
                for url in urls:
                    if self.cancel_flag.is_set():
                        break
                    self.messages.put(("status", f"다운로드 중: {url}"))
                    try:
                        ydl.download([url])
                    except Exception as exc:  # noqa: BLE001 - UI 에 그대로 보여준다
                        if self.cancel_flag.is_set():
                            break
                        failed += 1
                        self.messages.put(("log", f"[실패] {url}\n  {exc}"))
        finally:
            if self.cancel_flag.is_set():
                self.messages.put(("done", "중지했습니다."))
            elif failed:
                self.messages.put(("done", f"{failed}개 실패, 나머지는 완료되었습니다."))
            else:
                self.messages.put(("done", "모두 완료되었습니다."))

    def _on_progress(self, data: dict) -> None:
        if self.cancel_flag.is_set():
            raise _Cancelled("사용자가 중지했습니다.")

        if data["status"] == "downloading":
            total = data.get("total_bytes") or data.get("total_bytes_estimate")
            done = data.get("downloaded_bytes", 0)
            if total:
                self.messages.put(("progress", str(done / total * 100)))
            name = Path(data.get("filename", "")).name
            speed = data.get("_speed_str", "").strip()
            eta = data.get("_eta_str", "").strip()
            self.messages.put(("status", f"{name}  {speed}  남은 시간 {eta}"))
        elif data["status"] == "finished":
            self.messages.put(("progress", "100"))
            self.messages.put(("log", f"받음: {Path(data.get('filename', '')).name}"))
            self.messages.put(("status", "변환/병합 중..."))

    def _drain_messages(self) -> None:
        try:
            while True:
                kind, payload = self.messages.get_nowait()
                if kind == "progress":
                    self.progress["value"] = float(payload)
                elif kind == "status":
                    self.status.set(payload)
                elif kind == "log":
                    self._log(payload)
                elif kind == "done":
                    self.status.set(payload)
                    self._log(payload)
                    self.download_btn.configure(state="normal")
                    self.cancel_btn.configure(state="disabled")
        except queue.Empty:
            pass
        self.root.after(100, self._drain_messages)


class _Cancelled(Exception):
    """진행 훅에서 다운로드를 중단시키기 위한 예외."""


class _QueueLogger:
    """yt-dlp 로그를 GUI 큐로 흘려보낸다."""

    def __init__(self, messages: queue.Queue) -> None:
        self.messages = messages

    def debug(self, msg: str) -> None:
        if msg.startswith("[debug]"):
            return
        if msg.strip():
            self.messages.put(("log", msg))

    def info(self, msg: str) -> None:
        self.debug(msg)

    def warning(self, msg: str) -> None:
        self.messages.put(("log", f"[경고] {msg}"))

    def error(self, msg: str) -> None:
        self.messages.put(("log", f"[오류] {msg}"))


def main() -> int:
    root = tk.Tk()
    DownloaderApp(root)
    root.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
