import { Router } from "express";
import { getRestaurantDetails, getPublicCategories, getPublicMenuItems } from "../controllers/userRestaurantController.js";

const router = Router();

// Publicly accessible routes meant for regular users
router.get("/:restaurantId", getRestaurantDetails);
router.get("/:restaurantId/categories", getPublicCategories);
router.get("/:restaurantId/menu-items", getPublicMenuItems);

export default router;
