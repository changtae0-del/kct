# 유튜브 다운로더

유튜브 주소를 넣으면 영상(mp4) 또는 음원(mp3)을 내려받는 도구입니다.
쓰기 편한 방식으로 골라 쓰면 됩니다.

| 방식 | 실행 | 설명 |
| --- | --- | --- |
| 웹앱 | `python web/server.py` | 브라우저 화면. 진행률 표시, 파일을 브라우저로 바로 받기 |
| GUI | `python gui.py` | 창 프로그램 (Tkinter) |
| CLI | `python ytdl.py URL` | 터미널. 옵션이 가장 많음 |

## 설치

```bash
cd tools/youtube-downloader
pip install -r requirements.txt
```

**ffmpeg 도 필요합니다.** 고화질 영상은 영상/음성 트랙이 따로 내려오기 때문에
합치는 데 ffmpeg 를 쓰고, mp3 추출에도 씁니다.

| 운영체제 | 설치 명령 |
| --- | --- |
| macOS | `brew install ffmpeg` |
| Windows | `winget install Gyan.FFmpeg` |
| Ubuntu/Debian | `sudo apt install ffmpeg` |

## 웹앱으로 쓰기

```bash
python web/server.py
```

브라우저가 자동으로 열립니다 (`http://127.0.0.1:8765`). 주소를 넣고 **다운로드**를
누르면 진행률이 실시간으로 표시되고, 끝나면 파일 이름을 눌러 브라우저로 바로
받을 수 있습니다. 서버 PC의 저장 폴더에도 그대로 남습니다.

- **정보만 확인** 버튼: 받지 않고 제목·채널·길이·가능 화질만 조회
- 주소를 줄바꿈으로 여러 개 넣으면 동시에 처리됩니다
- 진행 중인 항목은 **중지**할 수 있습니다

```bash
python web/server.py --port 9000 --no-browser   # 포트 변경 / 자동 실행 끄기
```

> **접속 범위**: 기본값은 `127.0.0.1` 이라 그 PC에서만 열립니다. 같은 집·사무실의
> 다른 기기에서 쓰려면 `--host 0.0.0.0` 을 주면 되지만, 인증이 없는 도구이므로
> 신뢰할 수 있는 내부망에서만 쓰세요. 인터넷에 그대로 노출하지 마시기 바랍니다.

> **참고**: 이 웹앱은 내 PC에서 띄워 쓰는 용도입니다. Vercel 같은 서버리스 호스팅에는
> yt-dlp·ffmpeg 바이너리가 없고 파일시스템이 읽기 전용이라 그대로 올려서는 동작하지
> 않습니다.

## GUI 로 쓰기

```bash
python gui.py
```

주소를 붙여넣고 → 영상/음원 선택 → **다운로드**. 여러 주소는 줄바꿈으로 구분해서
한 번에 넣을 수 있습니다. 진행률과 남은 시간이 표시되고, 중간에 **중지**할 수 있습니다.

> Ubuntu 에서 `tkinter` 오류가 나면 `sudo apt install python3-tk` 를 먼저 실행하세요.

## CLI 로 쓰기

```bash
# 기본: 최고 화질 mp4 로 ~/Downloads/youtube 에 저장
python ytdl.py "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# mp3 음원만
python ytdl.py URL -a

# 화질 제한 (720p 이하)
python ytdl.py URL -q 720

# 저장 폴더 지정
python ytdl.py URL -o ~/Music/찬양

# 재생목록 전체 + 자막
python ytdl.py "재생목록주소" -p -s

# 여러 개 한 번에
python ytdl.py URL1 URL2 URL3

# 다운로드 없이 제목·길이·가능 화질만 확인
python ytdl.py URL --info
```

### 전체 옵션

| 옵션 | 설명 |
| --- | --- |
| `-o, --output` | 저장 폴더 (기본 `~/Downloads/youtube`) |
| `-a, --audio` | 음원만 추출 |
| `--audio-format` | `mp3`(기본) `m4a` `wav` `flac` `opus` |
| `-q, --quality` | 최대 화질 높이 (`1080`, `720`, `480` …) |
| `-p, --playlist` | 재생목록 전체 받기 (`재생목록명/01 - 제목.mp4` 형태로 저장) |
| `-s, --subtitles` | 자막 함께 받기 (자동 생성 자막 포함) |
| `--sub-langs` | 자막 언어, 기본 `ko,en` |
| `-t, --thumbnail` | 썸네일 이미지도 저장 |
| `--archive FILE` | 받은 영상 기록 — 같은 영상을 다시 받지 않음 |
| `--info` | 정보만 출력 |
| `--quiet` | 출력 최소화 |

`--archive` 는 재생목록을 주기적으로 받을 때 유용합니다. 이미 받은 항목은 건너뜁니다.

```bash
python ytdl.py "재생목록주소" -p --archive ~/.ytdl-archive.txt
```

## 참고

- 다운로드가 갑자기 실패하면 유튜브 쪽 변경일 가능성이 큽니다. `pip install -U yt-dlp` 로 업데이트하세요.
- 중간에 끊긴 다운로드는 같은 명령을 다시 실행하면 이어받습니다.
- 저작권이 있는 자료는 저작권자의 허락 범위 안에서만 내려받아 사용하세요. 유튜브
  서비스 약관도 함께 확인하시기 바랍니다.
