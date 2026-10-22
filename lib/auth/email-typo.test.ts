import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ADMIN_EMAILS } from "../admin/gate";
import { emailTypoHint } from "./email-typo";

describe("login email typo hint", () => {
  it("suggests a near-miss domain and a known admin address, and stays quiet when the address is fine", () => {
    assert.equal(emailTypoHint("alex.example@gmial.com"), "alex.example@gmail.com");
    assert.equal(emailTypoHint("alex.example@gmail.con"), "alex.example@gmail.com");
    assert.equal(emailTypoHint("n.adams3@icloud.co"), "n.adams3@icloud.com");
    assert.equal(emailTypoHint("nick@back2strong.com"), "nick@back2strong.online");
    assert.equal(emailTypoHint("nick@back2strong.onlin"), "nick@back2strong.online");
    assert.equal(emailTypoHint("nicosmada3@googlemail.co"), "nicosmada3@googlemail.com");
    assert.equal(emailTypoHint("nick@back2strong.online"), null);
    assert.equal(emailTypoHint("alex.example@gmail.com"), null);
    assert.equal(emailTypoHint("not-an-email"), null);
    assert.equal(emailTypoHint(""), null);
    for (const admin of ADMIN_EMAILS) assert.equal(emailTypoHint(admin), null);
  });
});
