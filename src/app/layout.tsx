import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/components/language-provider";
import { requestLanguage } from "@/lib/request-language";
import { messages } from "@/lib/i18n";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = messages[await requestLanguage()];
  return { title: t.title, description: t.description };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const language = await requestLanguage();
  return (
    <html lang={language}>
      <head>
        <link rel="describedby" href="/llms.txt" type="text/plain" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <LanguageProvider language={language}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
