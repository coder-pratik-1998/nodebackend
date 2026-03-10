import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";
import { RowDataPacket } from "mysql2";

interface DecodedOwnerToken {
  id: number;
}

const logOwnerAuth = (message: string, data?: any) => {
  console.log(
    `[${new Date().toISOString()}] [OWNER_AUTH_MIDDLEWARE] ${message}`,
    data || "",
  );
};

/**
 * Middleware to protect Owner (Hotel Owner) routes.
 * Checks for 'ownerToken' cookie and verifies against the 'owners' table.
 */
export const protectOwner = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Extract the specific ownerToken cookie
  const ownerToken = req.cookies.ownerToken;

  if (!ownerToken) {
    logOwnerAuth("Access Denied: No ownerToken found in cookies.");
    return res.status(401).json({
      success: false,
      message: "Not authorized, please login as an owner",
    });
  }

  try {
    // 1. Verify Owner Token
    logOwnerAuth("Verifying ownerToken...");
    const decodedOwner = jwt.verify(
      ownerToken,
      process.env.JWT_SECRET!,
    ) as DecodedOwnerToken;

    // 2. Check if the ID belongs to an Owner
    // This targets the separate 'owners' table
    logOwnerAuth(`Querying owners table for ID: ${decodedOwner.id}`);
    const [ownerRows] = await pool.execute<RowDataPacket[]>(
      "SELECT id, name, email, is_verified FROM owners WHERE id = ?",
      [decodedOwner.id],
    );

    if (ownerRows.length === 0) {
      logOwnerAuth("Verification Failed: ID does not exist in owners table.");
      return res.status(401).json({
        success: false,
        message: "Access denied. Owner account not found.",
      });
    }

    // 3. Check verification status
    if (ownerRows[0].is_verified === 0) {
      logOwnerAuth(
        `Verification Failed: Owner account ${ownerRows[0].email} not verified.`,
      );
      return res.status(403).json({
        success: false,
        message:
          "Owner account not verified. Please complete OTP verification.",
      });
    }

    // 4. Attach owner data to request object
    // Using ownerRows[0] ensures subsequent controllers have access to owner details
    (req as any).user = ownerRows[0];
    logOwnerAuth(`Access Granted for Owner: ${ownerRows[0].email}`);

    next();
  } catch (error) {
    logOwnerAuth(
      "Token Verification Error (likely expired or tampered):",
      error,
    );
    return res.status(401).json({
      success: false,
      message: "Token is invalid or expired",
    });
  }
};
