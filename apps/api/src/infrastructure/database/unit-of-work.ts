import type { Database } from "./client.js";

export class UnitOfWork {
  public constructor(private readonly db: Database) {}

  public transaction<T>(work: (tx: Database) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => work(tx as Database));
  }
}
