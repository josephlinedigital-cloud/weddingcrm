import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: { default: "Wedding HQ", template: "%s · Wedding HQ" },
  description: "A private, practical wedding planning workspace.",
  robots: { index: false, follow: false },
  openGraph: { title: "Wedding HQ", description: "Every detail, calmly in hand.", images: [{ url: "/og.png", width: 1792, height: 895 }] },
  twitter: { card: "summary_large_image", title: "Wedding HQ", description: "Every detail, calmly in hand.", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<Toaster position="bottom-right" richColors /></body></html>;
}
