import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vilo OS",
  description: "Clinical Research Operations platform for Vilo Research Group",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
