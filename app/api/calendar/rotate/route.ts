import { NextResponse } from "next/server";
import { getSessionActor } from "@/lib/authz";
import { rotateCalendarFeed } from "@/lib/films";

export const dynamic = "force-dynamic";

/** Give the signed-in member a new calendar feed URL; the old one stops working. */
export async function POST() {
  // getSessionActor, not auth(): a removed member's JWT stays valid.
  const actor = await getSessionActor();
  if (!actor) return new NextResponse("Unauthorized", { status: 401 });
  try {
    const feed = await rotateCalendarFeed(actor);
    return NextResponse.json({ icsUrl: feed.icsUrl }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[calendar rotate]", err);
    return new NextResponse("Could not reset the calendar link", { status: 500 });
  }
}
