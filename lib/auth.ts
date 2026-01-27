import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const {
  auth,
  handlers: { GET, POST },
  signIn,
  signOut,
} = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ profile, account }) {
      if (!profile?.email || !account?.providerAccountId) return false;

      const email = profile.email;
      const googleId = account.providerAccountId;
      const name = (profile.name as string) ?? null;
      const image = (profile.picture as string) ?? null;

      const existing = await db
        .select()
        .from(users)
        .where(eq(users.googleId, googleId));

      if (existing.length === 0) {
        await db.insert(users).values({
          email,
          googleId,
          name,
          image,
        });
      }

      return true;
    },
    async jwt({ token }) {
      if (!token.sub) return token;

      const existing = await db
        .select()
        .from(users)
        .where(eq(users.googleId, token.sub))
        .limit(1);

      if (existing[0]) {
        token.userId = existing[0].id;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        // @ts-expect-error augment user with id
        session.user.id = token.userId as number;
      }
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;

      // Public routes
      if (pathname === "/" || pathname === "/api/calendar/feed.ics") {
        return true;
      }

      return !!auth;
    },
  },
});

