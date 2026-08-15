#!/usr/bin/env python3
"""유튜브 주소로 영상/음원을 내려받는 CLI 도구.

사용 예:
    python ytdl.py "https://www.youtube.com/watch?v=..."
    python ytdl.py URL -a                 # mp3 음원만
    python ytdl.py URL -q 720             # 720p 이하 화질
    python ytdl.py URL -o ~/Downloads     # 저장 폴더 지정
    python ytdl.py URL --info             # 다운로드 없이 정보만 확인
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    from yt_dlp import YoutubeDL
    from yt_dlp.utils import DownloadError
except ImportError:  # pragma: no cover - 설치 안내용
    sys.exit(
        "yt-dlp 가 설치되어 있지 않습니다.\n"
        "  pip install -r requirements.txt\n"
        "또는\n"
        "  pip install -U yt-dlp"
    )

DEFAULT_OUTPUT_DIR = Path.home() / "Downloads" / "youtube"


def build_options(
    output_dir: Path,
    *,
    audio_only: bool = False,
    audio_format: str = "mp3",
    max_height: int | None = None,
    playlist: bool = False,
    subtitles: bool = False,
    subtitle_langs: str = "ko,en",
    thumbnail: bool = False,
    archive: Path | None = None,
    quiet: bool = False,
) -> dict:
    """CLI 인자를 yt-dlp 옵션 사전으로 변환한다."""
    template = "%(playlist_title)s/%(playlist_index)02d - %(title)s.%(ext)s" if playlist else "%(title)s.%(ext)s"

    options: dict = {
        "outtmpl": str(output_dir / template),
        "noplaylist": not playlist,
        "ignoreerrors": playlist,  # 재생목록 중 일부가 실패해도 나머지는 계속
        "restrictfilenames": False,
        "windowsfilenames": True,  # 윈도우에서도 안전한 파일명
        "continuedl": True,
        "retries": 10,
        "fragment_retries": 10,
        "concurrent_fragment_downloads": 4,
        "quiet": quiet,
        "no_warnings": quiet,
        "consoletitle": False,
    }

    if archive:
        options["download_archive"] = str(archive)

    if audio_only:
        options["format"] = "bestaudio/best"
        options["postprocessors"] = [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": audio_format,
                "preferredquality": "192",
            },
            {"key": "FFmpegMetadata"},
        ]
    else:
        if max_height:
            options["format"] = (
                f"bestvideo[height<={max_height}][ext=mp4]+bestaudio[ext=m4a]/"
                f"bestvideo[height<={max_height}]+bestaudio/"
                f"best[height<={max_height}]/best"
            )
        else:
            options["format"] = "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best"
        options["merge_output_format"] = "mp4"

    if subtitles:
        options.update(
            {
                "writesubtitles": True,
                "writeautomaticsub": True,
                "subtitleslangs": [lang.strip() for lang in subtitle_langs.split(",") if lang.strip()],
                "subtitlesformat": "srt/best",
            }
        )
        options.setdefault("postprocessors", []).append(
            {"key": "FFmpegSubtitlesConvertor", "format": "srt"}
        )

    if thumbnail:
        options["writethumbnail"] = True

    return options


class _SilentLogger:
    """yt-dlp 자체 출력을 삼킨다 (--info 에서 오류 메시지 중복 방지)."""

    def debug(self, msg: str) -> None:
        pass

    def info(self, msg: str) -> None:
        pass

    def warning(self, msg: str) -> None:
        pass

    def error(self, msg: str) -> None:
        pass


def show_info(url: str) -> int:
    """다운로드 없이 제목/길이/화질 목록만 출력한다."""
    options = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "logger": _SilentLogger(),  # 실패 메시지는 아래에서 한 번만 출력한다
    }
    try:
        with YoutubeDL(options) as ydl:
            info = ydl.extract_info(url, download=False)
    except DownloadError as exc:
        print(f"정보를 가져오지 못했습니다: {exc}", file=sys.stderr)
        return 1

    duration = info.get("duration") or 0
    print(f"제목    : {info.get('title')}")
    print(f"채널    : {info.get('uploader')}")
    print(f"길이    : {duration // 60}분 {duration % 60}초")
    print(f"업로드  : {info.get('upload_date')}")
    print(f"조회수  : {info.get('view_count')}")

    heights = sorted(
        {f["height"] for f in info.get("formats", []) if f.get("height")},
        reverse=True,
    )
    if heights:
        print("가능 화질: " + ", ".join(f"{h}p" for h in heights))
    return 0


def download(urls: list[str], options: dict) -> int:
    """주어진 주소들을 내려받고 실패 개수를 종료 코드로 돌려준다."""
    failed = 0
    with YoutubeDL(options) as ydl:
        for url in urls:
            try:
                ydl.download([url])
            except DownloadError as exc:
                failed += 1
                print(f"[실패] {url}: {exc}", file=sys.stderr)
            except KeyboardInterrupt:
                print("\n사용자가 중단했습니다.", file=sys.stderr)
                return 130
    return 1 if failed else 0


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="ytdl",
        description="유튜브 주소로 영상 또는 음원을 내려받습니다.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("urls", nargs="+", help="유튜브 영상 또는 재생목록 주소")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help=f"저장 폴더 (기본: {DEFAULT_OUTPUT_DIR})",
    )
    parser.add_argument("-a", "--audio", action="store_true", help="음원만 추출 (기본 mp3)")
    parser.add_argument(
        "--audio-format",
        default="mp3",
        choices=["mp3", "m4a", "wav", "flac", "opus"],
        help="음원 파일 형식 (기본: mp3)",
    )
    parser.add_argument(
        "-q",
        "--quality",
        type=int,
        metavar="HEIGHT",
        help="최대 화질 높이 (예: 1080, 720, 480)",
    )
    parser.add_argument("-p", "--playlist", action="store_true", help="재생목록 전체 받기")
    parser.add_argument("-s", "--subtitles", action="store_true", help="자막도 함께 받기")
    parser.add_argument("--sub-langs", default="ko,en", help="자막 언어 (기본: ko,en)")
    parser.add_argument("-t", "--thumbnail", action="store_true", help="썸네일 이미지도 저장")
    parser.add_argument(
        "--archive",
        type=Path,
        help="이미 받은 영상 기록 파일 (중복 다운로드 방지)",
    )
    parser.add_argument("--info", action="store_true", help="다운로드 없이 정보만 출력")
    parser.add_argument("--quiet", action="store_true", help="진행 상황 출력 최소화")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    if args.info:
        return show_info(args.urls[0])

    output_dir: Path = args.output.expanduser()
    output_dir.mkdir(parents=True, exist_ok=True)

    options = build_options(
        output_dir,
        audio_only=args.audio,
        audio_format=args.audio_format,
        max_height=args.quality,
        playlist=args.playlist,
        subtitles=args.subtitles,
        subtitle_langs=args.sub_langs,
        thumbnail=args.thumbnail,
        archive=args.archive.expanduser() if args.archive else None,
        quiet=args.quiet,
    )

    print(f"저장 위치: {output_dir}")
    result = download(args.urls, options)
    if result == 0:
        print("완료되었습니다.")
    return result


if __name__ == "__main__":
    raise SystemExit(main())
