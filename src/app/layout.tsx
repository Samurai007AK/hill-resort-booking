import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Coffee Estate Resort, Chikkamagaluru",
  description: "Book rooms and villas direct at our coffee-estate resort.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <footer className="app-footer">
          <Link href="/">Silver Oaks</Link>
          <Link href="/enquire">Contact & events</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/login">Team sign in</Link>
        </footer>
      </body>
    </html>
  );
}
