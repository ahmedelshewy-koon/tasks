import { expect, it } from "vitest";
import { sealSession, openSession } from "../src/modules/auth/crypto";
import { developmentAllowed } from "../src/modules/hr/adapter";
it("encrypts credentials and rejects altered sessions", async () => {
  const key = "12345678901234567890123456789012";
  const token = await sealSession(
    { token: "sensitive-hr-token", mode: "hr" },
    key,
  );
  expect(token).not.toContain("sensitive-hr-token");
  expect((await openSession(token, key)).token).toBe("sensitive-hr-token");
  await expect(
    openSession(token.slice(0, -8) + "tampered", key),
  ).rejects.toThrow();
  await expect(
    openSession(token, "different-key-123456789012345678901"),
  ).rejects.toThrow();
});
it("never enables development identities in production", () => {
  expect(developmentAllowed("production", "development")).toBe(false);
  expect(developmentAllowed("development", "development")).toBe(true);
  expect(developmentAllowed("development", undefined)).toBe(false);
});
