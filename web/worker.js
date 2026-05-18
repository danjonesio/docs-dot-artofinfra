/**
 * Cloudflare Worker entry for docs.artofinfra.com.
 *
 * Logs every fetch of a markdown doc to the self-hosted Umami
 * instance as a custom event, then hands off to the static asset
 * handler. Events show under Umami's "Events" tab alongside human
 * pageviews on the homepage, so AI-agent fetches do not inflate
 * pageview counts.
 *
 * Privacy: we forward only what Umami needs to parse the client:
 * pathname, user-agent, and the Cloudflare-derived client IP for
 * country lookup. No cookies, no request body (these are GETs).
 *
 * The Worker is invoked for every request because wrangler.jsonc
 * sets assets.run_worker_first: true. Non-markdown requests pass
 * straight through to the asset handler without any outbound call.
 */
const UMAMI_ENDPOINT = 'https://mando.trfs.fyi/api/send';
const UMAMI_WEBSITE_ID = '01577929-b895-4f56-ba16-1354702a38ae';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.endsWith('.md')) {
      ctx.waitUntil(logToUmami(request, url));
    }

    return env.ASSETS.fetch(request);
  },
};

async function logToUmami(request, url) {
  try {
    await fetch(UMAMI_ENDPOINT, {
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
          website: UMAMI_WEBSITE_ID,
          hostname: url.hostname,
          url: url.pathname,
          name: 'doc_fetch',
        },
      }),
    });
  } catch {
    // Logging failures must never break the response.
  }
}
