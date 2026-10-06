import { cookies } from "next/headers";
import { isDevelopment } from "@/modules/hr/adapter";
import { openSession } from "@/modules/auth/crypto";
import { TaskApp } from "@/ui/app";
export const dynamic = "force-dynamic";
export default async function Page() {
  const cookie = (await cookies()).get("task_session")?.value;
  let signedIn = false;
  if (cookie)
    try {
      const session = await openSession(
        cookie,
        process.env.SESSION_SECRET || "",
      );
      signedIn = session.mode === (isDevelopment() ? "development" : "hr");
    } catch {}
  return <TaskApp signedIn={signedIn} development={isDevelopment()} />;
}
