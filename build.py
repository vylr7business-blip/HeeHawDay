# Wraps the single-file game (game.html) into index.html for the Railway site.
import pathlib
here=pathlib.Path(__file__).parent
s=(here/'game.html').read_text()
te=s.index('</title>')+8; rest=s[te:]; se=rest.index('</style>')+8
doc=f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="HeeHawDay: a farm game set on Elsberry Riding & Farm in Rockmart, Georgia. Grow crops, feed the animals, run trail rides and fill party orders.">
{s[:te]}
<style>:root{{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}body{{margin:0;font-size:14px}}[hidden]{{display:none!important}}</style>
{rest[:se]}
</head>
<body>
{rest[se:].strip()}
</body>
</html>
'''
(here/'index.html').write_text(doc)
print('built index.html')
