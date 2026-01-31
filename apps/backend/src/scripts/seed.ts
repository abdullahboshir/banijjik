import { bootstrapDatabase } from "../bootstrap/database.bootstrap";
import { runAllSeeders } from "../domains/core/iam/infrastructure/persistence/mongoose/seeds/run.seeder";
import mongoose from "mongoose";

/**
 * CLI Entry point for seeding
 */
async function main() {
  console.log("🚀 Starting Seeder Script...");

  try {
    // 1. Connect to Database (using existing bootstrap)
    await bootstrapDatabase();

    // 2. Run Main Seeder
    await runAllSeeders();

    console.log("✅ Database seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding script failed:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

main();
