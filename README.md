# NOPHASE Site

Portfolio + organization site for Nophase projects (VSTs, Max for Live devices,
MIDI tools, and audio experiments), built on the Chirpy Jekyll theme.

## Local Preview (Before You Push)

1. Install dependencies once:

   ```bash
   ./scripts/setup
   ```

2. Start local server:

   ```bash
   ./scripts/dev
   ```

3. Open:

   ```text
   http://127.0.0.1:4000
   ```

The server uses `--incremental` for faster rebuilds while you develop.

## Typical Workflow

1. Make edits.
2. Run `./scripts/dev` and verify locally.
3. Commit only when it looks right.
4. Push to GitHub.

## Deployment Updates and Offline Cache

The homepage tool scripts and site stylesheet use a shared build version in
their URLs. The service worker revalidates online page navigations, JavaScript
and CSS, retaining the last successful response as an offline fallback. Images
remain cache-first; feed and DNS requests bypass the worker cache.

An already-open tab can keep the previous worker until you accept its **Update**
prompt. If an older worker keeps serving a stale homepage, open
`https://nophase.cc/?refresh=tools-v2` once to fetch the versioned assets, then
accept **Update**. This does not clear saved tool or visual preferences.

Run the cache regression tests with `npm run test:pwa`.

## Site Structure

- **Home (`index.html`)**: browser start page. A full-page generative
  backdrop, a launcher, quick links, a news feed, browser tools and project
  cards. Links, the hero announcement and search engines live in
  `_data/start.yml` (keep the link groups a multiple of four, same length).
  The visual is `assets/js/nophase/scope.js` (palettes at the top), the
  launcher and feed are `start.js`, and the tools are `tools-core.js`
  (registry, tabs, audio, piano) plus `tools-music.js`, `tools-midi.js`,
  `tools-dev.js` and `tools-net.js`. Add a tool with `NP.tool({...})`; set its
  `group` (`music`, `net`, `sec`, `dev`) and `keys` so the launcher finds it.
  Styles are in `_sass/pages/_start.scss`.
- **Feed**: sources are in `_data/feeds.yml`. The `Refresh home feed`
  workflow (`.github/workflows/feed.yml`) runs `scripts/fetch-feeds.rb` every
  two hours and force-pushes a single `feed.json` to the `feed-data` branch;
  the home page reads it from raw.githubusercontent at runtime, so the site is
  not rebuilt. Run `./scripts/feeds` to build `tmp/feed.json` locally. GitHub
  pauses scheduled workflows after 60 days without commits; re-enable it from
  the Actions tab if headlines stop updating.
- **Projects**: one page per tool in `_posts/` (layout `project`), served at
  `/projects/<slug>/`. Each page has the overview, gallery, and the full
  technical docs. Card data (`status`, `kind`, `format`, `stack`, `thumb`,
  `accent`, optional `version`) comes from the page front matter. Optional
  `links` (`name`, `url`, `icon`, `primary`) become buttons in the page header;
  a GitHub link also puts a GitHub mark on the card.
- **Old URLs**: `/documentation/*` and `/posts/*` are small redirect stubs
  (`documentation/`, `redirects/`) pointing at the project pages.
- **Theme**: dark-only. The palette is in `_sass/themes/_dark.scss`.

Start page keys: `/` focuses the launcher (it searches links, tools, projects
and feed headlines; shift+enter searches the web), space re-rolls the visual,
`1`-`4` pick a visual mode and `c` swaps only the colours. Add
`?seed=<hex>&mode=<1-4>` to the URL to reproduce a specific one, and
`#tool-<id>` to open a tool directly (for example `/#tool-cidr`).
