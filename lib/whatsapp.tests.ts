import assert from "node:assert/strict";
import { sendWhatsApp, frDate, frTime, clean } from "./whatsapp";

async function main() {
  delete process.env.WHATSAPP_TOKEN;
  delete process.env.WHATSAPP_PHONE_ID;

  const r = await sendWhatsApp("rdv_rappel_3h", "+237677123456", [
    "Aminata",
    "Salon\n  Chez Moi",
    "14:30",
  ]);
  assert.equal(r.ok, true);
  assert.equal(r.simulated, true);

  const d = new Date("2026-10-20T13:30:00Z"); // 14:30 à Douala
  assert.equal(frTime(d), "14:30");
  assert.match(frDate(d), /mardi 20 octobre/);
  assert.equal(clean("a\n  b\tc"), "a b c");

  console.log("whatsapp : 3 tests OK");
}

main();