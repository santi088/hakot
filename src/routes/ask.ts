import express from "express";
import { askRAG } from "../rag";

const router = express.Router();
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60000;
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now >= entry.resetAt) rateLimitMap.delete(ip);
  }
}, RATE_LIMIT_WINDOW_MS);
cleanup.unref();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

router.post("/ask", async (req, res) => {
  if (isRateLimited(req.ip || req.socket.remoteAddress || "unknown")) {
    res.status(429).json({ error: "Rate limit exceeded" });
    return;
  }
  const question = req.body?.question;
  if (typeof question !== "string" || !question.trim() || question.length >= 300) {
    res.status(400).json({ error: "Invalid question" });
    return;
  }
  try {
    res.json(await askRAG(question));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;