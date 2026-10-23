const ORIGIN = "https://d1d34p8vz63oiq.cloudfront.net";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Expose-Headers": "*",
};

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    // URL format: /<encoded-token>/<origin path>
    const url = new URL(request.url);
    const [, token, ...rest] = url.pathname.split("/");
    if (!token || !rest.length) {
      return new Response("Bad request", { status: 400, headers: CORS });
    }

    const query = decodeURIComponent(token);
    const target = `${ORIGIN}/${rest.join("/")}?${query}`;

    const headers = new Headers();
    const range = request.headers.get("Range");
    if (range) headers.set("Range", range);

    const res = await fetch(target, { headers });
    const out = new Headers(res.headers);
    for (const [k, v] of Object.entries(CORS)) out.set(k, v);

    return new Response(res.body, { status: res.status, headers: out });
  },
};
