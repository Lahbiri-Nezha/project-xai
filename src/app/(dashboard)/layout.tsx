"use client";

import Sidebar from "@/components/dashboard/Sidebar";
import TRPCProvider from "@/lib/trpc/provider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TRPCProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col">{children}</div>
      </div>
    </TRPCProvider>
  );
}
