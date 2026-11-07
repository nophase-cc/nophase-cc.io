#!/usr/bin/env ruby
# frozen_string_literal: true

# Builds feed.json for the home page feed from the sources in _data/feeds.yml.
# Standard library only, so CI needs no bundle install. Handles RSS 2.0, RSS 1.0
# (RDF) and Atom. A source that times out or fails to parse is skipped and
# recorded under `errors`; the run fails only if every source failed, so a bad
# hour never replaces good headlines with an empty file.
#
#   ruby scripts/fetch-feeds.rb [--config _data/feeds.yml] [--out tmp/feed.json]

require 'fileutils'
require 'json'
require 'net/http'
require 'optparse'
require 'rexml/document'
require 'time'
require 'timeout'
require 'uri'
require 'yaml'

ROOT = File.expand_path('..', __dir__)
USER_AGENT = 'nophase.cc feed builder (+https://nophase.cc)'
TITLE_MAX = 160
# Hard limits. Net::HTTP's read timeout resets on every chunk, so a server that
# drip-feeds (common towards datacenter IPs) can stall a fetch for minutes.
SOURCE_TIMEOUT = 25 # seconds per source: fetch + parse
TOTAL_TIMEOUT = 90  # seconds for the whole run; stragglers are dropped
ENTITIES = {
  'amp' => '&', 'lt' => '<', 'gt' => '>', 'quot' => '"', 'apos' => "'", 'nbsp' => ' ',
  'ndash' => '–', 'mdash' => '—', 'lsquo' => '‘', 'rsquo' => '’', 'ldquo' => '“', 'rdquo' => '”',
  'hellip' => '…', 'trade' => '™', 'copy' => '©', 'reg' => '®'
}.freeze

opts = { config: File.join(ROOT, '_data/feeds.yml'), out: File.join(ROOT, 'tmp/feed.json') }
OptionParser.new do |o|
  o.on('--config PATH') { |v| opts[:config] = v }
  o.on('--out PATH') { |v| opts[:out] = v }
end.parse!

def fetch(url, limit = 5)
  raise 'too many redirects' if limit.zero?

  uri = URI(url)
  Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == 'https', open_timeout: 10, read_timeout: 15) do |http|
    req = Net::HTTP::Get.new(uri)
    req['User-Agent'] = USER_AGENT
    req['Accept'] = 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5'
    res = http.request(req)
    case res
    when Net::HTTPSuccess then res.body.to_s
    when Net::HTTPRedirection then fetch(URI.join(url, res['location']).to_s, limit - 1)
    else raise "HTTP #{res.code}"
    end
  end
end

def child(el, name)
  el.elements.find { |c| c.name == name }
end

def text_of(el)
  el && el.texts.map(&:value).join.strip
end

