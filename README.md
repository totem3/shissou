# PURIN RUSH

A portrait-first endless runner for mobile Safari, built with Canvas 2D.
All game visuals and audio are generated locally. The project does not ship
third-party images, audio files, font files, or JavaScript libraries.

The in-game text is Japanese.

## Run locally

The game is a static site with no build step. From the repository root:

```bash
python3 -m http.server 8000
```

Open <http://localhost:8000/>.

On iPhone, open the page in Safari and use Share > Add to Home Screen to launch
it like an app. A web app manifest is included, but no service worker is
implemented, so offline launch is not supported.

## Controls

- Tap the right half of the screen: jump
- Tap the right half again while airborne: double jump
- Tap the left half: slide
- Tap the left half while airborne: fast-fall, then slide on landing
- Keyboard: `Space`, `ArrowUp`, or `W` to jump; `ArrowDown`, `S`, or `Shift` to slide
- Pause: the button in the top-right corner, or `Esc` / `P`

## Gameplay

- Collect sweets, build combos, and earn score and coins.
- Three hearts; heart pickups restore health.
- Fill the fever gauge to enter a timed fever state and smash obstacles.
- Gold sweets, near-miss bonuses, and elevated sweet arches.
- Four stages with distinct palettes based on distance.
- Four characters, three unlockable with coins, with different jump, slide, and
  magnet traits.
- Daily missions reset at local midnight.
- Best score, coins, selected character, owned characters, and daily progress are
  stored in `localStorage`.
- Canvas resolution adapts to screen size and measured rendering performance.

## File structure

```text
.
├── index.html
├── style.css
├── game.js
├── manifest.webmanifest
├── LICENSE
├── NOTICE
├── README.md
└── icons/
    ├── apple-touch-icon.png
    ├── icon-192.png
    ├── icon-512.png
    └── icon.svg
```

## Development notes

- The save key is `purin-rush-save-v1`. When changing the schema, update
  `normalizeSave()` and the key/version handling together.
- Main balance values live in `game.js`: `FEVER_MAX`, `FEVER_DURATION`,
  `BASE_JUMP`, `BASE_GRAVITY`, `STAGES`, `SKINS`, and `MISSIONS`.
- Rendering scale is tracked by `DPR`. In `?debug` mode, adaptive resolution is
  disabled so QA captures keep a fixed resolution.
- If you add external assets, update the manifest, add the required license and
  attribution files, and update `NOTICE`.

### Debug API

Start the game with `?debug`:

```text
http://localhost:8000/?debug
```

The debug API is then available under `window.__PURIN__`:

```js
__PURIN__.state        // mode, score, distance, hearts, player state, etc.
__PURIN__.player
__PURIN__.game
__PURIN__.save
__PURIN__.obstacles
__PURIN__.candies
__PURIN__.startRun()
__PURIN__.pause() / __PURIN__.resume() / __PURIN__.home()
__PURIN__.die()
__PURIN__.warp(1000)   // advance distance
__PURIN__.setStage(2)  // change stage
__PURIN__.fever()      // start fever mode
__PURIN__.addCoins(500)
__PURIN__.spawnObstacle(...)
__PURIN__.spawnCandyPattern(...)
```

Use a URL without `?debug` for production checks.

## Verification

- Layout and touch controls were checked at iPhone-sized viewports:
  390x844, 390x667, and 320x568, at DPR 2 and 3.
- WebKit checks covered touch input, audio unlock, the result screen, the shop,
  and save restoration.
- At desktop widths, the phone-sized layout is centered in the viewport.

## AI assistance

This project was developed with substantial assistance from an AI coding agent.
The human author defined the requirements, reviewed generated output, and
directed revisions. See `NOTICE` for details.

## Contributions

Pull requests are disabled. This is a personal project and does not accept code
contributions.

## License

This repository is source-available, not open source. All rights are reserved.
See `LICENSE` for the exact terms and `NOTICE` for AI-assistance, third-party
asset, and trademark disclosures. No permission is granted beyond the terms in
`LICENSE`.
