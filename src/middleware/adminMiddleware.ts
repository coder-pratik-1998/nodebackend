import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export const verifyAdmin = (req: any, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);

    if (decoded.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    req.admin = decoded;
    next();

  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};