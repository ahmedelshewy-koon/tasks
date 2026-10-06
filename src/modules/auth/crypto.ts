import { EncryptJWT, jwtDecrypt } from "jose";
import { createHash } from "node:crypto";
import { z } from "zod";
const sessionData = z.object({
  token: z.string().min(1),
  mode: z.enum(["hr", "development"]),
});
type SessionData = z.infer<typeof sessionData>;
function key(secret: string) {
  if (secret.length < 32)
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  return createHash("sha256").update(secret).digest();
}
export async function sealSession(data: SessionData, secret: string) {
  return new EncryptJWT(data)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setIssuer("sana-task")
    .setAudience("sana-task")
    .setExpirationTime("8h")
    .encrypt(key(secret));
}
export async function openSession(
  value: string,
  secret: string,
): Promise<SessionData> {
  const { payload } = await jwtDecrypt(value, key(secret), {
    issuer: "sana-task",
    audience: "sana-task",
  });
  return sessionData.parse(payload);
}
