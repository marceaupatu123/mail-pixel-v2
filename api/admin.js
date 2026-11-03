// Page d'administration : /admin?key=TA_CLE
const crypto = require("crypto");
const { pipeline, toObj } = require("../lib/redis");
const { TTL, getIp } = require("../lib/common");

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => (n ? new Date(Number(n)).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" }) : "—");

module.exports = async (req, res) => {
  const key = String(req.query.key || "");
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    res.status(401).setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.send("Accès refusé : ajoute ?key=TA_CLE à l'adresse.");
  }

  const base = "https://" + req.headers.host;
  let created = null, error = "";
  try {
    if (req.method === "POST") {
      const note = String((req.body && req.body.note) || "").trim().slice(0, 80) || "Sans nom";
      const id = crypto.randomBytes(6).toString("hex"); // identifiant opaque : rien de lisible dans l'URL
      const now = Date.now();
      await pipeline([
        ["HSET", "t:" + id, "created", now, "note", note],
        ["EXPIRE", "t:" + id, TTL],
        ["ZADD", "labels", now, id],
      ]);
      created = { id, note };
    }
    // Cette visite te marque comme « expéditeur » (cookie + IP pendant 6 h)
    await pipeline([["SET", "own:" + getIp(req), "1", "EX", 21600]]);
  } catch (e) { error = e.message; }

  let rows = [];
  try {
    const ids = (await pipeline([["ZREVRANGE", "labels", 0, 49]]))[0] || [];
    if (ids.length) {
      const all = await pipeline(ids.map((i) => ["HGETALL", "t:" + i]));
      rows = ids.map((id, n) => ({ id, ...toObj(all[n]) })).filter((r) => r.created);
    }
  } catch (e) { error = error || e.message; }

  res.setHeader("Set-Cookie", "tp_me=1; Max-Age=31536000; Path=/; Secure; SameSite=None; HttpOnly");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");

  const snippet = (id) => `<img src="${base}/i/${id}.png" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`;

  res.send(`<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Suivi des mails</title>
<style>
:root{--bg:#f2f5f8;--panel:#fff;--ink:#14202b;--mute:#5d6b78;--line:#d9e0e7;--blue:#0055a5;--green:#12803f;--warn:#a15c00;--code:#eaf1f8}
@media (prefers-color-scheme:dark){:root{--bg:#0f1720;--panel:#17212c;--ink:#e8eef4;--mute:#93a2b1;--line:#27343f;--blue:#5aa9ff;--green:#4ade80;--warn:#fbbf24;--code:#0c131a}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:860px;margin:0 auto;padding:28px 18px 60px}
h1{font:600 26px/1.2 Georgia,"Times New Roman",serif;margin:0 0 4px}
p.sub{margin:0 0 24px;color:var(--mute)}
section{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px;margin-bottom:18px}
h2{font-size:16px;margin:0 0 12px}
form{display:flex;gap:8px;flex-wrap:wrap}
input[type=text]{flex:1 1 220px;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font:inherit}
button{padding:10px 16px;border:0;border-radius:8px;background:var(--blue);color:#fff;font:inherit;font-weight:600;cursor:pointer}
button.alt{background:transparent;color:var(--blue);border:1px solid var(--blue);padding:6px 12px;font-size:14px}
:focus-visible{outline:3px solid var(--blue);outline-offset:2px}
textarea{width:100%;margin:10px 0;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--code);color:var(--ink);font:13px/1.4 ui-monospace,Menlo,Consolas,monospace;resize:vertical}
.ok{border-color:var(--green)}.err{color:var(--warn);margin:0 0 14px}
.scroll{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);white-space:nowrap}
th{font-weight:600;color:var(--mute)}
td.n{font-weight:700;color:var(--green)}td.z{color:var(--mute);font-weight:400}
small{color:var(--mute)}
</style></head><body><main>
<h1>Suivi des mails</h1>
<p class="sub">Un pixel par mail : tu sais lequel a été ouvert, et combien de fois.</p>
${error ? `<p class="err">Erreur : ${esc(error)}</p>` : ""}
<section>
<h2>Créer un pixel</h2>
<form method="post" action="/admin?key=${encodeURIComponent(key)}">
<input type="text" name="note" placeholder="Ex. : Mme Dupont, candidature stage" maxlength="80" required>
<button type="submit">Créer le pixel</button>
</form>
<small>Le nom reste chez toi : le destinataire ne voit qu'un code aléatoire dans l'adresse de l'image.</small>
</section>
${created ? `<section class="ok"><h2>Pixel « ${esc(created.note)} » prêt</h2>
<small>Colle ce code dans le corps du mail (éditeur HTML de Zimbra, ou insertion d'image par URL).</small>
<textarea id="snip" rows="3" readonly>${esc(snippet(created.id))}</textarea>
<button class="alt" type="button" onclick="navigator.clipboard.writeText(document.getElementById('snip').value);this.textContent='Copié'">Copier le code</button>
<br><small>Adresse seule : ${esc(base)}/i/${esc(created.id)}.png</small></section>` : ""}
<section>
<h2>Derniers mails suivis</h2>
${rows.length ? `<div class="scroll"><table><thead><tr><th>Mail</th><th>Créé</th><th>Ouvertures</th><th>1re ouverture</th><th>Dernière</th><th>Autres</th><th></th></tr></thead><tbody>
${rows.map((r) => `<tr><td>${esc(r.note)}</td><td class="z">${fmt(r.created)}</td><td class="n">${Number(r.opens || 0) || '<span class="z">0</span>'}</td><td>${fmt(r.first)}</td><td>${fmt(r.last)}</td><td class="z">${Number(r.own || 0)} à toi, ${Number(r.bots || 0)} robots</td><td><button class="alt" type="button" onclick="navigator.clipboard.writeText(${esc(JSON.stringify(snippet(r.id)))});this.textContent='Copié'">Code</button></td></tr>`).join("")}
</tbody></table></div>` : "<small>Aucun pixel pour l'instant : crée le premier ci-dessus.</small>"}
</section>
</main></body></html>`);
};
