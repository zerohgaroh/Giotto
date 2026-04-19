import path from "node:path";
import { resetStaffSeedData, runStaffBackendSeed } from "../src/lib/staff-backend/seed";
import { replaceMenuFromLegacyArray } from "../src/lib/staff-backend/menu-import";

async function main() {
  if (process.argv.includes("--reset")) {
    await resetStaffSeedData();
    return;
  }

  if (process.argv.includes("--menu-from-array")) {
    const arrayArg = process.argv.find((arg) => arg.startsWith("--array-file="));
    const sourceFilePath = arrayArg ? arrayArg.slice("--array-file=".length) : "array.js";
    const result = await replaceMenuFromLegacyArray(path.resolve(process.cwd(), sourceFilePath));
    console.log(
      `[seed] Меню импортировано из ${result.sourceFilePath}: ${result.categoriesCount} категорий, ${result.dishesCount} блюд.`,
    );
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
