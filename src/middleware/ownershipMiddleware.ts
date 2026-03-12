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

/**
 * Middleware to verify that the logged-in owner owns the restaurant.
 * Checks restaurantId from URL params or request body.
 */
export const verifyRestaurantOwnership = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Extract restaurantId from params or body
  const restaurantId = req.params.restaurantId || req.body.restaurantId;
  const ownerId = (req as any).user?.id;

  const logContext = "[RESTAURANT_OWNERSHIP_MIDDLEWARE]";

  if (!restaurantId) {
    console.error(`${logContext} Error: No restaurantId provided.`);
    return res.status(400).json({
      success: false,
      message: "Restaurant ID is required.",
    });
  }

  try {
    console.log(
      `${logContext} Verifying: Owner ${ownerId} for Restaurant ${restaurantId}`,
    );

    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT id FROM restaurants WHERE id = ? AND owner_id = ?",
      [restaurantId, ownerId],
    );

    if (rows.length === 0) {
      console.warn(
        `${logContext} SECURITY ALERT: Owner ${ownerId} denied access to Restaurant ${restaurantId}`,
      );
      return res.status(403).json({
        success: false,
        message: "Unauthorized: You do not have ownership of this restaurant.",
      });
    }

    console.log(`${logContext} Access Granted.`);
    next();
  } catch (error) {
    console.error(`${logContext} Database Error:`, error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};

