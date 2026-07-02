import type { DatabaseClient } from "./client.js";

export const checkDatabaseHealth = async (database: DatabaseClient): Promise<boolean> => {
  try {
    await database.sql`select 1`;
    return true;
  } catch {
    return false;
  }
};
