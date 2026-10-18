import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Backdrop } from "@/components/ui/Backdrop";
import { StoreProvider } from "@/lib/store";
import "./globals.css";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", weight: ["400", "500", "600", "700"] });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "CDC Tracker — Never miss a drive",
  description: "Every VIT CDC opportunity, filtered for you, with a reminder before it closes.",
};

export const viewport: Viewport = { themeColor: "#05060f" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="font-sans">
        <Backdrop />
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
