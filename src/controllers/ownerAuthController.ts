import { Request, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { RowDataPacket, ResultSetHeader } from "mysql2";

import { pool } from "../config/db.js";
import { sendOTPEmail } from "../config/mailer.js";
import { generateToken } from "../utils/jwt.js";

/* INTERFACES */

interface OwnerRow extends RowDataPacket {
  id: number;
  name: string;
  email: string;
  password: string;
  mobile_no: string;
  is_verified: number;
}

interface OTPRow extends RowDataPacket {
  otp_hash: string;
  expires_at: Date;
}

/* UTILS */
const normalizeEmail = (email: string) => email.trim().toLowerCase();

const logStep = (context: string, message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  console.log(
    `[${timestamp}] [OWNER_CONTROLLER] [${context}] ${message}`,
    data || "",
  );
};

/* --- 1. OWNER CHECK AUTH (GET ME) --- */
export const getOwnerMe = async (req: Request, res: Response) => {
  const context = "GET_OWNER_ME";
  try {
    const ownerId = (req as any).user.id;
    logStep(context, `Extracted OwnerID from middleware: ${ownerId}`);

    const [rows] = await pool.execute<OwnerRow[]>(
      "SELECT id, name, email, mobile_no FROM owners WHERE id = ?",
      [ownerId],
    );

    if (rows.length === 0) {
      logStep(context, `Owner ${ownerId} not found in database.`);
      return res
        .status(404)
        .json({ success: false, message: "Owner not found" });
    }

    logStep(context, `Success! Session valid for: ${rows[0].email}`);
    res.status(200).json({ success: true, user: rows[0] });
  } catch (error: any) {
    logStep(context, "FATAL: Error in getOwnerMe execution.", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/* --- 2. OWNER REGISTER --- */
export const ownerRegister = async (req: Request, res: Response) => {
  const context = "OWNER_REGISTER";
  const { name, password, mobile_no } = req.body;
  const email = normalizeEmail(req.body.email || "");
  const connection = await pool.getConnection();

  logStep(context, `Attempting registration for: ${email}`);

  try {
    await connection.beginTransaction();
    logStep(context, "Transaction started.");

    const [exist] = await connection.query<OwnerRow[]>(
      "SELECT id, is_verified FROM owners WHERE email=? FOR UPDATE",
      [email],
    );

    if (exist.length > 0) {
      logStep(
        context,
        `Email conflict found. Email: ${email}, Verified: ${exist[0].is_verified}`,
      );
      if (exist[0].is_verified === 0) {
        logStep(
          context,
          "Redirecting to verify page: Account exists but unverified.",
        );
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message:
            "Account exists but is not verified. Please go to the verify page.",
        });
      }
      logStep(context, "Registration rejected: Email already registered.");
      await connection.rollback();
      return res
        .status(409)
        .json({ success: false, message: "Owner email already registered" });
    }

    logStep(context, "Hashing password...");
    const hashed = await bcrypt.hash(password, 10);

    logStep(context, "Inserting owner into 'owners' table...");
    await connection.query<ResultSetHeader>(
      "INSERT INTO owners (name, email, password, mobile_no, is_verified) VALUES (?, ?, ?, ?, 0)",
      [name, email, hashed, mobile_no],
    );

    const otp = crypto.randomInt(100000, 999999);
    logStep(context, `Generated OTP (hidden). Hashing OTP for storage...`);
    const otpHash = await bcrypt.hash(String(otp), 10);

    logStep(context, "Cleaning up old register OTPs for role 'owner'...");
    await connection.query(
      "DELETE FROM otp_codes WHERE email=? AND role='owner' AND purpose='register'",
      [email],
    );

    logStep(context, "Storing new OTP hash...");
    await connection.query(
      "INSERT INTO otp_codes (email, role, purpose, otp_hash, expires_at) VALUES (?, 'owner', 'register', ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))",
      [email, otpHash],
    );

    await connection.commit();
    logStep(context, "Transaction committed. Handing over to Mailer...");
    await sendOTPEmail(email, otp);

    logStep(context, "Registration sequence successful.");
    res.status(201).json({
      success: true,
      message: "Registration successful. Owner OTP sent",
    });
  } catch (err) {
    logStep(context, "FATAL: Registration failed. Rolling back.", err);
    await connection.rollback();
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    connection.release();
    logStep(context, "Database connection released.");
  }
};

/* --- 3. OWNER VERIFY OTP --- */
export const verifyOwnerOTP = async (req: Request, res: Response) => {
  const context = "VERIFY_OWNER_OTP";
  const email = normalizeEmail(req.body.email || "");
  const { otp } = req.body;
  const connection = await pool.getConnection();

  logStep(context, `Verifying OTP for Owner: ${email}`);

  try {
    await connection.beginTransaction();

    const [ownerStatus] = await connection.query<OwnerRow[]>(
      "SELECT id, is_verified FROM owners WHERE email=? FOR UPDATE",
      [email],
    );

    if (ownerStatus.length > 0 && ownerStatus[0].is_verified === 1) {
      logStep(
        context,
        "Owner already verified. Bypassing OTP check and issuing token.",
      );
      const token = generateToken(ownerStatus[0].id);
      res.cookie("ownerToken", token, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 604800000,
      });
      await connection.commit();
      return res.status(200).json({
        success: true,
        message: "Owner verified",
        user: ownerStatus[0],
      });
    }

    logStep(
      context,
      "Searching for active OTP in 'otp_codes' where role='owner'...",
    );
    const [rows] = await connection.query<OTPRow[]>(
      "SELECT otp_hash FROM otp_codes WHERE email=? AND role='owner' AND purpose='register' AND expires_at > NOW() FOR UPDATE",
      [email],
    );

    if (rows.length === 0) {
      logStep(
        context,
        "Verification failed: No active OTP found or OTP expired.",
      );
      await connection.rollback();
      return res
        .status(401)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    logStep(context, "Comparing hashes...");
    const isMatch = await bcrypt.compare(String(otp), rows[0].otp_hash);
    if (!isMatch) {
      logStep(context, "Verification failed: OTP hash mismatch.");
      await connection.rollback();
      return res.status(401).json({ success: false, message: "Incorrect OTP" });
    }

    logStep(context, "Updating owner status to 'is_verified = 1'...");
    await connection.query("UPDATE owners SET is_verified=1 WHERE email=?", [
      email,
    ]);

    logStep(context, "Deleting used OTP...");
    await connection.query(
      "DELETE FROM otp_codes WHERE email=? AND role='owner'",
      [email],
    );

    await connection.commit();
    logStep(context, "Transaction committed. Verification successful.");

    const token = generateToken(ownerStatus[0].id);
    res.cookie("ownerToken", token, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 604800000,
    });

    logStep(context, "Owner session cookie issued.");
    res.status(200).json({
      success: true,
      message: "Owner account verified",
      user: ownerStatus[0],
    });
  } catch (err) {
    logStep(context, "FATAL: verifyOwnerOTP failed.", err);
    await connection.rollback();
    res.status(500).json({ success: false, message: "Verification failed" });
  } finally {
    connection.release();
  }
};

/* --- 4. OWNER LOGIN --- */
export const ownerLogin = async (req: Request, res: Response) => {
  const context = "OWNER_LOGIN";
  const email = normalizeEmail(req.body.email || "");
  const { password } = req.body;

  logStep(context, `Attempting login for Owner: ${email}`);

  try {
    const [rows] = await pool.query<OwnerRow[]>(
      "SELECT * FROM owners WHERE email=?",
      [email],
    );

    if (rows.length === 0) {
      logStep(context, "Login rejected: Owner email not found.");
      return res
        .status(404)
        .json({ success: false, message: "Owner email is not registered" });
    }

    logStep(context, "Checking password match...");
    const isMatch = await bcrypt.compare(password, rows[0].password);
    if (!isMatch) {
      logStep(context, "Login rejected: Incorrect password.");
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    if (rows[0].is_verified === 0) {
      logStep(context, "Login rejected: Owner account not verified.");
      return res.status(403).json({
        success: false,
        message: "Please verify your owner account first",
      });
    }

    logStep(context, "Generating Owner JWT token...");
    const token = generateToken(rows[0].id);
    res.cookie("ownerToken", token, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 604800000,
    });

    logStep(context, "Login successful. Owner session started.");
    return res
      .status(200)
      .json({ success: true, message: "Welcome to Dashboard", user: rows[0] });
  } catch (err) {
    logStep(context, "FATAL: ownerLogin execution error.", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

/* --- 5. OWNER FORGOT PASSWORD --- */
export const ownerForgotPassword = async (req: Request, res: Response) => {
  const context = "OWNER_FORGOT_PASSWORD";
  const email = normalizeEmail(req.body.email || "");

  logStep(context, `Owner reset flow started for: ${email}`);

  try {
    const [owners] = await pool.query<OwnerRow[]>(
      "SELECT id FROM owners WHERE email=?",
      [email],
    );

    if (owners.length === 0) {
      logStep(context, "Reset initiation rejected: Email not found.");
      return res
        .status(404)
        .json({ success: false, message: "Business email not registered" });
    }

    const otp = crypto.randomInt(100000, 999999);
    logStep(context, "New reset OTP generated. Hashing...");
    const otpHash = await bcrypt.hash(String(otp), 10);

    logStep(context, "Cleaning up existing reset codes for owner role...");
    await pool.query(
      "DELETE FROM otp_codes WHERE email=? AND role='owner' AND purpose='reset_password'",
      [email],
    );

    logStep(context, "Inserting new owner reset record...");
    await pool.query(
      "INSERT INTO otp_codes (email, role, purpose, otp_hash, expires_at) VALUES (?, 'owner', 'reset_password', ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))",
      [email, otpHash],
    );

    logStep(context, "Dispatching reset email...");
    await sendOTPEmail(email, otp);
    res.status(200).json({
      success: true,
      message: "Reset OTP sent to your business email",
    });
  } catch (err) {
    logStep(context, "FATAL: ownerForgotPassword failed.", err);
    res.status(500).json({ success: false, message: "Error initiating reset" });
  }
};

/* --- 6. OWNER VERIFY RESET OTP --- */
export const ownerVerifyResetOTP = async (req: Request, res: Response) => {
  const context = "OWNER_VERIFY_RESET_OTP";
  const email = normalizeEmail(req.body.email || "");
  const { otp } = req.body;

  logStep(context, `Verifying reset token for Owner: ${email}`);

  try {
    const [rows] = await pool.query<OTPRow[]>(
      "SELECT otp_hash FROM otp_codes WHERE email=? AND role='owner' AND purpose='reset_password' AND expires_at > NOW()",
      [email],
    );

    if (rows.length === 0) {
      logStep(
        context,
        "Verification failed: No reset code found or code expired.",
      );
      return res
        .status(401)
        .json({ success: false, message: "Incorrect or expired OTP" });
    }

    logStep(context, "Checking OTP hash...");
    const isMatch = await bcrypt.compare(String(otp), rows[0].otp_hash);
    if (!isMatch) {
      logStep(context, "Verification failed: Reset hash mismatch.");
      return res
        .status(401)
        .json({ success: false, message: "Incorrect or expired OTP" });
    }

    logStep(context, "Owner reset code validated.");
    res
      .status(200)
      .json({ success: true, message: "OTP verified. Proceed to reset." });
  } catch (err) {
    logStep(context, "FATAL: ownerVerifyResetOTP error.", err);
    res.status(500).json({ success: false, message: "Verification failed" });
  }
};

/* --- 7. OWNER RESET PASSWORD FINAL --- */
export const ownerResetPassword = async (req: Request, res: Response) => {
  const context = "OWNER_RESET_PASSWORD";
  const email = normalizeEmail(req.body.email || "");
  const { otp, password: newPassword } = req.body;
  const connection = await pool.getConnection();

  logStep(context, `Finalizing password update for Owner: ${email}`);

  try {
    await connection.beginTransaction();

    const [owners] = await connection.query<OwnerRow[]>(
      "SELECT password FROM owners WHERE email=? FOR UPDATE",
      [email],
    );

    logStep(context, "Ensuring new password isn't the same as old...");
    const isOldPass = await bcrypt.compare(newPassword, owners[0].password);
    if (isOldPass) {
      logStep(context, "Rejected: New password is identical to old password.");
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "New password cannot be the same as old",
      });
    }

    logStep(context, "One last check on reset OTP validity...");
    const [otpRow] = await connection.query<OTPRow[]>(
      "SELECT otp_hash FROM otp_codes WHERE email=? AND role='owner' AND purpose='reset_password' AND expires_at > NOW() FOR UPDATE",
      [email],
    );

    if (
      otpRow.length === 0 ||
      !(await bcrypt.compare(String(otp), otpRow[0].otp_hash))
    ) {
      logStep(
        context,
        "Verification failed: Reset link expired during transaction.",
      );
      await connection.rollback();
      return res
        .status(401)
        .json({ success: false, message: "Invalid reset token" });
    }

    logStep(context, "Hashing new password...");
    const hashed = await bcrypt.hash(newPassword, 10);

    logStep(context, "Updating 'owners' table password...");
    await connection.query("UPDATE owners SET password=? WHERE email=?", [
      hashed,
      email,
    ]);

    logStep(context, "Cleaning up 'owner' role reset codes...");
    await connection.query(
      "DELETE FROM otp_codes WHERE email=? AND role='owner'",
      [email],
    );

    await connection.commit();
    logStep(context, "Password update successful.");
    res.status(200).json({
      success: true,
      message: "Dashboard access restored. Password updated.",
    });
  } catch (err) {
    logStep(
      context,
      "FATAL: ownerResetPassword execution failed. Rolling back.",
      err,
    );
    await connection.rollback();
    res.status(500).json({ success: false, message: "Reset failed" });
  } finally {
    connection.release();
  }
};

/* --- 8. OWNER RESEND OTP --- */
export const ownerResendOTP = async (req: Request, res: Response) => {
  const context = "OWNER_RESEND_OTP";
  const { purpose } = req.body;
  const email = normalizeEmail(req.body.email || "");

  logStep(context, `Owner Resend (${purpose}) requested for: ${email}`);

  try {
    const otp = crypto.randomInt(100000, 999999);
    logStep(context, "Generating new hash...");
    const otpHash = await bcrypt.hash(String(otp), 10);

    logStep(
      context,
      `Deleting old codes for role='owner' and purpose='${purpose}'...`,
    );
    await pool.query(
      "DELETE FROM otp_codes WHERE email=? AND role='owner' AND purpose=?",
      [email, purpose],
    );

    logStep(context, "Inserting fresh OTP...");
    await pool.query(
      "INSERT INTO otp_codes (email, role, purpose, otp_hash, expires_at) VALUES (?, 'owner', ?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))",
      [email, purpose, otpHash],
    );

    logStep(context, "Sending email...");
    await sendOTPEmail(email, otp);
    logStep(context, "Owner resend flow successful.");
    res
      .status(200)
      .json({ success: true, message: "Owner OTP resent successfully" });
  } catch (err) {
    logStep(context, "FATAL: ownerResendOTP error.", err);
    res.status(500).json({ success: false, message: "Resend error" });
  }
};

/* --- 9. OWNER LOGOUT --- */
export const ownerLogout = (req: Request, res: Response) => {
  const context = "OWNER_LOGOUT";
  logStep(context, "Clearing 'ownerToken' cookie...");
  res.clearCookie("ownerToken", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
  });
  logStep(context, "Owner session terminated.");
  res.status(200).json({ success: true, message: "Owner logged out" });
};
