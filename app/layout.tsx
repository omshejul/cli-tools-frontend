import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Footer } from "@/components/footer";
import { Analytics } from "@vercel/analytics/react";
export const metadata: Metadata = {
  title: "Media Downloader",
  description: "Download videos and audio from various platforms",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <main className="flex-1">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
      <Analytics />
    </html>
  );
}
