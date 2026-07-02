import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { analyticsEvents, webVitals } from "@/db/schema";

export type VitalRow = {
  name: string;
  value: number;
  rating: string;
  pathname: string;
  connection?: string | null;
  userId?: string | null;
};

export type EventRow = {
  name: string;
  props?: Record<string, unknown>;
  pathname?: string | null;
  userId?: string | null;
  sessionId?: string | null;
};

export async function insertWebVitals(rows: VitalRow[]): Promise<void> {
  if (rows.length === 0) return;
  const now = Date.now();
  await db.insert(webVitals).values(
    rows.map((r) => ({
      id: randomUUID(),
      name: r.name,
      value: r.value,
      rating: r.rating,
      pathname: r.pathname.slice(0, 256),
      connection: r.connection?.slice(0, 32) ?? null,
      userId: r.userId ?? null,
      createdAt: now,
    })),
  );
}

export async function insertAnalyticsEvents(rows: EventRow[]): Promise<void> {
  if (rows.length === 0) return;
  const now = Date.now();
  await db.insert(analyticsEvents).values(
    rows.map((r) => ({
      id: randomUUID(),
      name: r.name.slice(0, 64),
      props: JSON.stringify(r.props ?? {}),
      pathname: r.pathname?.slice(0, 256) ?? null,
      userId: r.userId ?? null,
      sessionId: r.sessionId?.slice(0, 64) ?? null,
      createdAt: now,
    })),
  );
}
