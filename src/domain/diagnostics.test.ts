import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectDirectionBias,
  isLeechCard,
  isWeakCard,
} from "./diagnostics.js";

describe("diagnostics rules", () => {
  it("marks low success rate cards as weak", () => {
    assert.equal(isWeakCard({ attempts: 5, correct: 2, lapses: 0 }), true);
    assert.equal(isWeakCard({ attempts: 5, correct: 4, lapses: 0 }), false);
  });

  it("marks high-lapse cards as leeches", () => {
    assert.equal(isLeechCard({ attempts: 10, correct: 8, lapses: 6 }), true);
    assert.equal(isLeechCard({ attempts: 10, correct: 8, lapses: 2 }), false);
  });

  it("detects direction bias when enough samples exist", () => {
    const bias = detectDirectionBias({
      enToFa: { attempts: 10, correct: 9, lapses: 0 },
      faToEn: { attempts: 10, correct: 4, lapses: 0 },
    });
    assert.ok(bias);
    assert.equal(bias?.weaker, "fa_to_en");
  });

  it("ignores direction bias without enough samples", () => {
    const bias = detectDirectionBias({
      enToFa: { attempts: 2, correct: 2, lapses: 0 },
      faToEn: { attempts: 2, correct: 0, lapses: 0 },
    });
    assert.equal(bias, null);
  });
});
