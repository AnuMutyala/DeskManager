import { storage } from "../server/storage";

async function seed() {
  const existing = await storage.getUserByUsername("admin");
  if (existing) {
    console.log("Seed: admin user already exists — skipping seeding.");
    return;
  }

  console.log("Seeding database...");
  await storage.createUser({ username: "admin", password: "password", role: "admin" });
  await storage.createUser({ username: "employee", password: "password", role: "employee" });

  const seatLabels = [
    "T56", "T55", "T54", "T53", "T49", "T50", "T51", "T52",
    "T48", "T47", "T46", "T45", "T41", "T42", "T43", "T44",
    "T60", "T61", "T59", "T62", "T58", "T63", "T57", "T64",
    "S1", "S2", "S3", "S4"
  ];

  for (const label of seatLabels) {
    await storage.createSeat({
      label,
      type: label.startsWith("S") ? "standing" : "regular",
      tags: [],
      isBlocked: false
    });
  }

  console.log("Seeding complete.");
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
