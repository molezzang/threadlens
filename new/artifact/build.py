#!/usr/bin/env python3
"""스레드렌즈 한 화면 버전 만들기.

사이트의 style.css, data.js, app.js를 shell.html 안에 넣어 파일 하나로 묶는다.
사용법: python3 build.py <결과 파일 경로>
"""
import pathlib
import sys

here = pathlib.Path(__file__).resolve().parent
assets = here.parent / "assets"
out = pathlib.Path(sys.argv[1])

html = (here / "shell.html").read_text(encoding="utf-8")
for mark, name in (("/*__CSS__*/", "style.css"), ("/*__DATA__*/", "data.js"), ("/*__APP__*/", "app.js")):
    body = (assets / name).read_text(encoding="utf-8")
    assert "</script>" not in body and "</style>" not in body, name
    assert html.count(mark) == 1, mark
    html = html.replace(mark, body)

out.write_text(html, encoding="utf-8")
print(out, len(html.encode("utf-8")), "bytes")
