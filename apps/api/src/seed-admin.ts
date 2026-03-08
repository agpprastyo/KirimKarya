import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

async function seedAdmin() {
    const { db, user: userTable } = await import("@kirimkarya/db");
    const { eq } = await import("drizzle-orm");
    const { auth } = await import("./auth");
    const { parseArgs } = await import("util");

    if (!process.env.DATABASE_URL) {
        console.error("❌ DATABASE_URL is not defined in environment.");
        process.exit(1);
    }
    console.log(`DATABASE_URL: ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ":****@")}`);

    const { values } = parseArgs({
        options: {
            email: { type: "string" },
            password: { type: "string" },
            name: { type: "string" },
        },
    });

    const email = values.email || "admin@kirimkarya.com";
    const password = values.password || "admin123456";
    const name = values.name || "System Admin";

    console.log(`Seeding admin user: ${email}...`);

    try {
        // Check if user already exists
        let userId: string;
        const [existingUser] = await db.select().from(userTable).where(eq(userTable.email, email));

        if (existingUser) {
            console.log("User already exists, updating role and verification...");
            userId = existingUser.id;
        } else {
            const result = await auth.api.signUpEmail({
                body: {
                    email,
                    password,
                    name,
                },
                headers: new Headers(),
            });

            if (!result) {
                console.error("Failed to create user.");
                return;
            }
            userId = result.user.id;
        }

        // Set role to admin and verify email directly in DB
        await db.update(userTable)
            .set({
                role: "admin",
                emailVerified: true
            })
            .where(eq(userTable.id, userId));

        console.log("✅ Admin user seeded/updated successfully!");
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);
        process.exit(0);
    } catch (error: any) {
        console.error("❌ Error seeding admin:");
        console.error(error);
        process.exit(1);
    }
}

seedAdmin();
