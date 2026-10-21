import { NextRequest } from "next/server";
import { GET, POST as authPost } from "@/lib/auth";
import { readCappedBody } from "@/lib/body-limit";

// Auth.js buffers the whole form body of these public endpoints, so a single
// anonymous 100 MB POST used to cost the server ~250 MB of memory. Its own
// forms (sign-in, sign-out, CSRF) are well under a kilobyte.
const MAX_AUTH_BODY = 64 * 1024;

export async function POST(req: NextRequest) {
  const body = await readCappedBody(req, MAX_AUTH_BODY);
  if (!body) return new Response("Payload too large", { status: 413 });
  return authPost(new NextRequest(req.url, { method: "POST", headers: req.headers, body }));
}

export { GET };
