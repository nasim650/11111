import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = { variable: "font-sans" };
const geistMono = { variable: "font-mono" };

export async function generateMetadata(): Promise<Metadata> {
  // In a real app we could fetch from DB here:
  // const siteConfig = await prisma.siteConfig.findMany(...)
  
  return {
    title: "Khati Khadyo - Authentic Bangladeshi Food Products",
    description: "Premium authentic Bangladeshi food products delivered fresh to your doorstep.",
    keywords: ["Khati Khadyo", "Bangladeshi food", "authentic food", "organic food"],
    authors: [{ name: "Khati Khadyo" }],
    icons: {
      icon: [
        { url: "/all_logo.png", type: "image/png" },
        { url: "/favicon.png", type: "image/png" },
      ],
      apple: "/all_logo.png",
    },
    openGraph: {
      title: "Khati Khadyo - Authentic Bangladeshi Food Products",
      description: "Premium authentic Bangladeshi food products delivered fresh to your doorstep.",
      siteName: "Khati Khadyo",
      type: "website",
      images: [
        {
          url: "/all_logo.png",
          width: 800,
          height: 600,
          alt: "Khati Khadyo Logo",
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: "Khati Khadyo - Authentic Bangladeshi Food Products",
      description: "Premium authentic Bangladeshi food products delivered fresh to your doorstep.",
      images: ["/all_logo.png"],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
