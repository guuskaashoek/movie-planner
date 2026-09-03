import { NextRequest, NextResponse } from "next/server";
import { getSessionActor } from "@/lib/authz";
import { ServiceError, setAttendance } from "@/lib/films";

type RouteParams = {
    params: Promise<{ id: string }>;
};

async function change(req: NextRequest, params: RouteParams["params"], attending: boolean) {
    const actor = await getSessionActor();
    if (!actor) return new NextResponse("Unauthorized", { status: 401 });

    const { id: idParam } = await params;
    const filmId = Number(idParam);
    if (!Number.isInteger(filmId)) {
        return new NextResponse("Invalid film ID", { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") === "interested" ? "interested" : "going";

    try {
        const result = await setAttendance(actor, filmId, { type, attending });
        // The clients read `attendees` for the list they just changed.
        const list = type === "interested" ? result.interestedUsers : result.goingUsers;
        return NextResponse.json({ attendees: list }, { status: attending ? 201 : 200 });
    } catch (err) {
        if (err instanceof ServiceError) {
            return new NextResponse(err.message, { status: err.status });
        }
        console.error("[films/:id/attend]", err);
        return new NextResponse("Internal server error", { status: 500 });
    }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
    return change(req, params, true);
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
    return change(req, params, false);
}
