import { Request, Response } from "express";
import { pool } from "../config/db.js";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import NodeGeocoder, { Options } from "node-geocoder";

// 1. Configure the free geocoder (OpenStreetMap)
const options: Options = {
  provider: "openstreetmap",
};

const geocoder = NodeGeocoder(options);

const logStep = (context: string, message: string, data?: any) => {
  console.log(
    `[${new Date().toISOString()}] [RESTAURANT_CONTROLLER] [${context}] ${message}`,
    data || "",
  );
};

/* --- 1. ADD NEW RESTAURANT --- */
export const addRestaurant = async (req: Request, res: Response) => {
  const context = "ADD_RESTAURANT";
  const ownerId = (req as any).user.id;
  const {
    restaurant_name,
    address,
    opening_time,
    closing_time,
    latitude,
    longitude,
  } = req.body;

  try {
    logStep(
      context,
      `Owner ${ownerId} is adding restaurant: ${restaurant_name}`,
    );

    // Validation: Name and times are strictly required.
    // Address is required UNLESS latitude/longitude are provided (GPS mode).
    if (!restaurant_name || !opening_time || !closing_time) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    if (!address && (!latitude || !longitude)) {
      return res.status(400).json({
        success: false,
        message: "Please provide an address or use GPS location",
      });
    }

    let finalLat = latitude;
    let finalLon = longitude;
    let finalAddress = address;

    // --- 2. Geocoding Logic ---

    // SCENARIO A: Reverse Geocoding (Frontend sent GPS coordinates but no text address)
    if (finalLat && finalLon && !finalAddress) {
      logStep(
        context,
        `Reverse geocoding GPS coordinates: ${finalLat}, ${finalLon}`,
      );
      try {
        const reverseRes = await geocoder.reverse({
          lat: finalLat,
          lon: finalLon,
        });
        if (reverseRes.length > 0) {
          finalAddress =
            reverseRes[0].formattedAddress || "Address found via GPS";
          logStep(context, `Reverse geocode success: ${finalAddress}`);
        }
      } catch (revError) {
        logStep(context, "Reverse geocoding service error:", revError);
        finalAddress = "Location via GPS (Address fetch failed)";
      }
    }

    // SCENARIO B: Forward Geocoding (Frontend sent address but no coordinates)
    else if (finalAddress && (!finalLat || !finalLon)) {
      logStep(context, `Attempting to geocode text address: ${finalAddress}`);
      try {
        const geoRes = await geocoder.geocode(finalAddress);
        if (geoRes.length > 0) {
          finalLat = geoRes[0].latitude;
          finalLon = geoRes[0].longitude;
          logStep(context, `Forward geocode success: ${finalLat}, ${finalLon}`);
        }
      } catch (geoError) {
        logStep(
          context,
          "Forward geocoding service error (skipping):",
          geoError,
        );
      }
    }

    // --- 3. Database Insertion ---
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO restaurants 
      (owner_id, restaurant_name, address, latitude, longitude, opening_time, closing_time, image_url, is_subscribed) 
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL, FALSE)`,
      [
        ownerId,
        restaurant_name,
        finalAddress, // Use the resolved address string
        finalLat ?? null,
        finalLon ?? null,
        opening_time,
        closing_time,
      ],
    );

    logStep(context, `Restaurant created successfully. ID: ${result.insertId}`);

    res.status(201).json({
      success: true,
      message: "Restaurant added successfully",
      restaurantId: result.insertId,
      data: {
        address: finalAddress,
        coordinates: {
          latitude: finalLat,
          longitude: finalLon,
        },
      },
    });
  } catch (error: any) {
    logStep(context, "FATAL: Error adding restaurant", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/* --- 2. GET OWNER'S RESTAURANTS --- */
export const getMyRestaurants = async (req: Request, res: Response) => {
  const context = "GET_MY_RESTAURANTS";
  const ownerId = (req as any).user.id;

  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM restaurants WHERE owner_id = ? ORDER BY created_at DESC",
      [ownerId],
    );

    res.status(200).json({
      success: true,
      restaurants: rows,
    });
  } catch (error: any) {
    logStep(context, "Error fetching restaurants", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
