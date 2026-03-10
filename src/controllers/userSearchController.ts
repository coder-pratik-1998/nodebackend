import { Request, Response } from "express";
import { pool } from "../config/db.js";

export const searchNearbyItems = async (req: Request, res: Response) => {
  // Extract search item, latitude, and longitude from the request URL query parameters
  const item = req.query.item as string;
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);

  // Validate that all required parameters are provided; if not, return a 400 Bad Request error
  if (!item || !lat || !lng) {
    return res.status(400).json({
      success: false,
      message: "Item and location required",
    });
  }

  try {
    // Execute raw SQL query using mysql2/promise connection pool
    // Expected parameters in order: latitude, longitude, latitude, search string
    const [rows]: any = await pool.execute(
      `
    SELECT 
  r.id AS restaurant_id,
  r.restaurant_name,
  r.address,
  r.latitude,
  r.longitude,
  m.id AS item_id,
  m.item_name,
  m.price,

  -- Haversine formula: Calculates the great-circle distance between two points on a sphere
  -- 6371 is the radius of the Earth in kilometers, so the resulting distance is in km.
  (
    6371 * ACOS(
      COS(RADIANS(?)) -- user's latitude
      * COS(RADIANS(r.latitude))
      * COS(RADIANS(r.longitude) - RADIANS(?)) -- user's longitude
      + SIN(RADIANS(?)) -- user's latitude
      * SIN(RADIANS(r.latitude))
    )
  ) AS distance

FROM restaurants r
JOIN menu_items m ON r.id = m.restaurant_id

WHERE 
  -- Find items matching the search text (uses CONCAT to surround the string with % wildcards)
  m.item_name LIKE CONCAT('%', ?, '%')
  -- Ensure the menu item is available
  AND m.is_available = 1
  -- Ensure the restaurant has an active subscription
  AND r.is_subscribed = 1
  -- Ensure the restaurant is currently accepting orders
  AND r.is_open = 1

-- Sort the results so the closest restaurants appear first
ORDER BY distance ASC
-- Only return a maximum of 10 results
LIMIT 10;
      `,
      [lat, lng, lat, item] // Passed 'item' instead of %item% since CONCAT is used in the query above
    );

    // Send the resulting data back to the client
    res.json({
      success: true,
      data: rows,
    });

  } catch (error) {
    // If anything fails in the try block (like a database query error), log it and return 500
    console.error("Search error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

