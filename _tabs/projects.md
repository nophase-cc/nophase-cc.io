---
layout: page
title: projects
icon: fas fa-list
order: 1
---

## Project Catalog

{% assign project_posts = site.posts | where_exp: "post", "post.categories contains 'Projects'" | sort_natural: "title" %}
{% assign grouped = project_posts | group_by_exp: "post", "post.categories[1]" | sort_natural: "name" %}

{% for group in grouped %}
### {{ group.name }}

{% for post in group.items %}
- [{{ post.title }}]({{ post.url | relative_url }})  
  {{ post.description }}
{% endfor %}

{% endfor %}
