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
        // Forward the real client headers so Umami's UA/geo parsing
        // sees the AI agent, not the Worker's edge IP.
        'User-Agent': request.headers.get('user-agent') || 'unknown',
        'X-Forwarded-For': request.headers.get('cf-connecting-ip') || '',
      },
      body: JSON.stringify({
        type: 'event',
        payload: {
          website: env.UMAMI_WEBSITE_ID,
          hostname: url.hostname,
          url: url.pathname,
          name: 'doc_fetch',
          // Surface path + category as event properties so the Umami
          // Properties tab shows aggregate counts per doc and per
          // section (cisco, juniper, general, etc.).
          data: {
            path: url.pathname,
            category: categoryOf(url.pathname),
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
