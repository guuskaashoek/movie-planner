
import { db } from "../lib/db/client";
import { films } from "../lib/db/schema";

async function main() {
    const allFilms = await db.select().from(films);
    console.log(`Total films: ${allFilms.length}`);

    // Check date distribution
    const withDate = allFilms.filter(f => f.date);
    const withoutDate = allFilms.filter(f => !f.date);

    console.log(`With date: ${withDate.length}`);
    console.log(`Without date: ${withoutDate.length}`);

    // Sort them as the API does
    allFilms.sort((a, b) => {
        if (a.date === b.date) return 0;
        if (a.date === null) return -1; // TypeScript treats null < string? No, standard JS sort behavior for null is tricky.
        if (b.date === null) return 1;
        return a.date > b.date ? 1 : -1;
    });

    // Note: JS sort isn't exactly SQLite sort.
    // In SQLite: NULLs are smallest.

    console.log("--- First 10 Films (SQLite simulation) ---");
    // Sort manually to match SQLite (NULL first, then ASC strings)
    const simulatedSort = [...allFilms].sort((a, b) => {
        if (a.date === b.date) return 0;
        if (a.date === null) return -1;
        if (b.date === null) return 1;
        return a.date!.localeCompare(b.date!);
    });

    simulatedSort.slice(0, 10).forEach(f => {
        console.log(`[${f.id}] ${f.title} - Date: ${f.date}`);
    });

    console.log("--- Last 10 Films (SQLite simulation) ---");
    simulatedSort.slice(-10).forEach(f => {
        console.log(`[${f.id}] ${f.title} - Date: ${f.date}`);
    });
}

main();
