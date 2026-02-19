import { GeistMono } from "geist/font/mono";
import { Roboto as Font } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import Providers from "./providers";

export const metadata = {
  metadataBase: new URL("https://postgres-kysely.vercel.app"),
  title: "Vercel Postgres Demo with Kysely",
  description:
    "A simple Next.js app with Vercel Postgres as the database and Kysely as the ORM",
};

const global = Font({
  variable: "--font-global",
  subsets: ["latin"],
  display: "swap",
  weight: "400",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${global.variable} ${GeistMono.variable}`}>
        <Providers>{children}</Providers>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
