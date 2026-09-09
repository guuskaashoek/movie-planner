import { NextRequest, NextResponse } from "next/server";
import { getSessionActor } from "@/lib/authz";
import { getFilmTicketQrForViewer, ServiceError } from "@/lib/films";

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
    const qr = await getFilmTicketQrForViewer(actor, filmId, ticketId);
    if (qr.kind === "svg") {
      return new NextResponse(qr.body, {
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Cache-Control": "private, no-store",
          "Referrer-Policy": "no-referrer",
        },
      });
    }
    return NextResponse.redirect(qr.url, {
      headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
    });
  } catch (error) {
    if (error instanceof ServiceError) return new NextResponse(error.message, { status: error.status });
    console.error("[ticket qr]", error);
    return new NextResponse("Could not open ticket QR", { status: 500 });
  }
}
