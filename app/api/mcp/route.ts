import { NextRequest, NextResponse } from "next/server";
import { getApiKeyActor, type Actor } from "@/lib/authz";
import { ServiceError } from "@/lib/films";
import { findTool, toolsFor } from "@/lib/mcp/tools";

/**
 * Model Context Protocol server (Streamable HTTP, stateless).
 *
 * Everything is one POST endpoint speaking JSON-RPC 2.0, which is what remote
 * MCP clients such as Grok, Claude and the MCP Inspector expect. Authentication
 * is a personal API key sent as `Authorization: Bearer mp_...`; the key decides
 * whose films are touched and whether admin tools are available.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SERVER_NAME = "movie-planner";
const SERVER_VERSION = "1.0.0";

// Newest first. We answer with the client's version when we know it.
const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const DEFAULT_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Api-Key, Mcp-Protocol-Version, Mcp-Session-Id, Accept",
  "Access-Control-Expose-Headers": "Mcp-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
};

const ERROR_CODES = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603,
};

function rpcResult(id: JsonRpcId, result: unknown) {
  return { jsonrpc: "2.0" as const, id, result };
}

function rpcError(id: JsonRpcId, code: number, message: string, data?: unknown) {
  return { jsonrpc: "2.0" as const, id, error: { code, message, ...(data ? { data } : {}) } };
}

function json(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: { ...CORS_HEADERS, ...(init?.headers ?? {}) },
  });
}

/** Tool results are text content; models read the JSON we put inside. */
function toolSuccess(payload: unknown) {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    isError: false,
  };
}

/**
 * A failing tool is reported as a *successful* JSON-RPC response carrying
 * isError, so the model sees the reason and can correct itself instead of the
 * client treating it as a transport failure.
 */
function toolFailure(message: string) {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}

function describeTools(actor: Actor) {
  return toolsFor(actor).map((tool) => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: {
      title: tool.title,
      readOnlyHint: tool.readOnly ?? false,
      destructiveHint: tool.destructive ?? false,
      idempotentHint: tool.readOnly ?? false,
      openWorldHint: false,
    },
  }));
}

async function handleToolCall(actor: Actor, params: Record<string, unknown>) {
  const name = typeof params.name === "string" ? params.name : "";
  const tool = findTool(name);

  if (!tool) {
    const available = toolsFor(actor)
      .map((t) => t.name)
      .join(", ");
    return toolFailure(`Unknown tool "${name}". Available tools: ${available}`);
  }

  if (tool.adminOnly && !actor.isAdmin) {
    return toolFailure(
      `The tool "${name}" is only available to admin accounts. You are signed in as ${actor.email} (role: ${actor.role}).`
    );
  }

  const rawArgs = params.arguments;
  const args: Record<string, unknown> =
    rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs)
      ? (rawArgs as Record<string, unknown>)
      : {};

  try {
    const result = await tool.handler(actor, args);
    return toolSuccess(result);
  } catch (err) {
    if (err instanceof ServiceError) return toolFailure(err.message);
    console.error(`[mcp] tool ${name} failed:`, err);
    return toolFailure(err instanceof Error ? err.message : "Unexpected server error");
  }
}

