import * as fs from "fs";
import * as path from "path";
import { randomBytes } from "crypto";

const ROOT_DIR = path.resolve(__dirname, "..");
const ENV_FILES = [".env", ".env.production"];

function generateSecureSecret(): string {
    return randomBytes(32).toString("hex");
}

async function rotateSecrets() {
    console.log("🔐 Starting automated secrets rotation...");

    const newSecret = generateSecureSecret();
    let rotatedCount = 0;

    for (const file of ENV_FILES) {
        const filePath = path.join(ROOT_DIR, file);
        if (!fs.existsSync(filePath)) {
            continue;
        }

        console.log(`\n📄 Processing environment file: ${file}`);
        
        // 1. Create secure backup first
        const backupPath = `${filePath}.bak`;
        fs.copyFileSync(filePath, backupPath);
        console.log(`✔️ Created temporary backup: ${file}.bak`);

        // 2. Read and parse file content
        const content = fs.readFileSync(filePath, "utf-8");
        const lines = content.split(/\r?\n/);
        let currentSecretLineIdx = -1;
        let currentSecretValue = "";

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;
            const match = line.match(/^BETTER_AUTH_SECRET=(.*)$/);
            if (match) {
                currentSecretLineIdx = i;
                currentSecretValue = (match[1] || "").trim();
                break;
            }
        }

        if (currentSecretLineIdx === -1) {
            console.warn(`⚠️ BETTER_AUTH_SECRET not found in ${file}. Prepending to file...`);
            lines.unshift(`BETTER_AUTH_SECRET=${newSecret}`);
        } else {
            // Keep the previous key as a fallback (up to 2 keys in rotation)
            const previousPrimary = currentSecretValue.split(",")[0];
            const rotatedSecretVal = previousPrimary 
                ? `${newSecret},${previousPrimary}` 
                : newSecret;
            
            lines[currentSecretLineIdx] = `BETTER_AUTH_SECRET=${rotatedSecretVal}`;
            console.log(`🔄 Rotated BETTER_AUTH_SECRET in ${file}`);
            console.log(`   └─ New Primary: ${newSecret.substring(0, 8)}...`);
            if (previousPrimary) {
                console.log(`   └─ Fallback Key: ${previousPrimary.substring(0, 8)}...`);
            }
        }

        // 3. Write back to file safely
        fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
        rotatedCount++;
    }

    if (rotatedCount > 0) {
        console.log("\n✅ Secrets rotation completed successfully!");
        console.log("👉 Restart your development server or API process to hot-reload the new environment secrets.");
        process.exit(0);
    } else {
        console.error("❌ No environment files (.env or .env.production) were found in the workspace root.");
        process.exit(1);
    }
}

rotateSecrets();
