import Parser from 'rss-parser'

type HNStory = { title: string; url: string; score: number; by: string; time: number }
type RedditStory = { title: string; url: string; score: number; author: string; created_utc: number }
type RSSStory = { title: string; link: string; pubDate: string; contentSnippet: string }

export async function fetchHNStories(maxResults = 5): Promise<HNStory[]> {
  const res = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json')
  if (!res.ok) throw new Error(`HN fetch failed: ${res.status}`)
  const ids = (await res.json()) as number[]
  const top = ids.slice(0, maxResults)
  const stories = await Promise.all(
    top.map(async (id) => {
      const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
      if (!r.ok) return null
      return (await r.json()) as HNStory
    })
  )
  return stories.filter((s): s is HNStory => s !== null)
}

export async function fetchRedditStories(subreddit: string, maxResults = 5): Promise<RedditStory[]> {
  const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=${maxResults}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'OnTrack-Agent/1.0' },
  })
  if (!res.ok) throw new Error(`Reddit fetch failed: ${res.status}`)
  const data = (await res.json()) as {
    data: { children: Array<{ data: RedditStory }> }
  }
  return data.data.children.map((c) => ({
    title: c.data.title,
    url: c.data.url,
    score: c.data.score,
    author: c.data.author,
    created_utc: c.data.created_utc,
  }))
}

export async function fetchRSSStories(feedUrl: string, maxResults = 5): Promise<RSSStory[]> {
  const parser = new Parser()
  const feed = await parser.parseURL(feedUrl)
  return feed.items.slice(0, maxResults).map((item) => ({
    title: item.title || '',
    link: item.link || '',
    pubDate: item.pubDate || '',
    contentSnippet: item.contentSnippet || '',
  }))
}

function detectSourceType(source: string): 'hn' | 'reddit' | 'rss' {
  if (source === 'hn') return 'hn'
  if (source.startsWith('r/')) return 'reddit'
  return 'rss'
}

export async function fetchNewsForAgent(
  sources: string[],
  topics: string[],
  maxResults = 10
): Promise<Array<Record<string, unknown>>> {
  const results: Array<Record<string, unknown>> = []

  for (const source of sources) {
    try {
      const type = detectSourceType(source)
      if (type === 'hn') {
        const stories = await fetchHNStories(maxResults)
        results.push(...stories.map((s) => ({ ...s, source: 'hn' })))
      } else if (type === 'reddit') {
        const sub = source.replace('r/', '')
        const stories = await fetchRedditStories(sub, maxResults)
        results.push(...stories.map((s) => ({ ...s, source })))
      } else {
        const stories = await fetchRSSStories(source, maxResults)
        results.push(...stories.map((s) => ({ ...s, source })))
      }
    } catch {
      console.error(`[news] failed to fetch from ${source}`)
    }
  }

  if (topics.length > 0) {
    const lowerTopics = topics.map((t) => t.toLowerCase())
    return results.filter((item) => {
      const title = String(item.title || '').toLowerCase()
      return lowerTopics.some((t) => title.includes(t))
    })
  }

  return results
}
