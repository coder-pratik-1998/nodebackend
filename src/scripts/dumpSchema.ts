import { pool } from "../config/db.js";

async function dump() {
  const [owners] = await pool.execute("DESCRIBE owners");
  const [restaurants] = await pool.execute("DESCRIBE restaurants");
  console.log("=== OWNERS ===");
  console.table(owners);
  console.log("\n=== RESTAURANTS ===");
  console.table(restaurants);
  process.exit(0);
}
dump();
