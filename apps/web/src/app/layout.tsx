import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { QueryProvider } from "@/lib/query-provider";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
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
    <html lang="id">
      <body className={`${figtree.variable} font-sans antialiased`}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
