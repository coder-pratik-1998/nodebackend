import { Router } from "express";
import { searchNearbyItems } from "../controllers/userSearchController.js";
import { updateUserLocation } from "../controllers/userAuthController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/update-location", protect, updateUserLocation);
router.get("/search", searchNearbyItems);

export default router;
