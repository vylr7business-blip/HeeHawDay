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
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:title" content="HeeHawDay">
<meta property="og:description" content="Grow, feed and ride on Elsberry Farm. A farm game starring HeeHaw the donkey.">
<meta property="og:image" content="https://heehawday-production.up.railway.app/banner.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@HeeHawDay">
<meta name="twitter:image" content="https://heehawday-production.up.railway.app/banner.png">
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
