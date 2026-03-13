import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Parking Ticket | ParkFlow",
  description: "View your parking session details and request vehicle retrieval.",
};

export default function TicketLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {children}
    </div>
  );
}
