import { notFound } from "next/navigation";
import { TicketsWallet } from "@/app/tickets/TicketsWallet";
import { previewTickets } from "../fixtures";

export const dynamic = "force-dynamic";

export default function PreviewTicketsPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const wallet = previewTickets(new Date());
  return <TicketsWallet upcoming={wallet.upcoming} past={wallet.past} preview />;
}
