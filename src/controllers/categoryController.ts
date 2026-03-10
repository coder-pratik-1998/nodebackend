import { Request, Response } from "express";
import { pool } from "../config/db.js";
import { ResultSetHeader, RowDataPacket } from "mysql2";

/**
 * Add Category with Unique Name Check
 */
export const addCategory = async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  const { category_name } = req.body;
  const ownerId = (req as any).user.id;

  try {
    // 1. Ownership check
    const [restaurant] = await pool.execute<RowDataPacket[]>(
      "SELECT id FROM restaurants WHERE id = ? AND owner_id = ?",
      [restaurantId, ownerId],
    );

    if (restaurant.length === 0) {
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized restaurant access" });
    }

    // 2. Insert category
    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO categories (restaurant_id, category_name, display_order, image_url) VALUES (?, ?, 0, NULL)",
      [restaurantId, category_name],
    );

    res.status(201).json({
      success: true,
      message: "Category added successfully",
      categoryId: result.insertId,
    });
  } catch (error: any) {
    // UPDATED: Catch Duplicate Entry Error (Code 1062)
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        success: false,
        message: `The category "${category_name}" already exists for this restaurant.`,
      });
    }

    console.error("Add Category Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error while adding category" });
  }
};

/**
 * Update Category Name with Unique Name Check
 */
export const updateCategory = async (req: Request, res: Response) => {
  const { categoryId } = req.params;
  const { category_name } = req.body;
  const ownerId = (req as any).user.id;

  try {
    // Update with ownership verification via JOIN
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE categories c
       JOIN restaurants r ON c.restaurant_id = r.id
       SET c.category_name = ?
       WHERE c.id = ? AND r.owner_id = ?`,
      [category_name, categoryId, ownerId],
    );

    if (result.affectedRows === 0) {
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized or category not found" });
    }

    res
      .status(200)
      .json({ success: true, message: "Category updated successfully" });
  } catch (error: any) {
    // UPDATED: Catch Duplicate Entry Error on Rename
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        success: false,
        message: `Another category already has the name "${category_name}".`,
      });
    }

    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getCategories = async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM categories WHERE restaurant_id = ? ORDER BY created_at DESC",
      [restaurantId],
    );
    res.status(200).json({ success: true, categories: rows });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error while fetching categories",
    });
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
  const { categoryId } = req.params;
  const ownerId = (req as any).user.id;

  try {
    // Delete with ownership verification via JOIN
    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE c FROM categories c
       JOIN restaurants r ON c.restaurant_id = r.id
       WHERE c.id = ? AND r.owner_id = ?`,
      [categoryId, ownerId],
    );

    if (result.affectedRows === 0) {
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized or category not found" });
    }

    res
      .status(200)
      .json({ success: true, message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
