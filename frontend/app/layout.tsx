import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Restyle — give any PDF a better look",
  description: "Restyle a PDF with a clean white-paper template. Content and figures preserved.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
