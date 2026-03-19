import { Request, Response } from "express";
import { pool } from "../config/db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export const adminLogin = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    // 1. Find admin
    const [rows]: any = await pool.execute(
      "SELECT * FROM admins WHERE email = ?",
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Admin not found" });
    }

    const admin = rows[0];

    // 2. Compare password
    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    // 3. Generate JWT
    const token = jwt.sign(
      {
        id: admin.id,
        role: "admin",
      },
      process.env.JWT_SECRET!,
      { expiresIn: "1d" }
    );

    // 4. Send response
    res.json({
      success: true,
      token,
    });

  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ message: "Server error" });
  }
};