# Titles are often HTML-escaped a second time inside the XML (&amp;#8217;).
def decode_entities(str)
  str.gsub(/&(#x\h+|#\d+|[a-z]+);/i) do
    ref = Regexp.last_match(1)
    if ref.start_with?('#')
      code = ref[1].casecmp?('x') ? ref[2..].to_i(16) : ref[1..].to_i
      code.between?(1, 0x10FFFF) ? [code].pack('U') : ''
    else
      ENTITIES.fetch(ref.downcase, "&#{ref};")
    end
  end
end

def clean_title(raw)
  t = decode_entities(raw.to_s.gsub(/<[^>]*>/, ' ')).gsub(/\s+/, ' ').strip
  # SANS ISC puts a URL and a "(Fri, Nov 6th)" date stamp inside some titles
  t = t.gsub(%r{\s+https?://[^\s,]+}, '').sub(/,?\s*\((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), [^)]*\)\z/, '')
  t.length > TITLE_MAX ? "#{t[0, TITLE_MAX - 1].rstrip}…" : t
end

def item_link(el)
  links = el.elements.select { |c| c.name == 'link' }
  atom = links.find { |l| l.attributes['href'] && [nil, 'alternate'].include?(l.attributes['rel']) } ||
         links.find { |l| l.attributes['href'] }
  url = atom ? atom.attributes['href'] : text_of(links.first)
  if url.to_s.empty?
    guid = child(el, 'guid')
    url = text_of(guid) if guid && guid.attributes['isPermaLink'] != 'false'
  end
  url = url.to_s.strip
  return nil unless url.match?(%r{\Ahttps?://}i)

  strip_tracking(url)
end

def strip_tracking(url)
  uri = URI(url)
  return url unless uri.query

  kept = URI.decode_www_form(uri.query).reject { |k, _| k.start_with?('utm_') }
  uri.query = kept.empty? ? nil : URI.encode_www_form(kept)
  uri.to_s
rescue URI::Error, ArgumentError
  url
end

def item_date(el)
  %w[pubDate published updated date issued].each do |n|
    v = text_of(child(el, n))
    next if v.to_s.empty?

    begin
      return Time.parse(v).utc
    rescue ArgumentError
      next
    end
  end
  nil
end

def collect(node, out)
  node.each_element do |el|
    if %w[item entry].include?(el.name)
      out << el
    else
      collect(el, out)
    end
  end
  out
end

def parse(xml, source)
  doc = REXML::Document.new(xml)
  collect(doc, []).filter_map do |el|
    title = clean_title(text_of(child(el, 'title')))
    url = item_link(el)
    next if title.empty? || url.nil?

    { 'title' => title, 'url' => url, 'source' => source['name'], 'date' => item_date(el) }
  end
end

config = YAML.safe_load(File.read(opts[:config]))
per_source = (config['per_source'] || 3).to_i
limit = (config['limit'] || 6).to_i

jobs = config.fetch('columns').flat_map do |col|
  col.fetch('sources').map { |src| { col: col['title'], src: src } }
end

def now = Process.clock_gettime(Process::CLOCK_MONOTONIC)

started = now
threads = jobs.map do |job|
  Thread.new do
    t0 = now
    items = Timeout.timeout(SOURCE_TIMEOUT) { parse(fetch(job[:src]['feed']), job[:src]) }
    items = items.sort_by { |i| -(i['date']&.to_i || 0) }.first(per_source)
    puts format('  ok %-18s %4.1fs', job[:src]['name'], now - t0)
    job.merge(items: items)
  rescue StandardError, REXML::ParseException => e
    job.merge(items: [], error: "#{e.class}: #{e.message}".lines.first.to_s.strip)
  end
end
results = threads.each_with_index.map do |t, i|
  left = TOTAL_TIMEOUT - (now - started)
  next t.value if left.positive? && t.join(left)

  t.kill
  jobs[i].merge(items: [], error: "gave up after #{TOTAL_TIMEOUT}s")
end

ok = 0
columns = config['columns'].map do |col|
  mine = results.select { |r| r[:col] == col['title'] }
  errors = mine.select { |r| r[:error] }
  ok += mine.size - errors.size
  errors.each { |r| warn "  ! #{r[:src]['name']}: #{r[:error]}" }

  items = mine.flat_map { |r| r[:items] }
              .sort_by { |i| -(i['date']&.to_i || 0) }
              .first(limit)
              .map { |i| i.merge('date' => i['date']&.iso8601) }

  { 'title' => col['title'], 'items' => items, 'errors' => errors.map { |r| r[:src]['name'] } }
end

if ok.zero?
  warn 'Every source failed; not writing feed.json.'
  exit 1
end

FileUtils.mkdir_p(File.dirname(opts[:out]))
File.write(opts[:out], JSON.pretty_generate('generated' => Time.now.utc.iso8601, 'columns' => columns))
puts "Wrote #{opts[:out]}: #{ok}/#{jobs.size} sources, " \
     "#{columns.sum { |c| c['items'].size }} headlines."
