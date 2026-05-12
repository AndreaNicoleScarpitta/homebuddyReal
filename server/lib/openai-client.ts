/**
 * Central OpenAI client — singleton + circuit-breaker wrapper.
 *
 * Problems this solves:
 *  1. Inline `new OpenAI({ apiKey })` per-request bypasses the circuit
 *     breaker and creates a new TCP connection each time — expensive and
 *     unprotected from cascading failures.
 *  2. No API-key presence check means a missing env var silently produces an
 *     unauthenticated client that fails on first use rather than at startup.
 *  3. No graceful fallback — callers that hit a 429 or outage propagate a
 *     500 to the user with no degraded-but-working alternative.
 *
 * Usage
 *   import { withOpenAI } from "./openai-client";
 *
 *   // Returns fallback ("{}") if AI is down; never throws to the caller.
 *   const raw = await withOpenAI(ai => ai.chat.completions.create({...}), "{}");
 *
 *   // Legacy pattern — still supported for background agents.
 *   import { getOpenAIClient } from "./openai-client";
 *   const openai = getOpenAIClient();
 */

import OpenAI from "openai";
import { openaiBreaker } from "../db";
import { logError } from "./logger";

export { openaiBreaker };

// ─── Singleton ────────────────────────────────────────────────────────────────

let _singleton: OpenAI | null = null;

/**
 * Returns the shared OpenAI instance, creating it on first call.
 * Throws immediately if the API key is absent so misconfiguration surfaces
 * at request time rather than silently producing 401s.
 */
export function getOpenAIClient(): OpenAI {
  if (!_singleton) {
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "AI_INTEGRATIONS_OPENAI_API_KEY is not set — AI features are unavailable"
      );
    }
    _singleton = new OpenAI({
      apiKey,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      // Hard ceiling per request — well under Railway's 90 s worker grace.
      timeout: 60_000,
      // SDK retries 429/5xx; cap so rate-limit wait doesn't compound.
      maxRetries: 1,
    });
  }
  return _singleton;
}

// ─── Graceful-fallback wrapper ────────────────────────────────────────────────

/**
 * Run `fn` against the singleton client, guarded by the circuit breaker.
 * Returns `fallback` — never throws — when:
 *   • the API key is absent
 *   • the circuit breaker is open (repeated prior failures)
 *   • the individual call fails (timeout, 5xx, network error)
 *
 * This lets every call site define its own safe degradation without
 * try/catch boilerplate and without crashing the request.
 */
export async function withOpenAI<T>(
  fn: (client: OpenAI) => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await openaiBreaker.execute(() => fn(getOpenAIClient()));
  } catch (err: any) {
    logError(
      "openai-client",
      err,
      { breakerState: openaiBreaker.getState() }
    );
    return fallback;
  }
}
