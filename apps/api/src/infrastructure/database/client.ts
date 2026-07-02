import * as schema from "@cloudcommerce/database";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export type Database = PostgresJsDatabase<typeof schema>;

export type DatabaseClient = {
  db: Database;
  sql: postgres.Sql;
  close: () => Promise<void>;
};

export const createDatabaseClient = (databaseUrl: string): DatabaseClient => {
  const sql = postgres(databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
  const db = drizzle(sql, { schema });
  return {
    db,
    sql,
    close: () => sql.end({ timeout: 5 }),
  };
};
