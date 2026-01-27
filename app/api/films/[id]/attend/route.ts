import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { attendees, users } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

type RouteParams = {
    params: Promise<{ id: string }>;
};

export async function POST(req: NextRequest, { params }: RouteParams) {
    const session = await auth();
    // @ts-expect-error added in auth callback
    const userId: number | undefined = session?.user?.id;
    if (!userId) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id: idParam } = await params;
    const filmId = parseInt(idParam);
    if (isNaN(filmId)) {
        return new NextResponse("Invalid film ID", { status: 400 });
    }

    // Check if already attending
    const existing = await db
        .select()
        .from(attendees)
        .where(
            sql`${attendees.filmId} = ${filmId} AND ${attendees.userId} = ${userId}`
        );

    if (existing.length > 0) {
        return NextResponse.json({ message: "Already attending" }, { status: 200 });
    }

    // Add user as attendee
    await db.insert(attendees).values({
        filmId,
        userId,
    });

    // Get updated attendee list
    const filmAttendees = await db
        .select({
            id: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
        })
        .from(attendees)
        .innerJoin(users, eq(attendees.userId, users.id))
        .where(eq(attendees.filmId, filmId));

    return NextResponse.json({ attendees: filmAttendees }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
    const session = await auth();
    // @ts-expect-error added in auth callback
    const userId: number | undefined = session?.user?.id;
    if (!userId) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id: idParam } = await params;
    const filmId = parseInt(idParam);
    if (isNaN(filmId)) {
        return new NextResponse("Invalid film ID", { status: 400 });
    }

    // Remove user from attendees
    await db
        .delete(attendees)
        .where(
            sql`${attendees.filmId} = ${filmId} AND ${attendees.userId} = ${userId}`
        );

    // Get updated attendee list
    const filmAttendees = await db
        .select({
            id: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
        })
        .from(attendees)
        .innerJoin(users, eq(attendees.userId, users.id))
        .where(eq(attendees.filmId, filmId));

    return NextResponse.json({ attendees: filmAttendees }, { status: 200 });
}
