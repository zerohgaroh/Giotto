import { resetStaffSeedData, runStaffBackendSeed } from "../src/lib/staff-backend/seed";

async function main() {
  if (process.argv.includes("--reset")) {
    await resetStaffSeedData();
    return;
  }

  await runStaffBackendSeed();
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
