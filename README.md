# HeeHawDay

A browser farm game set on Elsberry Riding & Farm in Rockmart, Georgia. Grow crops, grind feed, care for the riding string and petting zoo, and fill orders for birthday parties, Date Nights and trail rides. The farm grows as you level up: new land, buildings, crops, recipes and animals unlock through level 10.

Follow along on X: [@HeeHawDay](https://x.com/HeeHawDay)

## Run locally

```
npm start
```

Then open http://localhost:3000. The whole game is in `index.html`; `server.js` just serves it (no dependencies).

## Deploy on Railway

New Project → Deploy from GitHub repo → pick this repo. Railway runs `npm start` and sets `PORT` automatically. Then open Settings → Networking → Generate Domain.

## Coin contract address

Set a `COIN_CA` variable on the Railway service and the address shows under the HeeHawDay title (with a copy button) within a minute. No code change needed. Leave it empty to hide it.

## Editing the game

`game.html` is the single-file game. After changing it, run `python3 build.py` to regenerate `index.html`. The player guide is `docs.html` (served at `/docs`).

## Logo and banner

Open `/brand` on the live site to download the X profile picture (1000×1000) and header (1500×500). The header is drawn from a staged view of the farm, so it updates whenever the game art changes.
