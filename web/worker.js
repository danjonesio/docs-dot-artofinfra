/**
 * Cloudflare Worker entry for docs.artofinfra.com.
 *
 * Single purpose: log every fetch of a markdown doc to a Workers
 * Analytics Engine dataset so we can see which docs AI agents are
 * actually pulling. Then hand off to the static asset handler.
 *
 * Privacy: we log pathname, user-agent, referer, and country (from
 * Cloudflare's existing edge geolocation). No IP, no request body
 * (these are GETs anyway), no cookies. Consistent with the FAQ
 * statement that "Cloudflare logs request paths for hosting
 * purposes, not prompts."
 *
 * The Worker is invoked for every request because wrangler.jsonc
 * binds the assets via `assets.binding: "ASSETS"`. Non-markdown
 * requests (homepage, _astro/*, og.png, etc.) just pass straight
 * through to the asset handler without writing a data point.
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Only meter markdown fetches — that's the AI-readable surface.
    // Skip homepage, _astro/ assets, OG image, favicon, robots.txt, sitemaps.
    if (url.pathname.endsWith('.md') && env.DOC_FETCHES) {
      try {
        env.DOC_FETCHES.writeDataPoint({
          // Up to 20 blob strings of metadata. Order is the contract:
          //   blob1 = pathname
          //   blob2 = user-agent
          //   blob3 = referer
          //   blob4 = country (Cloudflare edge geolocation)
          blobs: [
            url.pathname,
            request.headers.get('user-agent') || '',
            request.headers.get('referer') || '',
            request.cf?.country || '',
          ],
          // One data point = one fetch. Doubles support sums/averages.
          doubles: [1],
          // Sample index keeps related rows together. Pathname makes the
          // highest-cardinality stat queryable. Capped at 96 chars per CF limit.
          indexes: [url.pathname.slice(0, 96)],
        });
      } catch {
        // Logging failures must never break the response.
      }
    }

    return env.ASSETS.fetch(request);
  },
};
