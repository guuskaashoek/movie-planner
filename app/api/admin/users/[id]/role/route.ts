import { NextRequest, NextResponse } from "next/server";
import { getSessionActor } from "@/lib/authz";
import { ServiceError, setUserRole } from "@/lib/films";

type RouteParams = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const actor = await getSessionActor();
  if (!actor) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;

  try {
    const json = await req.json();
    // setUserRole enforces the admin check and refuses self-demotion.
    const result = await setUserRole(actor, Number(id), json.role);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ServiceError) {
      return new NextResponse(err.message, { status: err.status });
    }
    console.error("[admin/users/:id/role]", err);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
