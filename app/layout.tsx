import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { Sidebar } from "./components/Sidebar";
import "./globals.css";

const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500", "700"] });

export const metadata: Metadata = {
  title: "Revive",
  description: "Sourceflow HubSpot ticket triage & fix agent",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${roboto.className} min-h-screen bg-[#0d1117] text-[#ede5dc] flex`}>
        <Sidebar />
        <main className="flex-1 min-h-screen overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
