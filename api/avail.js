// 일정 응답 저장 API (Vercel Serverless Function)
// 저장소: Upstash Redis (Vercel Storage 탭에서 연결하면 환경변수가 자동으로 들어갑니다)

const PEOPLE = ["mentor", "yuri", "yunsu", "hyunggyu"];
const SLOT = /^[0-6]-(9|1[0-9]|2[01])$/; // 월(0)~일(6), 09~21시 시작 1시간 칸
const KEY = "mentoring:avail";

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(command) {
  const r = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  const json = await r.json();
  if (!r.ok || json.error) throw new Error(json.error || `Redis ${r.status}`);
  return json.result;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!URL_ || !TOKEN) {
    return res.status(500).json({ error: "storage_not_connected" });
  }
  try {
    if (req.method === "GET") {
      const flat = (await redis(["HGETALL", KEY])) || [];
      const people = {};
      for (let i = 0; i < flat.length; i += 2) {
        try { people[flat[i]] = JSON.parse(flat[i + 1]); } catch {}
      }
      return res.status(200).json({ people });
    }
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const { who, slots } = body;
      if (!PEOPLE.includes(who)) return res.status(400).json({ error: "unknown_person" });
      if (!Array.isArray(slots) || slots.length > 91 || !slots.every((s) => typeof s === "string" && SLOT.test(s))) {
        return res.status(400).json({ error: "invalid_slots" });
      }
      const clean = [...new Set(slots)].sort();
      await redis(["HSET", KEY, who, JSON.stringify(clean)]);
      return res.status(200).json({ ok: true, slots: clean });
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method_not_allowed" });
  } catch (e) {
    return res.status(502).json({ error: "storage_error" });
  }
}
