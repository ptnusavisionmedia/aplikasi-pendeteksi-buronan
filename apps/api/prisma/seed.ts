import "dotenv/config";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PASSWORD = "TestPassword123!";
const ROLES_REQUIRING_2FA = ["APARAT", "INSTANSI_HUKUM"];

type SeedUser = {
  email: string;
  nama: string;
  role: "ADMIN" | "APARAT" | "KEAMANAN_SWASTA" | "INSTANSI_HUKUM" | "MASYARAKAT";
  wilayahScope?: string;
  instansiId?: string;
};

async function main() {
  const instansi = await prisma.instansi.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      nama: "Polres Demo",
      jenis: "Kepolisian",
      wilayah: "Jakarta Selatan",
      statusVerifikasi: true,
    },
  });

  const users: SeedUser[] = [
    { email: "admin1@example.com", nama: "Admin Utama", role: "ADMIN" },
    { email: "aparat2@example.com", nama: "Bripka Dwi", role: "APARAT", wilayahScope: "Jakarta Selatan", instansiId: instansi.id },
    { email: "keamanan1@example.com", nama: "Satpam Rian", role: "KEAMANAN_SWASTA", wilayahScope: "Jakarta Selatan" },
    { email: "instansi1@example.com", nama: "Kompol Sari", role: "INSTANSI_HUKUM", wilayahScope: "Jakarta Selatan", instansiId: instansi.id },
    { email: "masyarakat1@example.com", nama: "Budi Santoso", role: "MASYARAKAT" },
  ];

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const results: { email: string; role: string; twoFactorSecret?: string }[] = [];

  for (const u of users) {
    const twoFactorSecret = ROLES_REQUIRING_2FA.includes(u.role) ? authenticator.generateSecret() : undefined;

    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        passwordHash,
        nama: u.nama,
        role: u.role,
        wilayahScope: u.wilayahScope,
        instansiId: u.instansiId,
        isVerified: true,
        ...(twoFactorSecret ? { twoFactorSecret } : {}),
      },
      create: {
        email: u.email,
        passwordHash,
        nama: u.nama,
        role: u.role,
        wilayahScope: u.wilayahScope,
        instansiId: u.instansiId,
        isVerified: true,
        twoFactorSecret,
      },
    });

    results.push({ email: u.email, role: u.role, twoFactorSecret });
  }

  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
