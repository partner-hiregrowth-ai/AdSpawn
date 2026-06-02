import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { FacebookSDK } from "@/components/FacebookSDK";
import { SWRProvider } from "@/components/SWRProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AdSpawn - Professional Meta Ads Management",
  description: "Duplicate Facebook Ads structures safely and efficiently.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gray-950 text-gray-100 antialiased`}>
        <SWRProvider>
          <FacebookSDK />
          {children}
          <Toaster position="top-right" />
        </SWRProvider>
      </body>
    </html>
  );
}
