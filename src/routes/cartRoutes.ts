import express from "express";
import { addToCart, getCart, getAllCarts, decrementFromCart } from "../controllers/cartController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/", getAllCarts); // Fetch all carts
router.post("/add", addToCart);
router.get("/:restaurantId", getCart);
router.post("/decrement", decrementFromCart);

export default router;