/**
 * Cloudflare Worker entry for docs.artofinfra.com.
 *
 * Logs each .md fetch as a custom event to a Umami-compatible
 * endpoint, then hands off to the static asset handler.
 *
 * Config (set as runtime env vars in the Cloudflare dashboard under
 * Workers > Settings > Variables and Secrets):
 *   UMAMI_ENDPOINT   - Umami /api/send URL
 *   UMAMI_WEBSITE_ID - Umami website UUID
 * Both must be set for logging to fire; if unset, the Worker just
 * passes through to assets (useful for staging or rollback).
 *
 * Requires assets.run_worker_first: true in wrangler.jsonc so the
 * Worker actually intercepts asset requests.
 *
 * The outbound POST to Umami uses a static real-browser User-Agent
 * so Umami's global bot filter accepts the event. The real AI client
 * UA travels in payload.data.client. A custom-product UA like
 * "Mozilla/5.0 (compatible; X/1.0)" gets bot-filtered because it
 * matches the Googlebot UA shape, so we send a real Chrome string.
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (
      url.pathname.endsWith('.md') &&
      env.UMAMI_ENDPOINT &&
      env.UMAMI_WEBSITE_ID
    ) {
      ctx.waitUntil(logToUmami(request, url, env));
    }

    return env.ASSETS.fetch(request);
  },
};

async function logToUmami(request, url, env) {
  try {
    await fetch(env.UMAMI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Send a real Chrome UA so Umami's global bot filter accepts
        // the event. AI client UAs (Claude-User, Cursor, etc.) and
        // custom-product UAs (anything shaped like "Mozilla/5.0
        // (compatible; X/1.0)") all get bot-filtered. The real client
        // UA is preserved in payload.data.client below.
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'X-Forwarded-For': request.headers.get('cf-connecting-ip') || '',
      },
      body: JSON.stringify({
        type: 'event',
        payload: {
          website: env.UMAMI_WEBSITE_ID,
          hostname: url.hostname,
          url: url.pathname,
          name: 'doc_fetch',
          // Surface path, category, and the real client UA as event
          // properties so the Umami Properties tab shows aggregate
          // counts per doc, per section, and per AI client.
          data: {
            path: url.pathname,
            category: categoryOf(url.pathname),
            client: request.headers.get('user-agent') || 'unknown',
          },
        },
      }),
    });
  } catch {
    // Logging failures must never break the response.
  }
}

// First path segment, e.g. /cisco/ios-xe.md -> "cisco", /router.md -> "router".
function categoryOf(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length <= 1) return segments[0]?.replace(/\.md$/, '') || 'root';
  return segments[0];
}
