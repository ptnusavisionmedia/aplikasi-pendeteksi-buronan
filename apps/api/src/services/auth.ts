import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { authenticator } from "otplib";
import { env } from "../env";
import { prisma } from "./prisma";
import { redis } from "./redis";

const ROLES_REQUIRING_2FA = ["APARAT", "INSTANSI_HUKUM"];
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 15 * 60;

export class AuthError extends Error {
  constructor(message: string, public status = 401) {
    super(message);
  }
}

/**
 * Public self-registration. Always creates a MASYARAKAT account — role is not
 * a client input. Accounts for APARAT/KEAMANAN_SWASTA/INSTANSI_HUKUM/ADMIN are
 * provisioned directly by the operator (apps/api/prisma/seed.ts, see
 * ACCOUNT.md), never through this endpoint.
 */
export async function registerUser(params: { email: string; password: string; nama: string }) {
  const existing = await prisma.user.findUnique({ where: { email: params.email } });
  if (existing) throw new AuthError("Email sudah terdaftar", 409);

  const passwordHash = await bcrypt.hash(params.password, 12);

  const user = await prisma.user.create({
    data: {
      email: params.email,
      passwordHash,
      nama: params.nama,
      role: "MASYARAKAT",
      isVerified: true,
    },
  });

  return user;
}

function lockoutKey(email: string) {
  return `login:lockout:${email}`;
}

export async function authenticatePassword(email: string, password: string) {
  const isLocked = await redis.get(lockoutKey(email));
  if (isLocked) throw new AuthError("Akun terkunci, coba lagi dalam 15 menit", 423);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AuthError("Email atau password salah");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const attemptsKey = `login:attempts:${email}`;
    const attempts = await redis.incr(attemptsKey);
    await redis.expire(attemptsKey, LOCKOUT_SECONDS);
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      await redis.set(lockoutKey(email), "1", "EX", LOCKOUT_SECONDS);
    }
    throw new AuthError("Email atau password salah");
  }

  if (!user.isVerified) throw new AuthError("Akun belum diverifikasi admin", 403);

  await redis.del(`login:attempts:${email}`);
  return user;
}

export function requiresTwoFactor(role: string) {
  return ROLES_REQUIRING_2FA.includes(role);
}

export function generateOtpSecret() {
  return authenticator.generateSecret();
}

export function verifyOtp(token: string, secret: string) {
  return authenticator.verify({ token, secret });
}

export function issueJwt(user: { id: string; role: string; wilayahScope: string | null; instansiId: string | null }) {
  return jwt.sign(
    { id: user.id, role: user.role, wilayahScope: user.wilayahScope, instansiId: user.instansiId },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"] }
  );
}
