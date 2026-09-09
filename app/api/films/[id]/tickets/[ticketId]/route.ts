import { NextRequest, NextResponse } from "next/server";
import { getSessionActor } from "@/lib/authz";
import { getFilmTicketForViewer, ServiceError } from "@/lib/films";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; ticketId: string }> }
) {
  const actor = await getSessionActor();
  if (!actor) return new NextResponse("Unauthorized", { status: 401 });
  const values = await params;
  const filmId = Number(values.id);
  const ticketId = Number(values.ticketId);
  if (!Number.isInteger(filmId) || !Number.isInteger(ticketId)) {
    return new NextResponse("Invalid ticket", { status: 400 });
  }
  try {
    const ticket = await getFilmTicketForViewer(actor, filmId, ticketId);
    if (!ticket.signedUrl) return new NextResponse("Ticket image unavailable", { status: 404 });
    return NextResponse.redirect(ticket.signedUrl, {
      headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
    });
  } catch (error) {
    if (error instanceof ServiceError) return new NextResponse(error.message, { status: error.status });
    console.error("[ticket image]", error);
    return new NextResponse("Could not open ticket", { status: 500 });
  }
}
