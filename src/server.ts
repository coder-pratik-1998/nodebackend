import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

import { connectDB } from "./config/db.js";

import userRoutes from "./routes/userAuthRoutes.js";
import ownerRoutes from "./routes/ownerAuthRoutes.js";
import restaurantRoutes from "./routes/restaurantRoutes.js";
import userSearchRoutes from "./routes/userSearchRoutes.js";

/* -----------------------------------
   Load Environment Variables         
----------------------------------- */

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

/* -----------------------------------
   Allowed CORS Origins
----------------------------------- */
const allowedOrigins = ["http://localhost:5173", process.env.CLIENT_URL].filter(
  Boolean,
) as string[];

const uniqueAllowedOrigins = [...new Set(allowedOrigins)];

/* -----------------------------------
   Middleware                         
----------------------------------- */
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);

      if (uniqueAllowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS not allowed by policy"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* -----------------------------------
   API Routes
----------------------------------- */
app.use("/user/auth", userRoutes);
app.use("/owner/auth", ownerRoutes);
app.use("/owner/restaurant", restaurantRoutes);
app.use("/api/user", userSearchRoutes);

/* -----------------------------------
   System Routes
----------------------------------- */
app.get("/", (_req, res) => {
  res.status(200).send("🚀 API is running...");
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend is in good health",
    timestamp: new Date().toISOString(),
  });
});

/* -----------------------------------
   Start Server After DB Connects
----------------------------------- */
const startServer = async (): Promise<void> => {
  try {
    // 1. Connect to Database
    await connectDB();

    // 2. Start Listening (Removed HOST to allow environment default)
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port: ${PORT}`);
      console.log(`👉 Allowed origins: ${uniqueAllowedOrigins.join(", ")}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1); // Exit process with failure
  }
};

startServer();
