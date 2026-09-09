import { redirect } from "next/navigation";
import { getSessionActor } from "@/lib/authz";
import { listMyTickets } from "@/lib/films";
import { TicketsWallet } from "./TicketsWallet";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tickets · Movie Planner" };

export default async function TicketsPage() {
  const actor = await getSessionActor();
  if (!actor) redirect("/");
  const wallet = await listMyTickets(actor);
  return <TicketsWallet upcoming={wallet.upcoming} past={wallet.past} />;
}
