import { storage } from "../server/storage";
import { promises as fs } from "fs";

async function seed() {
  console.log("Seeding database...");

  // Seed users
  const existingAdmin = await storage.getUserByUsername("admin");
  if (!existingAdmin) {
    await storage.createUser({
      username: "admin",
      password: "password",
      role: "admin",
    });
    console.log("Created admin user");
  } else {
    console.log("Admin user already exists - skipping user creation");
  }

  const existingEmployee = await storage.getUserByUsername("employee");
  if (!existingEmployee) {
    await storage.createUser({
      username: "employee",
      password: "password",
      role: "employee",
    });
    console.log("Created employee user");
  } else {
    console.log("Employee user already exists - skipping user creation");
  }

  // Seed seats from server/defaultLayout.json (labels + x/y expected)
  try {
    const raw = await fs.readFile(new URL('../server/defaultLayout.json', import.meta.url));
    const data = JSON.parse(raw.toString());
    if (!Array.isArray(data) || data.length === 0) {
      console.log('defaultLayout.json is empty or invalid — no seats to seed.');
      return;
    }

    console.log(`Creating ${data.length} seats from defaultLayout.json...`);
    let created = 0;
    let skipped = 0;

    for (const entry of data) {
      if (!entry || typeof entry.label !== 'string') {
        // skip entries without a label
        continue;
      }
      const label = entry.label;
      const type = label.startsWith("S") ? "STANDING" : "REGULAR";
      const x = typeof entry.x === 'number' ? Math.round(entry.x) : 0;
      const y = typeof entry.y === 'number' ? Math.round(entry.y) : 0;

      try {
        await storage.createSeat({ label, type, x, y, tags: [], isBlocked: false } as any);
        created++;
      } catch (err: any) {
        if (err.code === '23505') {
          skipped++;
        } else {
          throw err;
        }
      }
    }

    console.log(`Seeding complete. Created ${created} seats, skipped ${skipped} existing seats.`);
  } catch (err) {
    console.error('Failed to read defaultLayout.json or seed seats:', err);
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
