/**
 * Run this once to create the admin user in the database.
 * Usage: npx ts-node -r tsconfig-paths/register src/scripts/createAdmin.ts
 */
import bcrypt from "bcrypt";
import { pool } from "../config/db.js";
import dotenv from "dotenv";

dotenv.config();

async function createAdmin() {
  const email = "admin@fudx.com";
  const password = "Admin@1234";

  // 1. Make sure the admins table exists
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Check if admin already exists
  const [rows]: any = await pool.execute("SELECT id FROM admins WHERE email = ?", [email]);
  if (rows.length > 0) {
    console.log("✅ Admin already exists:", email);
    process.exit(0);
  }

  // 3. Hash password and insert
  const hashed = await bcrypt.hash(password, 10);
  await pool.execute("INSERT INTO admins (email, password) VALUES (?, ?)", [email, hashed]);

  console.log("✅ Admin created successfully!");
  console.log("   Email   :", email);
  console.log("   Password:", password);
  process.exit(0);
}

createAdmin().catch((err) => {
  console.error("❌ Failed to create admin:", err);
  process.exit(1);
});
