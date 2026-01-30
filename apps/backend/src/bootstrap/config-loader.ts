import dotenv from "dotenv";

export async function loadConfig() {
  dotenv.config();
  console.log("⚙️ Config loaded");
}
