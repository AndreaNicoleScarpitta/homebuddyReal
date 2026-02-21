/**
 * Command Bus — dispatches commands to domain handlers.
 *
 * Each command represents a user/system intent (e.g., "create task", "approve
 * task").  The bus looks up the handler, executes it within a Drizzle
 * transaction, and returns the result.  The handler is responsible for:
 *   1. Validating the command payload
 *   2. Loading current aggregate state (via readStream or projection)
 *   3. Emitting events via eventStore.append()
 *   4. Applying projection updates via applyEvent()
 */

import { db } from "../db";

export type CommandHandler<TInput, TResult> = (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: TInput,
) => Promise<TResult>;

const handlers = new Map<string, CommandHandler<unknown, unknown>>();

/**
 * Register a named command handler.
 */
export function registerHandler<TInput, TResult>(
  commandType: string,
  handler: CommandHandler<TInput, TResult>,
): void {
  handlers.set(commandType, handler as CommandHandler<unknown, unknown>);
}

/**
 * Dispatch a command by name.  Executes the handler within a database
 * transaction so that event appends + projection updates are atomic.
 */
export async function dispatch<TResult = unknown>(
  commandType: string,
  input: unknown,
): Promise<TResult> {
  const handler = handlers.get(commandType);
  if (!handler) {
    throw new Error(`No handler registered for command: ${commandType}`);
  }

  return db.transaction(async (tx) => {
    return handler(tx, input) as Promise<TResult>;
  }) as Promise<TResult>;
}
