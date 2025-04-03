import type { Metadata } from "next";
import "./globals.css";


export const metadata: Metadata = {
  title: "Media Downloader",
  description: "Download videos and audio from various platforms",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
