import { Request, Response } from "express";
import { pool } from "../config/db.js";
import { RowDataPacket, ResultSetHeader } from "mysql2";

/**
 * Add item to cart
 */
export const addToCart = async (req: Request, res: Response) => {
  const { restaurantId, menuItemId } = req.body;
  const userId = (req as any).user.id;

  try {
    // check if cart exists
    const [cartRows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM carts WHERE user_id = ? AND restaurant_id = ?",
      [userId, restaurantId]
    );

    let cartId;

    if (cartRows.length === 0) {
      const [newCart] = await pool.execute<ResultSetHeader>(
        "INSERT INTO carts (user_id, restaurant_id) VALUES (?, ?)",
        [userId, restaurantId]
      );

      cartId = newCart.insertId;
    } else {
      cartId = cartRows[0].id;
    }

    // check if item already exists
    const [itemRows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM cart_items WHERE cart_id = ? AND menu_item_id = ?",
      [cartId, menuItemId]
    );

    if (itemRows.length > 0) {
      await pool.execute(
        "UPDATE cart_items SET quantity = quantity + 1 WHERE cart_id = ? AND menu_item_id = ?",
        [cartId, menuItemId]
      );
    } else {
      await pool.execute(
        "INSERT INTO cart_items (cart_id, menu_item_id, quantity) VALUES (?, ?, 1)",
        [cartId, menuItemId]
      );
    }

    res.json({ success: true, message: "Item added to cart" });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message, stack: error.stack });
  }
};

/**
 * Get cart items for restaurant
 */
export const getCart = async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  const userId = (req as any).user.id;

  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        ci.id,
        ci.quantity,
        ci.menu_item_id,
        mi.item_name,
        mi.price
       FROM carts c
       JOIN cart_items ci ON ci.cart_id = c.id
       JOIN menu_items mi ON mi.id = ci.menu_item_id
       WHERE c.user_id = ? AND c.restaurant_id = ?`,
      [userId, restaurantId]
    );

    res.json({ success: true, items: rows });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};

/**
 * Get all carts for user with restaurant details
 */
export const getAllCarts = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        c.id as cart_id,
        r.id as restaurant_id,
        r.restaurant_name,
        r.address,
        r.image_url,
        SUM(ci.quantity) as total_items,
        SUM(ci.quantity * mi.price) as total_price
       FROM carts c
       JOIN restaurants r ON c.restaurant_id = r.id
       JOIN cart_items ci ON ci.cart_id = c.id
       JOIN menu_items mi ON mi.id = ci.menu_item_id
       WHERE c.user_id = ?
       GROUP BY c.id, r.id, r.restaurant_name, r.address, r.image_url
       ORDER BY c.id DESC`,
      [userId]
    );

    res.json({ success: true, carts: rows });
  } catch (error) {
    console.error("Error fetching all carts:", error);
    res.status(500).json({ success: false, message: "Failed to fetch carts" });
  }
};

/**
 * Decrement item quantity in cart (remove if qty reaches 0)
 */
export const decrementFromCart = async (req: Request, res: Response) => {
  const { restaurantId, menuItemId } = req.body;
  const userId = (req as any).user.id;

  try {
    // Find the cart
    const [cartRows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM carts WHERE user_id = ? AND restaurant_id = ?",
      [userId, restaurantId]
    );

    if (cartRows.length === 0) {
      return res.json({ success: false, message: "Cart not found" });
    }

    const cartId = cartRows[0].id;

    // Get current quantity
    const [itemRows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM cart_items WHERE cart_id = ? AND menu_item_id = ?",
      [cartId, menuItemId]
    );

    if (itemRows.length === 0) {
      return res.json({ success: false, message: "Item not in cart" });
    }

    const currentQty = itemRows[0].quantity;

    if (currentQty <= 1) {
      // Remove the item entirely
      await pool.execute(
        "DELETE FROM cart_items WHERE cart_id = ? AND menu_item_id = ?",
        [cartId, menuItemId]
      );
    } else {
      // Decrement quantity
      await pool.execute(
        "UPDATE cart_items SET quantity = quantity - 1 WHERE cart_id = ? AND menu_item_id = ?",
        [cartId, menuItemId]
      );
    }

    res.json({ success: true, message: "Item decremented" });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
};