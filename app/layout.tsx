import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";  // ✅ Use sonner

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ParkFlow - AI-Powered Valet Parking Management",
  description: "Frictionless valet parking with AI-powered license plate recognition",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}