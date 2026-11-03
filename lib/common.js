const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
const TTL = 60 * 60 * 24 * 90; // les données expirent après 90 jours

function getIp(req) {
  return String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
}

function hasOwnCookie(req) {
  return /(?:^|;\s*)tp_me=1(?:;|$)/.test(String(req.headers.cookie || ""));
}

// Classe le client à partir du User-Agent
function classifyUA(ua) {
  const BOT = /bot|crawl|spider|scan|barracuda|proofpoint|mimecast|safelinks|defender|symantec|trendmicro|forcepoint|curl|wget|python|node-fetch|axios|go-http|java\//i;
  if (BOT.test(ua)) return { name: "Scanner / robot", kind: "bot" };
  if (/GoogleImageProxy/i.test(ua)) return { name: "Gmail (proxy Google)", kind: "google" };
  if (/YahooMailProxy/i.test(ua)) return { name: "Yahoo Mail (proxy)", kind: "proxy" };
  if (/Thunderbird/i.test(ua)) return { name: "Thunderbird", kind: "normal" };
  if (/Outlook|Microsoft Office/i.test(ua)) return { name: "Outlook", kind: "normal" };
  if (/iPhone|iPad|Macintosh/i.test(ua)) return { name: "Apple (Mail / Safari)", kind: "apple" };
  if (/Android/i.test(ua)) return { name: "Android", kind: "normal" };
  if (/Windows|Linux|X11/i.test(ua)) return { name: "Ordinateur (Windows/Linux)", kind: "normal" };
  return { name: ua.slice(0, 60) || "inconnu", kind: "normal" };
}

function fmtDelay(sec) {
  if (sec < 90) return Math.round(sec) + " s";
  if (sec < 5400) return Math.round(sec / 60) + " min";
  if (sec < 172800) return Math.round(sec / 3600) + " h";
  return Math.round(sec / 86400) + " j";
}

module.exports = { GIF, TTL, getIp, hasOwnCookie, classifyUA, fmtDelay };
