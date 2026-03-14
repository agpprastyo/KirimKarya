async function seedTestUser() {
    console.log("Importing @kirimkarya/db...");
    const { db, user: userTable } = await import("@kirimkarya/db");
    console.log("Importing drizzle-orm...");
    const { eq } = await import("drizzle-orm");
    console.log("Importing auth config...");
    const { auth } = await import("/home/agprastyo/Developments/KirimKarya/apps/api/src/modules/auth/auth.config.ts");

    const testEmail = "test@example.com";
    const testPassword = "Password123!";
    const testName = "Test Studio";

    console.log("Seeding test user...");

    try {
        let userId: string;
        const [existingUser] = await db.select().from(userTable).where(eq(userTable.email, testEmail));

        if (existingUser) {
            console.log("User already exists, resetting verification...");
            userId = existingUser.id;
        } else {
            console.log("Creating new test user via Auth API...");
            const result = await auth.api.signUpEmail({
                body: {
                    email: testEmail,
                    password: testPassword,
                    name: testName,
                },
                headers: new Headers(),
            });

            if (!result) {
                console.error("Failed to create user.");
                return;
            }
            userId = result.user.id;
        }

        // Verify email directly in DB
        await db.update(userTable)
            .set({
                emailVerified: true
            })
            .where(eq(userTable.id, userId));

        console.log("✅ Test user seeded successfully!");
        process.exit(0);
    } catch (error) {
        console.error("Failed to seed test user:", error);
        process.exit(1);
    }
}

seedTestUser();
