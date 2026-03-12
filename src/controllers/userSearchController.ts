import { Request, Response } from "express";
import { pool } from "../config/db.js";

export const searchNearbyItems = async (req: Request, res: Response) => {
  // Extract search item, latitude, and longitude from the request URL query parameters
  const item = req.query.item as string;
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);

  // Validate that all required parameters are provided; if not, return a 400 Bad Request error
  if (!item || isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({
      success: false,
      message: "Item and valid location required",
    });
  }

  try {
    // Execute raw SQL query using mysql2/promise connection p+ool
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

(
  6371 * ACOS(
    LEAST(1, GREATEST(-1,
      COS(RADIANS(?))
      * COS(RADIANS(r.latitude))
      * COS(RADIANS(r.longitude) - RADIANS(?))
      + SIN(RADIANS(?))
      * SIN(RADIANS(r.latitude))
    ))
  )
) AS distance

FROM restaurants r
JOIN menu_items m ON r.id = m.restaurant_id

WHERE 
  m.item_name LIKE CONCAT('%', ?, '%')
  AND m.is_available = 1
  AND r.is_subscribed = 1

ORDER BY distance ASC
LIMIT 10;
      `,
      [lat, lng, lat, item], // Passed 'item' instead of %item% since CONCAT is used in the query above
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
      issue: error,
    });
  }
};
