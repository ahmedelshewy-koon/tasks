import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Login } from "../src/ui/login";
it("renders accessible HR login controls with password visibility and translated illustration", () => {
  const html = renderToStaticMarkup(
    <Login
      development={false}
      lang="ar"
      t={(s) => `translated:${s}`}
      onLanguage={() => {}}
    />,
  );
  expect(html).toContain('aria-label="translated:Show password"');
  expect(html).toContain('autoComplete="current-password"');
  expect(html).toContain("translated:Project workspace");
  expect(html).toContain("translated:Secure sign-in through Sanaa HR");
  expect(html).toContain("translated:Remember me on this device");
  expect(html).toContain("translated:Forgot password?");
  expect(html).toMatch(/aria-pressed="true"[^>]*>العربية</);
  expect(html).not.toContain("local-admin");
});
