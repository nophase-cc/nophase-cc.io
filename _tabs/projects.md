---
layout: page
title: projects
icon: fas fa-cubes
order: 1
---

Every NOPHASE tool lives on a single page: overview, screenshots, and the full
technical docs together. Pick one to dive in.

{% assign project_posts = site.posts | where_exp: "post", "post.categories contains 'Projects'" | sort: "date" %}
{% assign kinds = "" | split: "" %}
{% for post in project_posts %}{% assign kinds = kinds | push: post.categories[1] %}{% endfor %}
{% assign kinds = kinds | uniq | sort_natural %}

<div class="project-filters" role="group" aria-label="Filter projects">
  <button type="button" class="chip chip-btn active" data-filter="all">All</button>
  {% for kind in kinds %}
  <button type="button" class="chip chip-btn" data-filter="{{ kind | slugify }}">{{ kind }}</button>
  {% endfor %}
</div>

<div class="project-grid" id="project-grid">
{% for post in project_posts %}
  {% include project-card.html project=post %}
{% endfor %}
</div>

## Coming with each release

- Install guides
- Compatibility notes
- Setup walkthroughs
- Troubleshooting and known issues
- Changelogs and release notes

<script src="{{ '/assets/js/nophase/projects.js' | relative_url }}" defer></script>
