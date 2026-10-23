const ORIGIN = "https://d1d34p8vz63oiq.cloudfront.net";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Expose-Headers": "*",
};

const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DRM Player</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; padding: 12px; background: #111; color: #eee; }
  video { width: 100%; background: #000; max-height: 60vh; }
  label { display: block; margin-top: 10px; font-size: 13px; color: #aaa; }
  input { width: 100%; box-sizing: border-box; padding: 8px; background: #222; color: #eee; border: 1px solid #444; border-radius: 6px; }
  button { margin-top: 12px; padding: 10px 18px; border: 0; border-radius: 6px; background: #2f7df6; color: #fff; font-size: 15px; }
  #log { margin-top: 12px; font-size: 12px; color: #f90; white-space: pre-wrap; word-break: break-all; }
</style>
</head>
<body>
<video id="v" controls autoplay playsinline></video>

<label>Manifest URL (the master.mpd URL, without the signed part)</label>
<input id="manifest" value="https://d1d34p8vz63oiq.cloudfront.net/drm/1a5fa7ae-0c2e-4830-b4bf-c267d5e0001d/master.mpd">

<label>signedUrl (starts with ?Signature=...)</label>
<input id="signed" placeholder="?Signature=...&Key-Pair-Id=...&Policy=...">

<label>License server URL</label>
<input id="license" placeholder="https://api.penpencil.co/v1/videos/drm-license-manager">

<label>License token (licenseToken value)</label>
<input id="token" placeholder="eyJkcm1fdHlwZSI6...">

<button id="go">Play</button>
<div id="log"></div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/shaka-player/4.10.0/shaka-player.compiled.js"></script>
<script>
  var logEl = document.getElementById("log");
  function log(m) { logEl.textContent += m + "\\n"; }
  function val(id) {
    return document.getElementById(id).value.trim().replace(/^["']+|["',]+$/g, "");
  }

  var player;
  document.getElementById("go").onclick = async function () {
    logEl.textContent = "";
    try {
      shaka.polyfill.installAll();
      if (!shaka.Player.isBrowserSupported()) { log("Browser not supported"); return; }

      var manifest = new URL(val("manifest"));
      var signed = val("signed").replace(/^\\?/, "");
      var licenseUrl = val("license");
      var licenseToken = val("token");
      var src = location.origin + "/" + encodeURIComponent(signed) + manifest.pathname;

      if (player) await player.destroy();
      var video = document.getElementById("v");
      player = new shaka.Player();
      await player.attach(video);

      player.configure({
        drm: { servers: { "com.widevine.alpha": licenseUrl } }
      });

      player.getNetworkingEngine().registerRequestFilter(function (type, req) {
        if (type === shaka.net.NetworkingEngine.RequestType.LICENSE) {
          req.headers["pallycon-customdata-v2"] = licenseToken;
        }
      });

      player.addEventListener("error", function (e) {
        log("Player error " + e.detail.code + ": " + (e.detail.message || ""));
      });

      await player.load(src);
      log("Loaded OK");
    } catch (e) {
      log("Error " + (e.code || "") + ": " + (e.message || e));
    }
  };
</script>
</body>
</html>`;

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);

    // Player page
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Proxy: /<encoded-token>/<origin path>
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
