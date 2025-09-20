const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const VALID_TYPES = new Set(["FCR", "CR", "IRR", "RMA"]);

function getISTYearMonth() {
  const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const y = nowIST.getFullYear();
  const m = String(nowIST.getMonth() + 1).padStart(2, "0");
  return { year: String(y), month: m, ym: `${y}-${m}` };
}

async function incrCounter(key) {
  const res = await fetch(`${UPSTASH_URL}/incr/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Upstash INCR failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return Number(data.result);
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

exports.handler = async (event) => {
  const origin = ALLOWED_ORIGIN && event.headers.origin === ALLOWED_ORIGIN
    ? ALLOWED_ORIGIN : ALLOWED_ORIGIN || "*";

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: corsHeaders(origin) };

  if (event.httpMethod !== "POST")
    return { statusCode: 405, headers: corsHeaders(origin), body: JSON.stringify({ error: "Method Not Allowed" }) };

  try {
    const body = JSON.parse(event.body || "{}");
    const type = String(body.type || "").toUpperCase().trim();
    if (!VALID_TYPES.has(type))
      return { statusCode: 400, headers: corsHeaders(origin), body: JSON.stringify({ error: "Use one of FCR, CR, IRR, RMA." }) };

    const { year, month, ym } = getISTYearMonth();
    const key = `counter:${type}:${ym}`;
    const seq = await incrCounter(key);
    const padded = String(seq).padStart(4, "0");
    const caseId = `${type}-${year}-${month}-${padded}`;

    return { statusCode: 200, headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
             body: JSON.stringify({ caseId, year, month, seq }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders(origin), body: JSON.stringify({ error: err.message || "Server error" }) };
  }
};
