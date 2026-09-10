import assert from "node:assert/strict";
import { test } from "node:test";

const origin = process.env.HOME_QA_ORIGIN ?? "http://127.0.0.1:3105";

for (const { path, locale, direction, title } of [
  { path: "/", locale: "en", direction: "ltr", title: "Every request," },
  { path: "/fr", locale: "fr", direction: "ltr", title: "Chaque demande," },
  { path: "/ar", locale: "ar", direction: "rtl", title: "كل طلب،" }
]) {
  test(`${path} serves the selected language and document direction before JavaScript`, async () => {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, new RegExp(`<html[^>]*lang="${locale}"[^>]*dir="${direction}"`));
    assert.match(html, new RegExp(`<h1[^>]*>${title}`));
    assert.match(html, /hrefLang="fr"/i);
    assert.match(html, /hrefLang="ar"/i);
    assert.doesNotMatch(html, /Growth Control/);
  });
}

test("unsupported homepage locale returns not found rather than a wrong-language page", async () => {
  const response = await fetch(`${origin}/de`);
  assert.equal(response.status, 404);
});

for (const path of ["/dashboard", "/market-scout", "/serviceflow"]) {
  test(`existing internal route ${path} remains reachable`, async () => {
    assert.equal((await fetch(`${origin}${path}`)).status, 200);
  });
}
