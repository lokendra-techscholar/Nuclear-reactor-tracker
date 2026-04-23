# Nuclear Reactor Tracker — Post-Fukushima Construction

An interactive world-map tracker of nuclear power reactors whose construction
commenced on or after 1&nbsp;January&nbsp;2012, i.e. after the March&nbsp;2011
Fukushima Daiichi accident. The site visualises where the nuclear industry has
been building in the post-Fukushima era and lets you inspect each plant's key
facts.

## What the map shows

Circle markers are placed at reactor-site coordinates on a borderless world
map (land-only cartography, no political boundaries).

Marker colour indicates status:

- **Green** &mdash; all units at the site are already operational.
- **Orange** &mdash; all units are still under construction (as of 31&nbsp;Dec&nbsp;2024).
- **Blue** &mdash; mixed site (some units operating, some under construction).

Marker size scales with the site's total gross electrical capacity.

Hovering over a marker opens a popup listing every reactor unit at that site
with:

- Reactor type and specific model (e.g. PWR / HPR1000, PWR / VVER‑1200, HTGR / HTR‑PM, FBR / CFR600).
- Headline gross capacity in MW<sub>e</sub>.
- Construction start date (first pouring of concrete).
- First grid connection date (if applicable).
- Commercial-operation date (if applicable).

## Data source

The **only** reference used to populate the tracker is:

> International Atomic Energy Agency, *Nuclear Power Reactors in the World*,
> Reference Data Series No.&nbsp;2, 2025 Edition (IAEA-RDS-2/45), Vienna, 2025.
> Included in this repo at `docs/IAEA_document 1.pdf`.

Specifically, the data was extracted from:

- **Table&nbsp;13** — Reactors Under Construction, 31&nbsp;Dec&nbsp;2024
- **Table&nbsp;14** — Operational Reactors, 31&nbsp;Dec&nbsp;2024
- **Table&nbsp;10** — Connections to the Grid during 2024

Filtering rule: the reactor's **Construction Start** month reported by the
IAEA is 2012-01 or later. Reactors whose first concrete predates 2012 are
excluded, regardless of when they later connected to the grid.

Site coordinates are placed at the nearest publicly known plant location for
each reactor site; only the IAEA document was used for reactor facts.

## Running the site locally

The page uses `fetch()` to load `data/reactors.json`, so it must be served
over HTTP (opening `index.html` directly via `file://` will fail due to CORS).

```bash
# from the repo root
python3 -m http.server 8080
# then open http://localhost:8080/
```

External dependencies are loaded from public CDNs:

- [D3 v7](https://cdn.jsdelivr.net/npm/d3@7.8.5/dist/d3.min.js)
- [topojson-client v3](https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js)
- [world-atlas land-110m](https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json) (land polygons only, no borders)

Internet access is required when loading the page for the first time.

## Repository layout

```
.
├── index.html            # page shell
├── css/styles.css        # dark-theme styles
├── js/app.js             # D3 map + tooltip logic
├── data/reactors.json    # extracted IAEA data + plant coordinates
└── docs/IAEA_document 1.pdf   # source reference
```

## Summary

- 34 sites across 14 countries
- 81 reactor units
- 93.7&nbsp;GW<sub>e</sub> gross of new nuclear under construction or already
  connected to the grid since 2012.
