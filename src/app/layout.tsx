import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import Providers from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Shawarma House : Centrum Branch",
  description: "Branch Daily Report — track receipts, payments, sales and deposits.",
  keywords: ["daily report", "cash", "expense", "income", "tracker", "Shawarma House", "branch report"],
  authors: [{ name: "Shawarma House" }],
  // Favicon is served dynamically by /app/icon/route.ts so it always
  // matches the business logo stored in the database. When an admin
  // updates the logo via Settings, the favicon updates automatically
  // (after the 1-hour cache expires).
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>{children}</Providers>
        <Toaster />
        <Sonner />
      </body>
    </html>
  );
}
