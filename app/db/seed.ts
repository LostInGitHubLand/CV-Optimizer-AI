import { getDb } from "../api/queries/connection";

async function seed() {
  const db = getDb();
  console.log("Database ready (SQLite)");
}

seed();
