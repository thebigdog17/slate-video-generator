import express from "express";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set("trust proxy", 1); // Render sits behind a proxy
app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));

const TOKEN = process.env.REPLICATE_API_TOKEN;
const MODEL = process.env.REPLICATE_MODEL || "minimax/video-01";
const DAILY_CAP = Number(process.env.MAX_GENERATIONS_PER_DAY || 20);
const PER_IP_HOUR = Number(process.env.MAX_PER_IP_PER_HOUR || 3);

let EXTRA_INPUT = {};
try {
  if (process.env.REPLICATE_EXTRA_INPUT) EXTRA_INPUT = JSON.parse(process.env.REPLICATE_EXTRA_INPUT);
} catch {
  console.warn("REPLICATE_EXTRA_INPUT is not valid JSON, ignoring it.");
}

// Global daily cap so a leaked URL can't drain your balance.
let capDay = new Date().toISOString().slice(0, 10);
let capUsed = 0;
function underDailyCap() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== capDay) { capDay = today; capUsed = 0; }
  return capUsed < DAILY_CAP;
}

const generateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: PER_IP_HOUR,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: `Limit reached: ${PER_IP_HOUR} videos per hour. Try again later.` },
});

const replicate = (url, options = {}) =>
  fetch(`https://api.replicate.com/v1${url}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

app.post("/api/generate", generateLimiter, async (req, res) => {
  if (!TOKEN) return res.status(500).json({ error: "Server is missing REPLICATE_API_TOKEN." });

  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
  if (prompt.length < 5 || prompt.length > 500) {
    return res.status(400).json({ error: "Describe your video in 5 to 500 characters." });
  }
  if (!underDailyCap()) {
    return res.status(429).json({ error: "Daily generation limit reached. Try again tomorrow." });
  }

  try {
    const r = await replicate(`/models/${MODEL}/predictions`, {
      method: "POST",
      body: JSON.stringify({ input: { prompt, ...EXTRA_INPUT } }),
    });
    const data = await r.json();
    if (!r.ok) {
      console.error("Replicate create error:", data);
      return res.status(502).json({ error: data?.detail || "The video service rejected the request." });
    }
    capUsed += 1;
    res.json({ id: data.id, status: data.status });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "Could not reach the video service." });
  }
});

app.get("/api/status/:id", async (req, res) => {
  if (!TOKEN) return res.status(500).json({ error: "Server is missing REPLICATE_API_TOKEN." });
  if (!/^[a-z0-9]+$/i.test(req.params.id)) return res.status(400).json({ error: "Bad id." });

  try {
    const r = await replicate(`/predictions/${req.params.id}`);
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: data?.detail || "Status check failed." });

    const out = Array.isArray(data.output) ? data.output[0] : data.output;
    res.json({
      status: data.status, // starting | processing | succeeded | failed | canceled
      videoUrl: data.status === "succeeded" ? out : null,
      error: data.status === "failed" ? data.error || "Generation failed." : null,
    });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "Could not reach the video service." });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Slate running on http://localhost:${port} (model: ${MODEL})`));
