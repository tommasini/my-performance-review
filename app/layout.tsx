import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Performance Review AI - Generate Compelling Reviews",
  description: "AI-powered performance review helper that generates compelling answers based on your actual GitHub, GitLab, and Jira contributions. Free to use with limited AI generations.",
  keywords: ["performance review", "AI", "GitHub", "developer tools", "career", "self-assessment"],
  authors: [{ name: "Performance Review AI" }],
  openGraph: {
    title: "Performance Review AI",
    description: "Generate compelling performance review answers powered by AI and your actual contributions",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Performance Review AI",
    description: "Generate compelling performance review answers powered by AI",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
