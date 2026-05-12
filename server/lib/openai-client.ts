/**
 * Central OpenAI client factory.
 *
 * Every agent and request path used to `new OpenAI({ apiKey })` inline,
 * which left us with no timeouts, no retry budget, and no circuit breaker.
 * A single hung upstream call would pin an agent worker forever; repeated
 * failures would cascade through the whole scheduler.
 *
 * Use this factory instead:
 *   const openai = getOpenAIClient();
 *   const res = await openai.chat.completions.create({...});
 *
 * For background-critical paths that should fast-fail when OpenAI is down,
 * wrap the call in the circuit breaker:
 *   const res = await openaiBreaker.execute(() =>
 *     openai.chat.completions.create({...})
 *   );
 */

import OpenAI from "openai";
import { openaiBreaker } from "../db";

export { openaiBreaker };

/**
 * Returns an OpenAI client with our standard reliability settings.
 * - `timeout`: 60s hard ceiling per request. Railway worker grace is ~90s,
 *   so leaving 30s for us to serialize the response and clean up.
 * - `maxRetries: 1`: the SDK already retries on 429/5xx; cap it so a rate-
 *   limited provider doesn't multiply our wait by the retry budget.
 */
export function getOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    timeout: 60_000,
    maxRetries: 1,
  });
}
