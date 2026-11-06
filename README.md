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

## Site Structure

- **Home (`index.html`)**: browser start page. A full-page generative
  backdrop, a link launcher, and browser tools. Edit the links and search
  engines in `_data/start.yml`. The visual is `assets/js/nophase/scope.js`,
  the launcher is `start.js`, and the tools are `tools-core.js` (registry,
  audio, piano), `tools-music.js` and `tools-dev.js` (add a tool with
  `NP.tool({...})`). Styles are in `_sass/pages/_start.scss`.
- **Projects**: one page per tool in `_posts/` (layout `project`), served at
  `/projects/<slug>/`. Each page has the overview, gallery, and the full
  technical docs. Card data (`status`, `kind`, `format`, `stack`, `thumb`,
  `accent`) comes from the page front matter.
- **Old URLs**: `/documentation/*` and `/posts/*` are small redirect stubs
  (`documentation/`, `redirects/`) pointing at the project pages.
- **Theme**: dark-only. The palette is in `_sass/themes/_dark.scss`.

Start page keys: `/` focuses the launcher, space re-rolls the visual,
`1`-`4` pick a visual mode. Add `?seed=<hex>&mode=<1-4>` to the URL to
reproduce a specific one.
