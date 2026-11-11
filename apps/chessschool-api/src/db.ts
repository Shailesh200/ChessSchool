import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { courseDocument } from "./course";
import * as schema from "./schema";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export async function openDb(url: string, authToken?: string): Promise<Db> {
  const client = createClient({ url, authToken });
  await client.execute("PRAGMA foreign_keys = ON");
  for (const sql of schema.BOOTSTRAP_SQL) {
    try {
      await client.execute(sql);
    } catch (err) {
      if (!/duplicate column name/i.test(String(err))) throw err;
    }
  }
  await client.execute({
    sql: "INSERT INTO cs_course (id, data) VALUES ('live', ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data",
    args: [JSON.stringify(courseDocument())],
  });
  return drizzle(client, { schema });
}
