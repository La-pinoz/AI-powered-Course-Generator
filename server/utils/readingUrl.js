// The only place a "Further reading" link is built. The AI gives a search phrase, never a URL, so a
// link can't point at a made-up page or at another site.
const SEARCH_URL = 'https://www.google.com/search';

export function readingUrl(searchQuery) {
  const url = new URL(SEARCH_URL);
  url.searchParams.set('q', searchQuery); // encodes the phrase, so it stays inside `q`
  return url.href;
}
