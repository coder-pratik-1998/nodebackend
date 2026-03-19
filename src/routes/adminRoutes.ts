import express from "express";
import { adminLogin } from "../controllers/adminAuthController.js";
import {
  getAllRestaurants,
  updateRestaurantSubscription,
  getAllUsers,
  getAllOwners,
  toggleOwnerVerification,
} from "../controllers/adminController.js";
import { verifyAdmin } from "../middleware/adminMiddleware.js";

const router = express.Router();

router.post("/login", adminLogin);

router.get("/restaurants", verifyAdmin, getAllRestaurants);
router.patch("/restaurants/:id/subscription", verifyAdmin, updateRestaurantSubscription);

router.get("/users", verifyAdmin, getAllUsers);

router.get("/owners", verifyAdmin, getAllOwners);
router.patch("/owners/:id/verify", verifyAdmin, toggleOwnerVerification);

export default router;
