import { type Actor } from "@/lib/authz";
import {
  ServiceError,
  addComment,
  createFilm,
  deleteComment,
  deleteFilm,
  getCalendarFeed,
  getFilm,
  getStats,
  listFilms,
  listUsers,
  rateFilm,
  setAttendance,
  setFilmPoster,
  setPoll,
  setUserRole,
  transferFilm,
  updateFilm,
  voteOnPoll,
} from "@/lib/films";

/**
 * Tool input schemas are written as plain JSON Schema rather than generated,
 * so they stay flat (no $ref / oneOf). Grok's tool parser is stricter than
 * most, and a flat schema is what every MCP client handles reliably.
 */
type JsonSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties: false;
};

export type ToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  /** Marks tools that only exist for admins; still enforced in the service layer. */
  adminOnly?: boolean;
  /** Hints for clients that render tool safety. */
  readOnly?: boolean;
  destructive?: boolean;
  handler: (actor: Actor, args: Record<string, unknown>) => Promise<unknown>;
};

// --- small typed readers for untrusted tool arguments -----------------------

function str(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  if (v == null) return undefined;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  throw new ServiceError(`${key} must be a string`, 400);
}

function reqStr(args: Record<string, unknown>, key: string): string {
  const v = str(args, key);
  if (v == null || v.trim() === "") throw new ServiceError(`${key} is required`, 400);
  return v;
}

