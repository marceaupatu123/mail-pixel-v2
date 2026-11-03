// Client Redis minimal via l'API REST d'Upstash (aucune dépendance).
// Accepte les deux noms de variables les plus courants sur Vercel.
function conf() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("Redis non configuré (variables REST URL / TOKEN manquantes)");
  return { url, token };
}

async function pipeline(cmds) {
  const { url, token } = conf();
  const r = await fetch(url.replace(/\/$/, "") + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
    signal: AbortSignal.timeout(4000),
  });
  const data = await r.json();
  if (!Array.isArray(data)) throw new Error("Réponse Redis invalide: " + JSON.stringify(data));
  return data.map((d) => {
    if (d.error) throw new Error(d.error);
    return d.result;
  });
}

// HGETALL renvoie [k1, v1, k2, v2, ...] -> objet
function toObj(arr) {
  const o = {};
  for (let i = 0; i < (arr || []).length; i += 2) o[arr[i]] = arr[i + 1];
  return o;
}

module.exports = { pipeline, toObj };