async function dispatch(actor: Actor, message: JsonRpcRequest, negotiated: { version: string }) {
  const id = message.id ?? null;
  const method = message.method ?? "";
  const params = (message.params ?? {}) as Record<string, unknown>;

  switch (method) {
    case "initialize": {
      const requested =
        typeof params.protocolVersion === "string" ? params.protocolVersion : undefined;
      const version =
        requested && SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
          ? requested
          : DEFAULT_PROTOCOL_VERSION;
      negotiated.version = version;

      return rpcResult(id, {
        protocolVersion: version,
        capabilities: {
          tools: { listChanged: false },
        },
        serverInfo: {
          name: SERVER_NAME,
          title: "Movie Planner",
          version: SERVER_VERSION,
        },
        instructions:
          "Manage a shared film calendar: create films, set posters from an image URL, run date polls, mark attendance, comment and rate. " +
          "Call whoami first to see whether this account has admin rights - admins can edit, move and delete every user's films and act on behalf of other users with the asUser argument. " +
          "Film ids come from list_films or get_film. Dates are YYYY-MM-DD and times are 24h HH:mm.",
      });
    }

    case "ping":
      return rpcResult(id, {});

    case "tools/list":
      return rpcResult(id, { tools: describeTools(actor) });

    case "tools/call":
      return rpcResult(id, await handleToolCall(actor, params));

    // Some clients probe these even though we advertise no such capability.
    case "resources/list":
      return rpcResult(id, { resources: [] });
    case "resources/templates/list":
      return rpcResult(id, { resourceTemplates: [] });
    case "prompts/list":
      return rpcResult(id, { prompts: [] });

    case "completion/complete":
      return rpcResult(id, { completion: { values: [], hasMore: false } });

    case "logging/setLevel":
      return rpcResult(id, {});

    default:
      return rpcError(id, ERROR_CODES.methodNotFound, `Unknown method: ${method}`);
  }
}

function isNotification(message: JsonRpcRequest): boolean {
  return message.id === undefined || message.id === null;
}

export async function POST(req: NextRequest) {
  const actor = await getApiKeyActor(req);
  if (!actor) {
    return json(
      rpcError(
        null,
        ERROR_CODES.invalidRequest,
        "Unauthorized: send a Movie Planner API key as 'Authorization: Bearer mp_...'. Create one at /settings."
      ),
      {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Bearer realm="movie-planner", error="invalid_token"',
        },
      }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(rpcError(null, ERROR_CODES.parse, "Request body is not valid JSON"), {
      status: 400,
    });
  }

  const negotiated = { version: DEFAULT_PROTOCOL_VERSION };
  const messages: JsonRpcRequest[] = Array.isArray(body)
    ? (body as JsonRpcRequest[])
    : [body as JsonRpcRequest];

  if (messages.length === 0) {
    return json(rpcError(null, ERROR_CODES.invalidRequest, "Empty batch"), { status: 400 });
  }

  const responses = [];
  for (const message of messages) {
    if (!message || typeof message !== "object" || typeof message.method !== "string") {
      responses.push(
        rpcError(null, ERROR_CODES.invalidRequest, "Each message needs a 'method' string")
      );
      continue;
    }

    // Notifications (no id) get no response body at all.
    if (isNotification(message)) continue;

    try {
      responses.push(await dispatch(actor, message, negotiated));
    } catch (err) {
      console.error("[mcp] dispatch failed:", err);
      responses.push(
        rpcError(
          message.id ?? null,
          ERROR_CODES.internal,
          err instanceof Error ? err.message : "Internal server error"
        )
      );
    }
  }

  const headers = { "Mcp-Protocol-Version": negotiated.version };

  // Every message was a notification: acknowledge with 202 and no body.
  if (responses.length === 0) {
    return new NextResponse(null, { status: 202, headers: { ...CORS_HEADERS, ...headers } });
  }

  return json(Array.isArray(body) ? responses : responses[0], { headers });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * This server is stateless: it never opens a server-to-client SSE stream and
 * has no sessions to terminate, so the optional GET/DELETE parts of the
 * Streamable HTTP transport are explicitly unsupported.
 */
export async function GET() {
  return json(
    rpcError(
      null,
      ERROR_CODES.invalidRequest,
      "This MCP server is stateless: send JSON-RPC requests with POST."
    ),
    { status: 405, headers: { Allow: "POST, OPTIONS" } }
  );
}

export async function DELETE() {
  return json(rpcError(null, ERROR_CODES.invalidRequest, "No sessions to terminate."), {
    status: 405,
    headers: { Allow: "POST, OPTIONS" },
  });
}
