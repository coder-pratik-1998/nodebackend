import { Request, Response } from "express";
import { pool } from "../config/db.js";
import { ResultSetHeader, RowDataPacket } from "mysql2";

/**
 * Add a new item to a restaurant's category
 * Logic: Checks ownership and prevents duplicate names in the same category
 */
export const addMenuItem = async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  const { category_id, item_name, item_type, price } = req.body;
  const ownerId = (req as any).user.id;

  try {
    // 1. Verify Restaurant Ownership AND Category Validity
    const [validContext] = await pool.execute<RowDataPacket[]>(
      `SELECT r.id FROM restaurants r 
       JOIN categories c ON c.restaurant_id = r.id
       WHERE r.id = ? AND r.owner_id = ? AND c.id = ?`,
      [restaurantId, ownerId, category_id],
    );

    if (validContext.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access or invalid category for this restaurant",
      });
    }

    // 2. Insert the item
    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO menu_items (restaurant_id, category_id, item_name, item_type, price, is_available) VALUES (?, ?, ?, ?, ?, 1)",
      [restaurantId, category_id, item_name, item_type, price],
    );

    return res.status(201).json({
      success: true,
      message: "Item added successfully",
      itemId: result.insertId,
    });
  } catch (error: any) {
    console.error("Error in addMenuItem:", error);

    // Specific check for MySQL Duplicate Entry (Error Code 1062)
    if (error.errno === 1062 || error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: `An item named "${item_name}" already exists in this category.`,
      });
    }

    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

/**
 * Update an existing menu item
 */
export const updateMenuItem = async (req: Request, res: Response) => {
  const { itemId } = req.params;
  const { item_name, item_type, price } = req.body;
  const ownerId = (req as any).user.id;

  try {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE menu_items m
       JOIN restaurants r ON m.restaurant_id = r.id
       SET m.item_name = ?, m.item_type = ?, m.price = ?
       WHERE m.id = ? AND r.owner_id = ?`,
      [item_name, item_type, price, itemId, ownerId],
    );

    if (result.affectedRows === 0) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized or item not found",
      });
    }

    return res
      .status(200)
      .json({ success: true, message: "Item updated successfully" });
  } catch (error: any) {
    console.error("Error in updateMenuItem:", error);

    if (error.errno === 1062 || error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Another item in this category already has this name.",
      });
    }

    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

/**
 * Toggle item availability
 */
export const toggleItemAvailability = async (req: Request, res: Response) => {
  const { itemId } = req.params;
  const is_available = Number(req.body.is_available);
  const ownerId = (req as any).user.id;

  try {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE menu_items m
       JOIN restaurants r ON m.restaurant_id = r.id
       SET m.is_available = ?
       WHERE m.id = ? AND r.owner_id = ?`,
      [is_available, itemId, ownerId],
    );

    if (result.affectedRows === 0) {
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized or item not found" });
    }

    return res
      .status(200)
      .json({ success: true, message: "Availability updated" });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

/**
 * Delete a menu item
 */
export const deleteMenuItem = async (req: Request, res: Response) => {
  const { itemId } = req.params;
  const ownerId = (req as any).user.id;

  try {
    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE m FROM menu_items m
       JOIN restaurants r ON m.restaurant_id = r.id
       WHERE m.id = ? AND r.owner_id = ?`,
      [itemId, ownerId],
    );

    if (result.affectedRows === 0) {
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized or item not found" });
    }

    return res
      .status(200)
      .json({ success: true, message: "Item deleted successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

/**
 * Get items for a restaurant
 */
export const getMenuItems = async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  const { category_id } = req.query;

  try {
    let query = "SELECT * FROM menu_items WHERE restaurant_id = ?";
    let params: any[] = [restaurantId];

    if (category_id && category_id !== "null") {
      query += " AND category_id = ?";
      params.push(category_id);
    }

    const [rows] = await pool.execute<RowDataPacket[]>(query, params);
    return res.status(200).json({ success: true, items: rows });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};


