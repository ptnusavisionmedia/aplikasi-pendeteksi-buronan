import { randomBytes } from "crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../env";
import { writeAuditLog } from "../services/audit-log";
import {
  AuthError,
  authenticatePassword,
  issueJwt,
  registerUser,
  requiresTwoFactor,
  verifyOtp,
} from "../services/auth";
import { prisma } from "../services/prisma";
import { redis } from "../services/redis";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  nama: z.string().min(1),
});

// Public self-registration always creates a MASYARAKAT account. Staff/admin
// accounts (APARAT, KEAMANAN_SWASTA, INSTANSI_HUKUM, ADMIN) are provisioned
// directly by the operator, not self-registered — see ACCOUNT.md.
authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const user = await registerUser(parsed.data);
    await writeAuditLog({ action: "REGISTER", entityType: "User", entityId: user.id });
    res.status(201).json({
      id: user.id,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      message: "Registrasi berhasil",
    });
  } catch (err) {
    if (err instanceof AuthError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const user = await authenticatePassword(parsed.data.email, parsed.data.password);

    if (requiresTwoFactor(user.role)) {
      const pendingToken = jwt.sign({ id: user.id, purpose: "otp_pending" }, env.jwtSecret, {
        expiresIn: "5m",
      });
      return res.json({ requiresOtp: true, pendingToken });
    }

    const token = issueJwt(user);
    await writeAuditLog({ userId: user.id, action: "LOGIN", entityType: "User", entityId: user.id });
    res.json({ requiresOtp: false, token });
  } catch (err) {
    if (err instanceof AuthError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

const verifyOtpSchema = z.object({
  pendingToken: z.string(),
  otp: z.string().length(6),
});

authRouter.post("/login/verify-otp", async (req, res) => {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  let payload: { id: string; purpose: string };
  try {
    payload = jwt.verify(parsed.data.pendingToken, env.jwtSecret) as typeof payload;
  } catch {
    return res.status(401).json({ error: "Pending token tidak valid atau kedaluwarsa" });
  }
  if (payload.purpose !== "otp_pending") return res.status(401).json({ error: "Token tidak valid" });

  const user = await prisma.user.findUnique({ where: { id: payload.id } });
  if (!user?.twoFactorSecret) return res.status(400).json({ error: "2FA belum diaktifkan untuk user ini" });

  const valid = verifyOtp(parsed.data.otp, user.twoFactorSecret);
  if (!valid) return res.status(401).json({ error: "Kode OTP salah" });

  const token = issueJwt(user);
  await writeAuditLog({ userId: user.id, action: "LOGIN_OTP_VERIFIED", entityType: "User", entityId: user.id });
  res.json({ token });
});

const forgotPasswordSchema = z.object({ email: z.string().email() });

authRouter.post("/forgot-password", async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  // Always respond 200 regardless of whether the email exists, to avoid leaking account existence.
  if (user) {
    const resetToken = randomBytes(32).toString("hex");
    await redis.set(`reset-password:${resetToken}`, user.id, "EX", 30 * 60);
    // TODO: wire up a real email/SMS provider. For now, log the link so it's visible in dev.
    console.log(`[dev] Reset password link for ${user.email}: /reset-password?token=${resetToken}`);
  }
  res.json({ message: "Jika email terdaftar, link reset password telah dikirim" });
});

const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8),
});

authRouter.post("/reset-password", async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const userId = await redis.get(`reset-password:${parsed.data.token}`);
  if (!userId) return res.status(400).json({ error: "Token tidak valid atau kedaluwarsa" });

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  await redis.del(`reset-password:${parsed.data.token}`);
  await writeAuditLog({ userId, action: "PASSWORD_RESET", entityType: "User", entityId: userId });

  res.json({ message: "Password berhasil diubah" });
});

authRouter.get("/me", async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Missing bearer token" });

  try {
    const payload = jwt.verify(header.slice("Bearer ".length), env.jwtSecret) as { id: string };
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, nama: true, role: true, wilayahScope: true, instansiId: true },
    });
    if (!user) return res.status(404).json({ error: "User tidak ditemukan" });
    res.json(user);
  } catch {
    res.status(401).json({ error: "Token tidak valid" });
  }
});
