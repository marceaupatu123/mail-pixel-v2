// Pixel de suivi -> /i/<id>.png
const { pipeline, toObj } = require("../lib/redis");
const { GIF, TTL, getIp, hasOwnCookie, classifyUA, fmtDelay } = require("../lib/common");

async function handle(req) {
  if (req.method !== "GET") return; // ignore HEAD & co

  const id = String(req.query.label || "").toLowerCase().replace(/\.(png|gif|jpe?g)$/, "");
  if (!/^[a-z0-9]{6,32}$/.test(id)) return;

  const ip = getIp(req);
  const ua = String(req.headers["user-agent"] || "");
  const now = Date.now();

  const [raw, ownIp] = await pipeline([
    ["HGETALL", "t:" + id],
    ["EXISTS", "own:" + ip],
  ]);
  const t = toObj(raw);
  if (!t.created) return; // pixel inconnu : on ignore (protège Discord du spam)

  // 1) Est-ce toi ? (cookie, IP apprise à la création/consultation, IP fixes)
  const envOwn = (process.env.OWN_IPS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const isOwn = hasOwnCookie(req) || ownIp === 1 || envOwn.includes(ip);

  // 2) Qui ouvre ? robot, proxy, Apple...
  const c = classifyUA(ua);
  const ageSec = (now - Number(t.created)) / 1000;
  const FAST = Number(process.env.FAST_SECONDS ?? 90);
  const fast = ageSec < FAST;

  let verdict, reason = "";
  if (isOwn) verdict = "own";
  else if (c.kind === "bot") verdict = "bot";
  else if (c.kind === "apple") { verdict = "suspect"; reason = "client Apple : peut être un préchargement automatique (Mail Privacy Protection)"; }
  else if (fast) { verdict = "suspect"; reason = "arrivé moins de " + FAST + " s après la création du pixel"; }
  else verdict = "real";

  const counted = verdict === "real" || verdict === "suspect";
  const opens = Number(t.opens || 0) + (counted ? 1 : 0);

  // 3) Faut-il alerter ? 1re ouverture, puis seulement après REOPEN_MIN minutes
  const reopenMs = (Number(process.env.REOPEN_MIN) || 15) * 60000;
  let notify = counted && (opens === 1 || now - Number(t.lastNotif || 0) > reopenMs);
  if (verdict === "suspect" && process.env.NOTIFY_SUSPECT === "0") notify = false;
  if (verdict === "bot" && process.env.NOTIFY_BOT === "1") notify = true;

  // 4) Lieu (inutile pour le proxy Google : c'est la position d'un serveur Google)
  let place = "serveur Google (position du destinataire inconnue)";
  if (c.kind !== "google") {
    let city = "";
    try { city = decodeURIComponent(req.headers["x-vercel-ip-city"] || ""); } catch {}
    place = [city, req.headers["x-vercel-ip-country"]].filter(Boolean).join(", ") || "inconnu";
  }

  // 5) Enregistrement
  const key = "t:" + id;
  const cmds = [
    ["LPUSH", "h:" + id, JSON.stringify({ ts: now, v: verdict, client: c.name, place })],
    ["LTRIM", "h:" + id, 0, 49],
    ["EXPIRE", "h:" + id, TTL],
    ["EXPIRE", key, TTL],
  ];
  if (counted) {
    cmds.push(["HINCRBY", key, "opens", 1], ["HSET", key, "last", now]);
    if (!t.first) cmds.push(["HSET", key, "first", now]);
  } else {
    cmds.push(["HINCRBY", key, verdict === "own" ? "own" : "bots", 1]);
  }
  if (notify) cmds.push(["HSET", key, "lastNotif", now]);
  await pipeline(cmds);

  // 6) Alerte Discord
  if (notify && process.env.DISCORD_WEBHOOK_URL) {
    const real = verdict === "real";
    await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        allowed_mentions: { parse: [] },
        embeds: [{
          title: "📬 " + (t.note || id),
          color: verdict === "bot" ? 0x6b7280 : real ? 0x22c55e : 0xf59e0b,
          description: real ? "✅ **Ouverture probable**" : verdict === "bot" ? "🤖 **Robot probable**" : "⚠️ **Ouverture douteuse** : " + reason,
          fields: [
            { name: "Ouverture n°", value: String(opens), inline: true },
            { name: "Délai depuis création", value: fmtDelay(ageSec), inline: true },
            { name: "Client", value: c.name, inline: true },
            { name: "Lieu approx.", value: place },
          ],
          timestamp: new Date(now).toISOString(),
        }],
      }),
      signal: AbortSignal.timeout(3000),
    });
  }
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  try { await handle(req); } catch (e) { console.error("pixel error:", e.message); }
  res.status(200).send(GIF);
};
