---
title: whoami
icon: fas fa-user
order: 4
---

I'm Charles. My background is network security: SOC work and DDoS mitigation,
with IT and web admin before that. I also make music, and NOPHASE is where the
tools I build for it end up: plugins, Max for Live devices, MIDI utilities and
the occasional experiment.

Most of them start the same way. Something in my own setup was missing or kept
getting in the way, so I built the piece I wanted.

## What's here

- **[Projects](/projects/)**: one page per tool, with screenshots, an honest
  status and the technical write-up.
- **[The home page](/)**: the browser start page I actually use. Links, a
  security and networking news feed, and small tools that run in the page.
- **[Resume](/resume/)**: the longer version of the background above.

## How I build things

- **Small and specific.** A tool should do one job in a session or a live set,
  then get out of the way.
- **Some chaos on purpose.** Random modulation and rough edges are often where
  the interesting sounds are, so I leave room for them.
- **Status labels mean something.** If a project is a prototype or has only been
  tested on my own gear, its page says so.
- **Local first.** MIDIBRAIN runs without any cloud service, and the browser
  tools here never upload what you paste into them.

## Projects right now

[MIDIBRAIN](/projects/midi-brain/) 0.1 is the first one out in public, with the
[source on GitHub](https://github.com/clewis10/midibrain).

{% assign project_posts = site.posts | where_exp: "post", "post.categories contains 'Projects'" | sort: "date" -%}
{% for p in project_posts -%}
- [{{ p.title }}]({{ p.url | relative_url }}): {{ p.status | downcase }}, {{ p.format }}
{% endfor %}

## Elsewhere

- Email: [charles@nophase.cc](mailto:charles@nophase.cc)
- Code: [github.com/clewis10](https://github.com/clewis10)
- Music: [SoundCloud](https://soundcloud.com/charlescc) ·
  [Bandcamp](https://ccwav.bandcamp.com) ·
  [YouTube](https://www.youtube.com/@cc.nophase)
