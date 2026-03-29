import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { logger } from "./lib/logger";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DB_POOL_MAX || "20", 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 30_000,
});

pool.on("error", (err) => {
  logger.error({ err: err.message, context: "db.pool" }, "Unexpected database pool error");
});

export const db = drizzle(pool, { schema });

// ---------------------------------------------------------------------------
// Circuit breaker for external services (OpenAI, Stripe, Resend)
// ---------------------------------------------------------------------------
interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeoutMs?: number;
  name: string;
}

type CircuitState = "closed" | "open" | "half-open";

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  readonly name: string;

  constructor(opts: CircuitBreakerOptions) {
    this.failureThreshold = opts.failureThreshold ?? 5;
    this.resetTimeoutMs = opts.resetTimeoutMs ?? 30_000;
    this.name = opts.name;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = "half-open";
      } else {
        throw new Error(`Circuit breaker [${this.name}] is open — service temporarily unavailable`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = "closed";
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.failureThreshold) {
      this.state = "open";
      logger.warn({ breaker: this.name, failures: this.failures }, `Circuit breaker [${this.name}] opened after ${this.failures} failures`);
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}

// Pre-built breakers for external services
export const openaiBreaker = new CircuitBreaker({ name: "openai", failureThreshold: 3, resetTimeoutMs: 60_000 });
export const stripeBreaker = new CircuitBreaker({ name: "stripe", failureThreshold: 5, resetTimeoutMs: 30_000 });
export const resendBreaker = new CircuitBreaker({ name: "resend", failureThreshold: 5, resetTimeoutMs: 60_000 });
