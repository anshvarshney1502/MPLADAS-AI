import type { Metadata } from "next";
import { Poppins, Inter } from "next/font/google";
import "./globals.css";
import { RoleProvider } from "@/lib/role-context";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Google Sans is a proprietary Google product typeface, not published on
// Google Fonts or any licensable font API — it cannot legitimately be
// included here. Poppins (headings) + Inter (body) are the two fonts
// actually used throughout, matching official Indian government portals'
// typography register rather than a third "premium SaaS" display face.

export const metadata: Metadata = {
  title: "MPLADS AI — Risk & Monitoring Intelligence",
  description:
    "An explainable, risk-based intelligence layer that transforms MPLADS transaction and project data into prioritized verification actions.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        <RoleProvider>{children}</RoleProvider>
      </body>
    </html>
  );
}
