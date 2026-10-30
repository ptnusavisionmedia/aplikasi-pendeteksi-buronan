import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { QueryProvider } from "@/lib/query-provider";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Sigap Buronan",
  description: "Platform deteksi wajah buronan berbasis AI untuk aparat, keamanan swasta, instansi hukum, dan masyarakat.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={poppins.variable}>
      <body className="font-sans antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
