import express from "express";
import {
  addRestaurant,
  getMyRestaurants,
} from "../controllers/restaurantController.js";
import { protectOwner } from "../middleware/ownerAuthmiddleware.js";
import {
  addCategory,
  getCategories,
} from "../controllers/categoryController.js";
import { addMenuItem, getMenuItems } from "../controllers/menuController.js";
import {
  updateMenuItem,
  toggleItemAvailability,
  deleteMenuItem,
} from "../controllers/menuController.js";

import {
  updateCategory,
  deleteCategory,
} from "../controllers/categoryController.js";
import {
  verifyMenuItemOwnership,
  verifyCategoryOwnership,
  verifyRestaurantOwnership,
} from "../middleware/ownershipMiddleware.js";
import {
  createSubscriptionOrder,
  verifySubscriptionPayment,
} from "../controllers/subscriptionController.js";

// ... existing routes ...

const router = express.Router();

// All restaurant routes require owner authentication
router.use(protectOwner);

// Subscription Management (Ensure protectOwner middleware is active for these)
router.post(
  "/subscription/create",
  verifyRestaurantOwnership,
  createSubscriptionOrder,
);

router.post(
  "/subscription/verify",
  verifyRestaurantOwnership,
  verifySubscriptionPayment,
);

router.post("/add", addRestaurant);
router.get("/my-restaurants", getMyRestaurants);
router.get("/:restaurantId/categories", getCategories);
router.post("/:restaurantId/categories", addCategory);

// Menu Item Routes
router.post("/:restaurantId/menu-items", addMenuItem); // POST to add
router.get("/:restaurantId/menu-items", getMenuItems); // GET to fetch

// Specific Menu Item Actions - Protected with ownership verification
router.put("/menu-items/:itemId", verifyMenuItemOwnership, updateMenuItem);
router.patch(
  "/menu-items/:itemId/availability",
  verifyMenuItemOwnership,
  toggleItemAvailability,
);
router.delete("/menu-items/:itemId", verifyMenuItemOwnership, deleteMenuItem);

// ... existing routes

// Category Management Routes - Protected with ownership verification
router.put("/categories/:categoryId", verifyCategoryOwnership, updateCategory);
router.delete(
  "/categories/:categoryId",
  verifyCategoryOwnership,
  deleteCategory,
);

export default router;
