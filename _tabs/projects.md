---
layout: page
title: projects
icon: fas fa-list
order: 1
---

## Project Catalog

{% assign project_posts = site.posts | where_exp: "post", "post.categories contains 'Projects'" %}
{% assign grouped = project_posts | group_by_exp: "post", "post.categories[1]" %}

{% for group in grouped %}
### {{ group.name }}

{% for post in group.items %}
- [{{ post.title }}]({{ post.url | relative_url }})  
  {{ post.description }}
{% endfor %}

{% endfor %}
