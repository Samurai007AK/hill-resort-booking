import type { Metadata } from "next";
import { Newsreader } from "next/font/google";
import { GuestFooter } from "@/server/guest/ui";
import "./globals.css";

// Headings only; body text uses the system face (A18). Self-hosted by Next, shown with a fallback at once.
const display = Newsreader({
  subsets: ["latin"],
  weight: ["300", "400"],
  display: "swap",
  variable: "--font-newsreader",
});

export const metadata: Metadata = {
  title: "Coffee Estate Resort, Chikkamagaluru",
  description: "Book rooms and villas direct at our coffee-estate resort.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={display.variable}>
      <body>
        {children}
        <GuestFooter />
      </body>
    </html>
  );
}
