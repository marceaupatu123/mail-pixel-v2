// À placer dans : api/create.js
const crypto = require("crypto");
const { pipeline } = require("../lib/redis");
const { TTL, getIp } = require("../lib/common");

const h = (s) => crypto.createHash("sha256").update(String(s)).digest();

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  
  const out = (code, obj) => res.status(code).send(JSON.stringify(obj));

  if (req.method !== "POST") return out(405, { error: "POST uniquement" });

  const b = req.body || {};
  if (!process.env.ADMIN_KEY || !crypto.timingSafeEqual(h(b.key || ""), h(process.env.ADMIN_KEY))) {
    return out(401, { error: "clé invalide" });
  }

  try {
    const note = String(b.note || "").trim().slice(0, 100) || "Sans nom";
    const id = crypto.randomBytes(6).toString("hex");
    const now = Date.now();

    await pipeline([
      ["HSET", "t:" + id, "created", now, "note", note],
      ["EXPIRE", "t:" + id, TTL],
      ["ZADD", "labels", now, id],
      ["SET", "own:" + getIp(req), "1", "EX", 21600], // IP expéditeur
    ]);

    return out(200, { id });
  } catch (e) {
    return out(500, { error: e.message });
  }
};