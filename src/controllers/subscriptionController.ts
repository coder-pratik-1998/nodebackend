import { Request, Response } from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import { pool } from "../config/db.js";
import { RowDataPacket, ResultSetHeader } from "mysql2";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

/**
 * @route   POST /owner/restaurant/subscription/create
 */
export const createSubscriptionOrder = async (req: Request, res: Response) => {
  const context = "CREATE_SUB_ORDER";
  const { restaurantId } = req.body;
  const ownerId = (req as any).user?.id;
  const amount = 3000;

  console.log(`[${context}] --- Start ---`);
  console.log(
    `[${context}] Incoming Request: RestaurantID: ${restaurantId}, OwnerID: ${ownerId}`,
  );

  try {
    // 1. Ownership check
    console.log(`[${context}] Step 1: Verifying ownership...`);
    const [restaurant] = await pool.execute<RowDataPacket[]>(
      "SELECT id, restaurant_name FROM restaurants WHERE id = ? AND owner_id = ?",
      [restaurantId, ownerId],
    );

    if (restaurant.length === 0) {
      console.warn(
        `[${context}] [SECURITY] Owner ${ownerId} tried to access unauthorized Restaurant ${restaurantId}`,
      );
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized restaurant access" });
    }
    console.log(
      `[${context}] Ownership verified for: ${restaurant[0].restaurant_name}`,
    );

    // 2. Receipt Generation
    const receiptNumber = `FUDX-SUB-${Date.now()}`;
    console.log(
      `[${context}] Step 2: Generated receipt number: ${receiptNumber}`,
    );

    // 3. Razorpay Order Creation
    console.log(`[${context}] Step 3: Calling Razorpay API...`);
    const options = {
      amount: amount * 100, // paise
      currency: "INR",
      receipt: receiptNumber,
    };

    const rzpOrder = await razorpay.orders.create(options);
    console.log(`[${context}] Razorpay Order created: ${rzpOrder.id}`);

    // 4. Save Pending Payment
    console.log(`[${context}] Step 4: Saving 'pending' record to database...`);
    await pool.execute(
      `INSERT INTO subscription_payments 
       (restaurant_id, receipt_number, amount, razorpay_order_id, payment_status) 
       VALUES (?, ?, ?, ?, 'pending')`,
      [restaurantId, receiptNumber, amount, rzpOrder.id],
    );
    console.log(`[${context}] DB record saved. Sending response to frontend.`);

    res.status(201).json({
      success: true,
      order_id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
    });
  } catch (error) {
    console.error(`[${context}] [FATAL ERROR]:`, error);
    res
      .status(500)
      .json({ success: false, message: "Could not initiate payment" });
  }
};

/**
 * @route   POST /owner/restaurant/subscription/verify
 */
export const verifySubscriptionPayment = async (
  req: Request,
  res: Response,
) => {
  const context = "VERIFY_SUB_PAYMENT";
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    restaurantId,
  } = req.body;

  console.log(`[${context}] --- Start Verification ---`);
  console.log(
    `[${context}] OrderID: ${razorpay_order_id}, PaymentID: ${razorpay_payment_id}`,
  );

  const connection = await pool.getConnection();

  try {
    // 1. Signature Verification
    console.log(`[${context}] Step 1: Validating HMAC signature...`);
    const secret = process.env.RAZORPAY_KEY_SECRET!;
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generated_signature = hmac.digest("hex");

    if (generated_signature !== razorpay_signature) {
      console.error(
        `[${context}] Signature Mismatch! Possible tampering detected.`,
      );
      return res
        .status(400)
        .json({ success: false, message: "Invalid payment signature" });
    }
    console.log(`[${context}] Signature verified successfully.`);

    // 2. Database Updates (Transaction)
    console.log(`[${context}] Step 2: Beginning database transaction...`);
    await connection.beginTransaction();

    console.log(
      `[${context}] Updating 'subscription_payments' table status to 'success'...`,
    );
    const [payResult] = await connection.execute<ResultSetHeader>(
      `UPDATE subscription_payments 
       SET payment_status = 'success', razorpay_payment_id = ?, razorpay_signature = ?, paid_at = NOW() 
       WHERE razorpay_order_id = ?`,
      [razorpay_payment_id, razorpay_signature, razorpay_order_id],
    );

    if (payResult.affectedRows === 0) {
      console.warn(
        `[${context}] No payment record found for OrderID: ${razorpay_order_id}`,
      );
    }

    console.log(
      `[${context}] Updating 'restaurants' table subscription dates...`,
    );
    const [restResult] = await connection.execute<ResultSetHeader>(
      `UPDATE restaurants 
       SET is_subscribed = 1, 
           subscription_start = IFNULL(subscription_start, NOW()), 
           subscription_end = DATE_ADD(IF(subscription_end > NOW(), subscription_end, NOW()), INTERVAL 1 YEAR)
       WHERE id = ?`,
      [restaurantId],
    );

    console.log(
      `[${context}] Date stacking logic completed. Rows affected: ${restResult.affectedRows}`,
    );

    await connection.commit();
    console.log(`[${context}] Transaction committed successfully.`);

    res.status(200).json({
      success: true,
      message: "Subscription updated successfully",
    });
  } catch (error) {
    console.error(
      `[${context}] [FATAL ERROR] Rolling back transaction:`,
      error,
    );
    await connection.rollback();
    res
      .status(500)
      .json({ success: false, message: "Payment verification failed" });
  } finally {
    connection.release();
    console.log(`[${context}] Connection released. --- End ---`);
  }
};
