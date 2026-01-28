import { storage } from "../server/storage";

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

  // Always seed seats
  const seatLabels = [
    "T56",
    "T55",
    "T54",
    "T53",
    "T49",
    "T50",
    "T51",
    "T52",
    "T48",
    "T47",
    "T46",
    "T45",
    "T41",
    "T42",
    "T43",
    "T44",
    "T60",
    "T61",
    "T59",
    "T62",
    "T58",
    "T63",
    "T57",
    "T64",
    "T68",
    "T69",
    "T67",
    "T70",
    "T66",
    "T71",
    "T65",
    "T72",
    "T76",
    "T77",
    "T75",
    "T78",
    "T74",
    "T79",
    "T73",
    "T80",
    "T8",
    "T9",
    "T7",
    "T10",
    "T6",
    "T11",
    "T5",
    "T12",
    "T16",
    "T17",
    "T15",
    "T18",
    "T14",
    "T19",
    "T13",
    "T20",
    "T40",
    "T39",
    "T38",
    "T37",
    "T36",
    "T31",
    "T32",
    "T33",
    "T34",
    "T35",
    "T30",
    "T29",
    "T28",
    "T27",
    "T26",
    "T21",
    "T22",
    "T23",
    "T24",
    "T25",
    "S1",
    "S2",
    "S3",
    "S4",
  ];

  console.log(`Creating ${seatLabels.length} seats...`);
  let created = 0;
  let skipped = 0;

  for (const label of seatLabels) {
    try {
      await storage.createSeat({
        label,
        type: label.startsWith("S") ? "standing" : "regular",
        tags: [],
        isBlocked: false,
      });
      created++;
    } catch (err: any) {
      // Seat likely already exists (unique constraint violation)
      if (err.code === "23505") {
        skipped++;
      } else {
        throw err;
      }
    }
  }

  console.log(
    `Seeding complete. Created ${created} seats, skipped ${skipped} existing seats.`,
  );
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
