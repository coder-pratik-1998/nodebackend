import { Request, Response, NextFunction } from "express";
import { pool } from "../config/db.js";
import { RowDataPacket } from "mysql2";

export const verifyMenuItemOwnership = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { itemId } = req.params;
  const ownerId = (req as any).user?.id;

  if (!itemId || !ownerId) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid request parameters" });
  }

  try {
    // Check if item belongs to a restaurant owned by THIS owner
    const [menuItem] = await pool.execute<RowDataPacket[]>(
      `SELECT m.id 
       FROM menu_items m 
       JOIN restaurants r ON m.restaurant_id = r.id 
       WHERE m.id = ? AND r.owner_id = ?`,
      [itemId, ownerId],
    );

    if (menuItem.length === 0) {
      console.warn(
        `[SECURITY] Unauthorized access attempt: Owner ${ownerId} tried to access Item ${itemId}`,
      );
      return res.status(403).json({
        success: false,
        message: "Unauthorized - This item does not belong to your restaurant",
      });
    }

    next();
  } catch (error) {
    console.error("Ownership verification error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const verifyCategoryOwnership = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { categoryId } = req.params;
  const ownerId = (req as any).user?.id;

  if (!categoryId || !ownerId) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid request parameters" });
  }

  try {
    const [category] = await pool.execute<RowDataPacket[]>(
      "SELECT c.id FROM categories c JOIN restaurants r ON c.restaurant_id = r.id WHERE c.id = ? AND r.owner_id = ?",
      [categoryId, ownerId],
    );

    if (category.length === 0) {
      console.warn(
        `[SECURITY] Unauthorized access attempt: Owner ${ownerId} tried to access Category ${categoryId}`,
      );
      return res.status(403).json({
        success: false,
        message:
          "Unauthorized - This category does not belong to your restaurant",
      });
    }

    next();
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
