import { Request, Response } from "express";
import { pool } from "../config/db.js";
import { RowDataPacket } from "mysql2";

export const getRestaurantDetails = async (req: Request, res: Response) => {
  const { restaurantId } = req.params;

  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, restaurant_name, address, latitude, longitude, opening_time, closing_time, image_url 
       FROM restaurants 
       WHERE id = ?`,
      [restaurantId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Restaurant not found" });
    }

    res.status(200).json({ success: true, restaurant: rows[0] });
  } catch (error) {
    console.error("Error fetching restaurant details:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getPublicCategories = async (req: Request, res: Response) => {
  const { restaurantId } = req.params;

  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT id, category_name FROM categories WHERE restaurant_id = ? ORDER BY created_at DESC",
      [restaurantId]
    );

    res.status(200).json({ success: true, categories: rows });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getPublicMenuItems = async (req: Request, res: Response) => {
  const { restaurantId } = req.params;

  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT id, item_name, price, category_id, is_available FROM menu_items WHERE restaurant_id = ? AND is_available = 1",
      [restaurantId]
    );

    res.status(200).json({ success: true, menuItems: rows });
  } catch (error) {
    console.error("Error fetching menu items:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
