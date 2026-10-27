"""Gera index.html (app próprio) a partir do app.html do artefato."""
import sys, re, pathlib
src = pathlib.Path(sys.argv[1]).read_text()
dst = pathlib.Path(sys.argv[2])
CLIENT_ID = "174854921273-1o2mprksfg329m81oojpq4nmn2h55v00.apps.googleusercontent.com"
linhas = src.split("\n")
assert linhas[0].startswith("<!doctype html>")
corpo = "\n".join(linhas[1:])
corpo = corpo.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', "")
head = ('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<meta name="theme-color" content="#00572D"><meta name="apple-mobile-web-app-capable" content="yes">'
        '<meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Vistoria">'
        '<link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="icon-192.png"><link rel="apple-touch-icon" href="apple-touch-icon.png">'
        '<style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
        'body{margin:0;padding:0;background:#fff}img{max-width:100%}[hidden]{display:none!important}</style>\n'
        '<script>window.EFFICACE_CONFIG={googleClientId:"@ID@"};</script>\n'
        '<script src="runtime.js"></script>\n').replace("@ID@", CLIENT_ID)
corpo = corpo.replace("<title>Vistoria Efficace</title>\n", "<title>Vistoria Efficace</title>\n</head><body>\n", 1)
assert "<script>" in corpo
dst.write_text(head + corpo + ("" if corpo.rstrip().endswith("</html>") else "\n</body></html>\n"))
print("ok", dst, len(head + corpo))
