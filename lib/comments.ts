import { db } from "@/lib/db/client";
import { comments, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export type FilmComment = {
  id: number;
  body: string;
  createdAt: number;
  author: {
    id: number;
    name: string | null;
    email: string;
    image: string | null;
  };
};

export async function getComments(filmId: number): Promise<FilmComment[]> {
  const rows = await db
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      authorId: users.id,
      authorName: users.name,
      authorEmail: users.email,
      authorImage: users.image,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.filmId, filmId))
    .orderBy(desc(comments.createdAt));

  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    createdAt: Number(r.createdAt),
    author: {
      id: r.authorId,
      name: r.authorName,
      email: r.authorEmail,
      image: r.authorImage,
    },
  }));
}
