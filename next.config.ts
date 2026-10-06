import type { NextConfig } from "next";
import os from "node:os";
// `npm run dev:lan` serves colleagues on the local network. The dev server
// only accepts loopback and this machine's own private IPv4 addresses as extra origins.
const lanAddresses = Object.values(os.networkInterfaces())
  .flat()
  .filter(
    (a) =>
      a?.family === "IPv4" &&
      !a.internal &&
      /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address),
  )
  .map((a) => a!.address);
const config: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  poweredByHeader: false,
  // When bound to 0.0.0.0, Next treats loopback hosts as cross-origin too.
  allowedDevOrigins: ["127.0.0.1", "localhost", ...lanAddresses],
};
export default config;
