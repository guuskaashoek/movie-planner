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
    async jwt({ token, account, profile }) {
      console.log("JWT callback - token.email:", token.email, "account:", !!account, "profile:", !!profile);

      // On initial sign in, account and profile will be available
      if (account && profile) {
        const googleId = account.providerAccountId;
        console.log("JWT callback - initial sign in, googleId:", googleId);

        const existing = await db
          .select()
          .from(users)
          .where(eq(users.googleId, googleId))
          .limit(1);

        console.log("JWT callback - found user:", existing[0]?.id);

        if (existing[0]) {
          token.userId = existing[0].id;
          token.email = existing[0].email;
          token.name = existing[0].name;
          token.picture = existing[0].image;
        }
      } else if (token.email) {
        // On subsequent requests, look up by email
        // console.log("JWT callback - subsequent request, looking up by email:", token.email);

        const existing = await db
          .select()
          .from(users)
          .where(eq(users.email, token.email as string))
          .limit(1);

        // console.log("JWT callback - found user by email:", existing[0]?.id);

        if (existing[0]) {
          token.userId = existing[0].id;
          token.name = existing[0].name;
          token.picture = existing[0].image;
        }
      }

      // console.log("JWT callback - final token.userId:", token.userId);
      return token;
    },
    async session({ session, token }) {
      // console.log("Session callback - token.userId:", token.userId);

      if (session.user && token.userId) {
        // @ts-expect-error augment user with id
        session.user.id = token.userId as number;
        session.user.name = token.name;
        session.user.image = token.picture;
      }

      // console.log("Session callback - session.user.id:", session.user?.id);
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

