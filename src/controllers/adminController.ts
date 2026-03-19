import { Request, Response } from "express";
import { pool } from "../config/db.js";

export const getAllRestaurants = async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.execute(`
      SELECT r.*, o.name AS owner_name, o.email AS owner_email 
      FROM restaurants r 
      LEFT JOIN owners o ON r.owner_id = o.id 
      ORDER BY r.created_at DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching restaurants:", error);
    res.status(500).json({ message: "Error fetching restaurants" });
  }
};

export const updateRestaurantSubscription = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { is_subscribed, subscription_start, subscription_end } = req.body;

  try {
    await pool.execute(
      `UPDATE restaurants 
       SET is_subscribed = ?, 
           subscription_start = ?, 
           subscription_end = ? 
       WHERE id = ?`,
      [is_subscribed ? 1 : 0, subscription_start || null, subscription_end || null, id]
    );

    const [rows]: any = await pool.execute(
      "SELECT id, is_subscribed, subscription_start, subscription_end FROM restaurants WHERE id = ?",
      [id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error updating subscription:", error);
    res.status(500).json({ message: "Error updating subscription" });
  }
};

export const getAllUsers = async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.execute(
      "SELECT id, name, email, phone, created_at FROM users ORDER BY created_at DESC",
    );
    res.json(rows);
  } catch {
    res.status(500).json({ message: "Error fetching users" });
  }
};

export const getAllOwners = async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.execute(
      "SELECT id, name, email, mobile_no, is_verified, created_at FROM owners ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching owners:", error);
    res.status(500).json({ message: "Error fetching owners" });
  }
};

export const toggleOwnerVerification = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await pool.execute(
      "UPDATE owners SET is_verified = 1 - is_verified WHERE id = ?",
      [id]
    );

    const [rows]: any = await pool.execute(
      "SELECT id, is_verified FROM owners WHERE id = ?",
      [id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "Owner not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error toggling owner verification:", error);
    res.status(500).json({ message: "Error toggling owner verification" });
  }
};
