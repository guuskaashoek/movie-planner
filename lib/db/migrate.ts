import { db } from "./client";
import { films, attendees, boardSettings, users } from "./schema";
import { eq, sql } from "drizzle-orm";
import { randomBytes } from "crypto";

/**
 * Migration script to transform existing data to new collaborative schema
 * 
 * Steps:
 * 1. For each existing film, create an attendee record for the creator
 * 2. For each user, create board settings with unique icsShareId
 */
export async function migrateToCollaborativeSchema() {
    console.log("🔄 Starting migration to collaborative schema...");

    try {
        // Get all existing films
        const existingFilms = await db.select().from(films);
        console.log(`  → Found ${existingFilms.length} films to migrate`);

        // For each film, create attendee record for the creator
        for (const film of existingFilms) {
            // @ts-ignore - createdBy exists in new schema
            const creatorId = film.createdBy;

            // Check if attendee record already exists
            const existing = await db
                .select()
                .from(attendees)
                .where(
                    sql`${attendees.filmId} = ${film.id} AND ${attendees.userId} = ${creatorId}`
                );

            if (existing.length === 0) {
                await db.insert(attendees).values({
                    filmId: film.id,
                    userId: creatorId,
                });
                console.log(`  ✓ Created attendee for film "${film.title}"`);
            }
        }

        // Get all users
        const allUsers = await db.select().from(users);
        console.log(`  → Found ${allUsers.length} users`);

        // For each user, create board settings if they don't exist
        for (const user of allUsers) {
            const existing = await db
                .select()
                .from(boardSettings)
                .where(eq(boardSettings.userId, user.id));

            if (existing.length === 0) {
                const icsShareId = randomBytes(16).toString("hex");
                await db.insert(boardSettings).values({
                    userId: user.id,
                    name: `${user.name || user.email}'s Calendar`,
                    icsShareId,
                });
                console.log(`  ✓ Created board settings for ${user.email}`);
            }
        }

        console.log("✅ Migration completed successfully!");
    } catch (error) {
        console.error("❌ Migration failed:", error);
        throw error;
    }
}

// Run migration if called directly
if (require.main === module) {
    migrateToCollaborativeSchema()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}
