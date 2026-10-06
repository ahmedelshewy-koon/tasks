import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
try {
  await writeFile(
    ".env.local",
    `TASK_AUTH_MODE=development\nSESSION_SECRET=${randomBytes(32).toString("hex")}\n`,
    { flag: "wx" },
  );
  console.log("Created local development configuration. Run npm run dev.");
} catch (error) {
  if (error.code === "EEXIST")
    console.log(".env.local already exists; kept your configuration.");
  else throw error;
}
