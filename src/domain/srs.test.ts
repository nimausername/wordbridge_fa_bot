import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AGAIN_DELAY_MS_FOR_TESTS,
  LEARNING_STEPS_MS_FOR_TESTS,
  applySrsGrade,
  createLearningCardSchedule,
} from "./srs.js";

describe("SRS", () => {
  it("creates new cards due immediately", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const card = createLearningCardSchedule(now);
    assert.equal(card.state, "learning");
    assert.equal(card.learningStep, 0);
    assert.equal(card.dueAt.getTime(), now.getTime());
  });

  it("schedules Again to resurface quickly", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const card = createLearningCardSchedule(now);
    const updated = applySrsGrade(card, "again", now);
    assert.equal(updated.correct, false);
    assert.equal(updated.learningStep, 0);
    assert.equal(updated.lapses, 1);
    assert.equal(updated.dueAt.getTime(), now.getTime() + AGAIN_DELAY_MS_FOR_TESTS);
  });

  it("advances learning steps on Good then graduates", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    let card = createLearningCardSchedule(now);

    card = applySrsGrade(card, "good", now);
    assert.equal(card.state, "learning");
    assert.equal(card.learningStep, 1);
    assert.equal(card.dueAt.getTime(), now.getTime() + LEARNING_STEPS_MS_FOR_TESTS[1]!);

    const later = card.dueAt;
    card = applySrsGrade(card, "good", later);
    assert.equal(card.state, "review");
    assert.ok(card.dueAt.getTime() > later.getTime());
  });

  it("Easy graduates learning cards immediately", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const card = createLearningCardSchedule(now);
    const updated = applySrsGrade(card, "easy", now);
    assert.equal(updated.state, "review");
    assert.equal(updated.correct, true);
  });
});