/** Models sometimes send numbers as strings; accept both, reject nonsense. */
function num(args: Record<string, unknown>, key: string): number | undefined {
  const v = args[key];
  if (v == null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  if (!Number.isFinite(n)) throw new ServiceError(`${key} must be a number`, 400);
  return n;
}

function reqNum(args: Record<string, unknown>, key: string): number {
  const n = num(args, key);
  if (n == null) throw new ServiceError(`${key} is required`, 400);
  return n;
}

function bool(args: Record<string, unknown>, key: string): boolean | undefined {
  const v = args[key];
  if (v == null || v === "") return undefined;
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  throw new ServiceError(`${key} must be true or false`, 400);
}

/** Pull a key out only when the caller actually sent it (partial updates). */
function has(args: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(args, key);
}

function pollOptionsArg(args: Record<string, unknown>, key = "options") {
  const raw = args[key];
  if (raw == null) return undefined;
  if (!Array.isArray(raw)) throw new ServiceError(`${key} must be an array`, 400);
  return raw.map((entry, i) => {
    if (typeof entry !== "object" || entry === null) {
      throw new ServiceError(`${key}[${i}] must be an object`, 400);
    }
    const o = entry as Record<string, unknown>;
    return {
      id: num(o, "id"),
      date: reqStr(o, "date"),
      startTime: str(o, "startTime") ?? null,
      endTime: str(o, "endTime") ?? null,
    };
  });
}

// --- reusable schema fragments ---------------------------------------------

const filmIdProp = {
  filmId: { type: "integer", description: "Numeric id of the film." },
};

const dateProp = {
  type: "string",
  description: "Date formatted as YYYY-MM-DD.",
};

const timeProp = {
  type: "string",
  description: "Time of day in 24h HH:mm format, e.g. 20:30.",
};

const pollOptionsProp = {
  type: "array",
  description:
    "The proposed screening slots. Sending this list replaces the whole poll; omit an option to delete it (its votes go with it). Include an existing option's id to keep its votes.",
  items: {
    type: "object",
    properties: {
      id: {
        type: "integer",
        description: "Id of an existing option to keep. Omit for a new option.",
      },
      date: dateProp,
      startTime: timeProp,
      endTime: timeProp,
    },
    required: ["date"],
    additionalProperties: false,
  },
};

const ticketsProps = {
  ticketsOnSaleDate: {
    ...dateProp,
    description:
      "Date tickets go on sale (YYYY-MM-DD). Send an empty string to clear it.",
  },
  ticketsOnSaleTime: {
    ...timeProp,
    description: "Time tickets go on sale, 24h HH:mm. Only meaningful with a date.",
  },
  ticketsUrl: {
    type: "string",
    description: "Link to the ticket shop or booking page (http/https).",
  },
};

const asUserProp = {
  asUser: {
    type: "string",
    description:
      "Admin only: act on behalf of another user, by email or numeric id. Leave empty to act as yourself.",
  },
};

export const TOOLS: ToolDefinition[] = [
  {
    name: "whoami",
    title: "Who am I",
    description:
      "Show the account this connection is authenticated as, whether it has admin rights, and what those rights allow. Call this first when unsure what you are allowed to change.",
    readOnly: true,
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: async (actor) => ({
      userId: actor.userId,
      email: actor.email,
      name: actor.name,
      role: actor.role,
      isAdmin: actor.isAdmin,
      permissions: actor.isAdmin
        ? [
            "Create, edit and delete ANY user's film",
            "Edit any poll, comment, rating and attendance",
            "Act on behalf of other users via the asUser argument",
            "List users, change roles and transfer film ownership",
          ]
        : [
            "Create films",
            "Edit and delete only your own films",
            "Vote, attend, comment and rate as yourself",
          ],
    }),
  },
  {
    name: "list_films",
    title: "List films",
    description:
      "List films on the shared board with their dates, posters, attendees, polls and ratings. Use the query argument to search by title.",
    readOnly: true,
    inputSchema: {
      type: "object",
      properties: {
        scope: {
          type: "string",
          enum: ["all", "upcoming", "past", "mine"],
          description:
            "Which films to return. 'upcoming' also includes films without a date yet. Defaults to 'upcoming'.",
        },
        query: { type: "string", description: "Search text matched against title and description." },
        owner: {
          type: "string",
          description: "Only films created by this user (email or numeric id).",
        },
        limit: { type: "integer", description: "How many films to return (1-100, default 25)." },
        offset: { type: "integer", description: "Skip this many films, for paging." },
      },
      additionalProperties: false,
    },
    handler: (actor, args) =>
      listFilms(actor, {
        scope: (str(args, "scope") as "all" | "upcoming" | "past" | "mine") ?? "upcoming",
        query: str(args, "query") ?? null,
        owner: str(args, "owner") ?? null,
        limit: num(args, "limit"),
        offset: num(args, "offset"),
      }),
  },
  {
    name: "get_film",
    title: "Get film",
    description:
      "Full detail for one film: description, schedule, poster, poll results, attendees, ratings and comments.",
    readOnly: true,
    inputSchema: {
      type: "object",
      properties: { ...filmIdProp },
      required: ["filmId"],
      additionalProperties: false,
    },
    handler: (actor, args) => getFilm(actor, reqNum(args, "filmId")),
  },
  {
    name: "create_film",
    title: "Create film",
    description:
      "Add a film to the board. Pass posterUrl with any public image link (JPEG, PNG, WebP or AVIF) and the server downloads it and re-hosts it, so the poster keeps working. Add pollOptions instead of a fixed date to let people vote on a screening slot, and ticketsOnSaleDate/ticketsOnSaleTime to record when tickets are released.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Film title. Required." },
        description: { type: "string", description: "Short synopsis or note." },
        date: { ...dateProp, description: "Screening date (YYYY-MM-DD). Leave empty when using a poll." },
        releaseDate: { ...dateProp, description: "Cinema release date (YYYY-MM-DD)." },
        startTime: timeProp,
        endTime: timeProp,
        formats: {
          type: "string",
          description: "Comma separated formats, e.g. 'IMAX,3D'.",
        },
        ...ticketsProps,
        posterUrl: {
          type: "string",
          description:
            "Direct link to a poster image. It is downloaded and stored on our own storage; the link may expire afterwards without breaking the board.",
        },
        allowMultiVote: {
          type: "boolean",
          description: "Let each voter pick more than one poll option.",
        },
        pollOptions: pollOptionsProp,
        owner: {
          type: "string",
          description:
            "Admin only: create this film on behalf of another user (email or numeric id).",
        },
      },
      required: ["title"],
      additionalProperties: false,
    },
    handler: (actor, args) =>
      createFilm(actor, {
        title: reqStr(args, "title"),
        description: str(args, "description") ?? null,
        date: str(args, "date") ?? null,
        releaseDate: str(args, "releaseDate") ?? null,
        startTime: str(args, "startTime") ?? null,
        endTime: str(args, "endTime") ?? null,
        formats: str(args, "formats") ?? null,
        ticketsOnSaleDate: str(args, "ticketsOnSaleDate") ?? null,
        ticketsOnSaleTime: str(args, "ticketsOnSaleTime") ?? null,
        ticketsUrl: str(args, "ticketsUrl") ?? null,
        posterUrl: str(args, "posterUrl") ?? null,
        allowMultiVote: bool(args, "allowMultiVote") ?? false,
        pollOptions: pollOptionsArg(args, "pollOptions"),
        ownerRef: str(args, "owner") ?? null,
      }),
  },
  {
    name: "update_film",
    title: "Update film",
    description:
      "Change fields of an existing film. Only the fields you send are touched; send an empty string to clear an optional field. Admins can update any film, everyone else only their own.",
    inputSchema: {
      type: "object",
      properties: {
        ...filmIdProp,
        title: { type: "string" },
        description: { type: "string" },
        date: dateProp,
        releaseDate: dateProp,
        startTime: timeProp,
        endTime: timeProp,
        formats: { type: "string", description: "Comma separated formats, e.g. 'IMAX,3D'." },
        ...ticketsProps,
        posterUrl: {
          type: "string",
          description:
            "New poster image link; it is downloaded and re-hosted. Empty string removes the poster.",
        },
        allowMultiVote: { type: "boolean" },
      },
      required: ["filmId"],
      additionalProperties: false,
    },
    handler: (actor, args) => {
      const patch: Record<string, unknown> = {};
      for (const key of [
        "title",
        "description",
        "date",
        "releaseDate",
        "startTime",
        "endTime",
        "formats",
        "ticketsOnSaleDate",
        "ticketsOnSaleTime",
        "ticketsUrl",
        "posterUrl",
      ]) {
        if (has(args, key)) patch[key] = str(args, key) ?? null;
      }
      if (has(args, "allowMultiVote")) patch.allowMultiVote = bool(args, "allowMultiVote");
      return updateFilm(actor, reqNum(args, "filmId"), patch);
    },
  },
  {
    name: "set_tickets_on_sale",
    title: "Set ticket sale moment",
    description:
      "Record when tickets for a film go on sale, so everyone can put it in their calendar. Pass a date with an optional time and booking link, or set clear to true to remove it again.",
    inputSchema: {
      type: "object",
      properties: {
        ...filmIdProp,
        date: { ...dateProp, description: "Date tickets go on sale (YYYY-MM-DD)." },
        time: { ...timeProp, description: "Time tickets go on sale, 24h HH:mm. Optional." },
        ticketsUrl: {
          type: "string",
          description: "Link to the ticket shop or booking page. Optional.",
        },
        clear: {
          type: "boolean",
          description: "Set to true to remove the ticket sale moment entirely.",
        },
      },
      required: ["filmId"],
      additionalProperties: false,
    },
    handler: (actor, args) => {
      const clear = bool(args, "clear") ?? false;
      if (clear) {
        return updateFilm(actor, reqNum(args, "filmId"), {
          ticketsOnSaleDate: null,
          ticketsOnSaleTime: null,
          ticketsUrl: null,
        });
      }
      const patch: Record<string, unknown> = {};
      if (has(args, "date")) patch.ticketsOnSaleDate = str(args, "date") ?? null;
      if (has(args, "time")) patch.ticketsOnSaleTime = str(args, "time") ?? null;
      if (has(args, "ticketsUrl")) patch.ticketsUrl = str(args, "ticketsUrl") ?? null;
      if (Object.keys(patch).length === 0) {
        throw new ServiceError(
          "Pass a date (and optionally a time or ticketsUrl), or clear: true",
          400
        );
      }
      return updateFilm(actor, reqNum(args, "filmId"), patch);
    },
  },
  {
    name: "set_film_poster",
    title: "Set film poster",
    description:
      "Give a film a poster from any public image URL. The image is downloaded, checked (JPEG, PNG, WebP or AVIF) and stored on our own storage.",
    inputSchema: {
      type: "object",
      properties: {
        ...filmIdProp,
        imageUrl: {
          type: "string",
          description: "Direct link to the image file itself, not to a web page showing it.",
        },
      },
      required: ["filmId", "imageUrl"],
      additionalProperties: false,
    },
    handler: (actor, args) =>
      setFilmPoster(actor, reqNum(args, "filmId"), reqStr(args, "imageUrl")),
  },
  {
    name: "delete_film",
    title: "Delete film",
    description:
      "Permanently delete a film with its poll, comments, ratings and attendance. Admins can delete any film.",
    destructive: true,
    inputSchema: {
      type: "object",
      properties: { ...filmIdProp },
      required: ["filmId"],
      additionalProperties: false,
    },
    handler: (actor, args) => deleteFilm(actor, reqNum(args, "filmId")),
  },
  {
    name: "set_poll",
    title: "Set screening poll",
    description:
      "Replace the date poll of a film with the given options. Pass an empty options array to remove the poll entirely.",
    inputSchema: {
      type: "object",
      properties: {
        ...filmIdProp,
        allowMultiVote: {
          type: "boolean",
          description: "Let each voter pick more than one option. Defaults to false.",
        },
        options: pollOptionsProp,
      },
      required: ["filmId", "options"],
      additionalProperties: false,
    },
    handler: (actor, args) =>
      setPoll(actor, reqNum(args, "filmId"), {
        allowMultiVote: bool(args, "allowMultiVote") ?? false,
        options: pollOptionsArg(args, "options") ?? [],
      }),
  },
  {
    name: "vote_poll",
    title: "Vote on a poll",
    description:
      "Cast or withdraw a vote for one screening slot. In a single-choice poll a new vote replaces the previous one.",
    inputSchema: {
      type: "object",
      properties: {
        ...filmIdProp,
        optionId: { type: "integer", description: "Id of the poll option, from get_film." },
        remove: {
          type: "boolean",
          description: "Set to true to withdraw the vote instead of casting it.",
        },
        ...asUserProp,
      },
      required: ["filmId", "optionId"],
      additionalProperties: false,
    },
    handler: (actor, args) =>
      voteOnPoll(actor, reqNum(args, "filmId"), reqNum(args, "optionId"), {
        remove: bool(args, "remove") ?? false,
        asUserRef: str(args, "asUser") ?? null,
      }),
  },
  {
    name: "set_attendance",
    title: "Set attendance",
    description:
      "Mark yourself (or, as admin, someone else) as going to or interested in a film, or remove that mark.",
    inputSchema: {
      type: "object",
      properties: {
        ...filmIdProp,
        status: {
          type: "string",
          enum: ["going", "interested"],
          description: "Which list to change. Defaults to 'going'.",
        },
        attending: {
          type: "boolean",
          description: "true to join the list, false to leave it. Defaults to true.",
        },
        ...asUserProp,
      },
      required: ["filmId"],
      additionalProperties: false,
    },
    handler: (actor, args) =>
      setAttendance(actor, reqNum(args, "filmId"), {
        type: (str(args, "status") as "going" | "interested") ?? "going",
        attending: bool(args, "attending") ?? true,
        asUserRef: str(args, "asUser") ?? null,
      }),
  },
  {
    name: "add_comment",
    title: "Add comment",
    description: "Post a comment on a film's discussion thread (max 2000 characters).",
    inputSchema: {
      type: "object",
      properties: {
        ...filmIdProp,
        body: { type: "string", description: "The comment text." },
      },
      required: ["filmId", "body"],
      additionalProperties: false,
    },
    handler: (actor, args) => addComment(actor, reqNum(args, "filmId"), reqStr(args, "body")),
  },
  {
    name: "delete_comment",
    title: "Delete comment",
    description:
      "Remove a comment. Allowed for its author, the film's creator, and admins (who can remove any comment).",
    destructive: true,
    inputSchema: {
      type: "object",
      properties: {
        ...filmIdProp,
        commentId: { type: "integer", description: "Id of the comment, from get_film." },
      },
      required: ["filmId", "commentId"],
      additionalProperties: false,
    },
    handler: (actor, args) =>
      deleteComment(actor, reqNum(args, "filmId"), reqNum(args, "commentId")),
  },
  {
    name: "rate_film",
    title: "Rate film",
    description:
      "Give a film 1 to 5 stars. Normally only attendees can rate, and only after the screening has ended; admins may rate at any time and on behalf of others.",
    inputSchema: {
      type: "object",
      properties: {
        ...filmIdProp,
        rating: { type: "integer", description: "Whole number from 1 to 5." },
        ...asUserProp,
      },
      required: ["filmId", "rating"],
      additionalProperties: false,
    },
    handler: (actor, args) =>
      rateFilm(actor, reqNum(args, "filmId"), reqNum(args, "rating"), {
        asUserRef: str(args, "asUser") ?? null,
      }),
  },
  {
    name: "get_calendar_url",
    title: "Get calendar subscription URL",
    description:
      "Return the personal .ics subscription link for this account, plus the board URL. Safe to share with the account owner.",
    readOnly: true,
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: (actor) => getCalendarFeed(actor),
  },
  {
    name: "list_users",
    title: "List users (admin)",
    description:
      "Admin only. List every account with its role and how many films it owns. Use it to find the user id or email needed by other admin arguments.",
    adminOnly: true,
    readOnly: true,
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: (actor) => listUsers(actor),
  },
  {
    name: "set_user_role",
    title: "Change a user's role (admin)",
    description:
      "Admin only. Promote a user to admin or demote them back to a normal user.",
    adminOnly: true,
    inputSchema: {
      type: "object",
      properties: {
        user: { type: "string", description: "Email or numeric id of the user to change." },
        role: { type: "string", enum: ["user", "admin"], description: "The new role." },
      },
      required: ["user", "role"],
      additionalProperties: false,
    },
    handler: (actor, args) =>
      setUserRole(actor, reqStr(args, "user"), reqStr(args, "role") as "user" | "admin"),
  },
  {
    name: "transfer_film",
    title: "Transfer film ownership (admin)",
    description: "Admin only. Move a film to a different owner.",
    adminOnly: true,
    inputSchema: {
      type: "object",
      properties: {
        ...filmIdProp,
        owner: { type: "string", description: "Email or numeric id of the new owner." },
      },
      required: ["filmId", "owner"],
      additionalProperties: false,
    },
    handler: (actor, args) =>
      transferFilm(actor, reqNum(args, "filmId"), reqStr(args, "owner")),
  },
  {
    name: "get_stats",
    title: "Board statistics (admin)",
    description:
      "Admin only. Totals for films, users, comments, votes and ratings, plus how many films each user owns.",
    adminOnly: true,
    readOnly: true,
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: (actor) => getStats(actor),
  },
];

/** Admin-only tools are hidden from non-admins so the model never offers them. */
export function toolsFor(actor: Actor): ToolDefinition[] {
  return TOOLS.filter((tool) => !tool.adminOnly || actor.isAdmin);
}

export function findTool(name: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.name === name);
}
