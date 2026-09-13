import "server-only";
import { desc, eq } from "drizzle-orm";
import { card, connection, db, ensureMigrated } from "./db";
import type { ClientConnection, ProviderId } from "./metrics/types";
import { cardConfigSchema, type CardConfig } from "./cards/types";

/** Stored configs predate newer fields; parsing fills in their defaults. */
function parseConfig(raw: unknown): CardConfig {
  const parsed = cardConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : (raw as CardConfig);
}

export function toClientConnection(row: typeof connection.$inferSelect): ClientConnection {
  return {
    id: row.id,
    provider: row.provider as ProviderId,
    label: row.label,
    config: row.config,
    status: row.status === "error" ? "error" : "ok",
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listConnections(userId: string): Promise<ClientConnection[]> {
  await ensureMigrated();
  const rows = await db.select().from(connection).where(eq(connection.userId, userId)).orderBy(desc(connection.createdAt));
  return rows.map(toClientConnection);
}

export interface SavedCard {
  id: string;
  name: string;
  config: CardConfig;
  createdAt: string;
  updatedAt: string;
}

export async function listCards(userId: string): Promise<SavedCard[]> {
  await ensureMigrated();
  const rows = await db.select().from(card).where(eq(card.userId, userId)).orderBy(desc(card.updatedAt));
  return rows.map((r) => ({ id: r.id, name: r.name, config: parseConfig(r.config), createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() }));
}

export async function getCard(userId: string, id: string): Promise<SavedCard | null> {
  await ensureMigrated();
  const row = await db.query.card.findFirst({ where: eq(card.id, id) });
  if (!row || row.userId !== userId) return null;
  return { id: row.id, name: row.name, config: parseConfig(row.config), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
