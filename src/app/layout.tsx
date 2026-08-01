import type { Metadata } from "next";
import { Inter, Literata, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-ui",
  subsets: ["latin"],
  display: "swap",
});

const literata = Literata({
  variable: "--font-read-literata",
  subsets: ["latin"],
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  variable: "--font-read-source-serif",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Reframe — beautifully re-typeset books",
  description:
    "Import rough PDF scans of books and re-typeset them into clean, readable pages.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${literata.variable} ${sourceSerif.variable} h-full antialiased light`}
      style={{ colorScheme: "light" }}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink font-sans">
        {children}
      </body>
    </html>
  );
}
