---
layout: compress
permalink: '/:path/swconf.js'
# Note that this file will be fetched by the ServiceWorker, so it will not be cached.
---

const swconf = {
  {% if site.pwa.cache.enabled %}
    cacheName: 'chirpy-{{ site.time | date: "%s" }}',

    {%- comment -%} Resources added to the cache during PWA installation. {%- endcomment -%}
    resources: [
      '{{ "/assets/css/:THEME.css" | replace: ':THEME', site.theme | relative_url }}?v={{ site.time | date: "%s" }}',
      '{{ "/" | relative_url }}',
      {% for tab in site.tabs %}
        '{{- tab.url | relative_url -}}',
      {% endfor %}

      {% assign cache_list = site.static_files | where: 'swcache', true %}
      {% for file in cache_list %}
        '{{ file.path | relative_url }}'{%- unless forloop.last -%},{%- endunless -%}
      {% endfor %}
    ],

    interceptor: {
      {%- comment -%} URLs containing the following paths will not be cached. {%- endcomment -%}
      paths: [
        {% for path in site.pwa.cache.deny_paths %}
          {% unless path == empty %}
            '{{ path | relative_url }}'{%- unless forloop.last -%},{%- endunless -%}
          {% endunless  %}
        {% endfor %}
      ],

      {%- comment -%} URLs containing the following prefixes will not be cached. {%- endcomment -%}
      urlPrefixes: [
        {% if site.analytics.goatcounter.id != nil and site.pageviews.provider == 'goatcounter' %}
          'https://{{ site.analytics.goatcounter.id }}.goatcounter.com/counter/',
        {% endif %}
        {%- comment -%} The home page feed changes every couple of hours; always fetch it fresh. {%- endcomment -%}
        {% if site.data.feeds.data_url %}
          '{{ site.data.feeds.data_url }}',
        {% endif %}
        {%- comment -%} The DNS lookup tool must never answer from cache. {%- endcomment -%}
        'https://cloudflare-dns.com/dns-query',
        'https://dns.google/resolve'
      ]
    },

    purge: false
  {% else %}
    purge: true
  {% endif %}
};
