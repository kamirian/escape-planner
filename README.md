# Escape Planner

Compare places for your next trip. Describe the trip once, let any AI assistant research the options, and see them side by side with budgets, maps, multi-stop routes, weather, entry rules and booking links.

© 2026 Kiyan Amirian. All rights reserved. See [LICENSE](LICENSE).

## How it works

1. **Describe the trip:** dates, who's going and from where, budget, passports (for visa rules), what matters, weather, and whether multi-stop routes are welcome.
2. **Ask an AI.** Either:
   - **Copy the prompt** into ChatGPT, Claude, Gemini or any other assistant (turn on web search if it has it), or
   - **Use your own API key** on the page (Claude, OpenAI, or any OpenAI-compatible service such as OpenRouter). The key goes straight from the browser to that provider.
3. **Paste the answer back.** The page finds the plan in the reply and shows:
   - destination cards with budget badges, plus a map of all the options;
   - for each place, tabs for Overview, Things to do, Routes & maps, Weather & safety and Book;
   - schematic route maps with every leg's distance and an estimated flying time;
   - a side-by-side cost table;
   - a "things to double-check" list. It flags totals that don't add up, stop nights that don't match the trip length, unknown airport codes, places far from their stated airport and missing sources.

From the plan page you can also:

- **Ask for changes:** writes a follow-up prompt with the current plan, or sends it with your key.
- **Save on this device**, **Download file** and **Open a plan file**.
- **Copy share link:** the whole plan is compressed into the link. There is no server.

Try **Example** in the top menu to see a filled-in plan. Its prices are made up.

## Run it

It's a static site with no build step:

- **Locally:** open `index.html` in a browser.
- **Online:** any static host works. On GitHub Pages: push the repo, then go to **Settings → Pages → Deploy from a branch → main / (root)**.

## Privacy and API keys

- The site has no server and no analytics.
- Everything you type, and every plan you save, stays in your browser's storage.
- The only outside requests are:
  - to the AI provider, if you use an API key;
  - to Wikipedia, for destination photos (you can switch these off on the plan page);
  - from the search links you choose to open.
- API keys are kept in memory unless you tick "Remember this key on this device". Use a key with a spending limit.

## Plan format (`escape-planner/1`)

One JSON object: `trip` plus a list of `destinations`. Each destination can have `routes` made of `stops` and `legs`.

- `js/core.js` (`EP.skeleton()`) has the full template. The prompt includes the same template, so any AI can fill it in.
- Money is given as `[low, high]` ranges in `trip.currency`.
- Coordinates are decimal degrees, and airports are IATA codes.

## Where the data comes from

- **Trip facts:** the AI that wrote the plan. The site doesn't look up prices. It only draws the plan, adds up the figures and checks them.
- **Maps:** Natural Earth 1:50m land and borders (public domain), via world-atlas 2.0.2.
- **Airports:** OurAirports (public domain), downloaded October 8, 2026. There are 5,332 airports with IATA codes in `data/airports.js`.
- **Photos:** Wikimedia Commons images, found through each article's Wikipedia page summary and credited on the page. Images that aren't on Commons are skipped.
- **Distances:** great-circle. Flying time is estimated as 30 min + 1 h per 500 miles, nonstop.

## Third-party code and fonts

| What | License | File |
|---|---|---|
| d3-array 3.2.4, d3-geo 3.1.1, topojson-client 3.1.0 | ISC | `vendor/LICENSES.txt` |
| Lexend typeface | SIL Open Font License 1.1 | `fonts/OFL.txt` |

## AI provider notes (checked October 8, 2026)

- **Claude:** Messages API with the `anthropic-dangerous-direct-browser-access` header. Web search uses the `web_search_20250305` tool, and long research turns (`pause_turn`) are continued automatically. Default model: `claude-sonnet-5-5`.
- **OpenAI:** Responses API (`/v1/responses`) with the `web_search` tool. Default model: `gpt-6.1-sol`. The request was built from OpenAI's API reference; it hasn't been tested against the live API.
- **OpenAI-compatible:** `POST {base}/chat/completions`.
- Model names change, so the model box accepts any ID.
