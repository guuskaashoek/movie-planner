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

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") === "interested" ? "interested" : "going";

    // Check if already exists for this type
    const existing = await db
        .select()
        .from(attendees)
        .where(
            sql`${attendees.filmId} = ${filmId} AND ${attendees.userId} = ${userId} AND ${attendees.type} = ${type}`
        );

    if (existing.length > 0) {
        return NextResponse.json({ message: "Already registered" }, { status: 200 });
    }

    await db.insert(attendees).values({ filmId, userId, type });

    const filmAttendees = await db
        .select({ id: users.id, name: users.name, email: users.email, image: users.image })
        .from(attendees)
        .innerJoin(users, eq(attendees.userId, users.id))
        .where(sql`${attendees.filmId} = ${filmId} AND ${attendees.type} = ${type}`);

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

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") === "interested" ? "interested" : "going";

    await db
        .delete(attendees)
        .where(
            sql`${attendees.filmId} = ${filmId} AND ${attendees.userId} = ${userId} AND ${attendees.type} = ${type}`
        );

    const filmAttendees = await db
        .select({ id: users.id, name: users.name, email: users.email, image: users.image })
        .from(attendees)
        .innerJoin(users, eq(attendees.userId, users.id))
        .where(sql`${attendees.filmId} = ${filmId} AND ${attendees.type} = ${type}`);

    return NextResponse.json({ attendees: filmAttendees }, { status: 200 });
}
