# Slate: text-to-video web app

Node + Express backend that calls a hosted video model on Replicate, plus a single-page frontend.
Your API token stays on the server; the browser never sees it.

## Run locally (Windows / IntelliJ)

1. Install Node 18+ and open this folder in IntelliJ IDEA.
2. In the terminal: `npm install`
3. Copy `.env.example` to `.env` and paste your token. Then load it:
   - PowerShell: `$env:REPLICATE_API_TOKEN="r8_..." ; npm start`
   - or run with Node 20+: `node --env-file=.env server.js`
4. Open http://localhost:3000

## Deploy to Render

1. Push to GitHub.
2. Render: New > Blueprint (it reads `render.yaml`), or New > Web Service with build `npm install`, start `npm start`.
3. In Environment, set `REPLICATE_API_TOKEN` (and optionally `REPLICATE_MODEL`).

## Cost protection (built in)

- `MAX_PER_IP_PER_HOUR` (default 3) and `MAX_GENERATIONS_PER_DAY` (default 20).
- Set a spend limit in your Replicate billing settings too.

## Changing the model

Set `REPLICATE_MODEL` to any text-to-video model with a `prompt` input. Models differ in price, length and
extra inputs (duration, aspect ratio); pass those with `REPLICATE_EXTRA_INPUT` as JSON.

## Next steps

- User accounts + saving videos to storage (Replicate output URLs expire after about an hour)
- Image-to-video mode, video history, a credits system
