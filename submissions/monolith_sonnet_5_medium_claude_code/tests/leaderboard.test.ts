import { describe, expect, it } from "vitest";
import { validateName, validateScore } from "../src/leaderboard";

describe("validateName", () => {
  it("accepts a normal 1-16 char name", () => {
    expect(validateName("Ace")).toBeNull();
    expect(validateName("A")).toBeNull();
    expect(validateName("Sixteen_Chars-99")).toBeNull();
  });

  it("rejects empty name", () => {
    expect(validateName("")).not.toBeNull();
    expect(validateName("   ")).not.toBeNull();
  });

  it("rejects names longer than 16 characters", () => {
    expect(validateName("ThisNameIsWayTooLong")).not.toBeNull();
  });

  it("rejects disallowed characters", () => {
    expect(validateName("<script>")).not.toBeNull();
    expect(validateName("bad;drop table")).not.toBeNull();
  });

  it("allows spaces, hyphens and underscores", () => {
    expect(validateName("Jet Pilot")).toBeNull();
    expect(validateName("neo-n_ace")).toBeNull();
  });
});

describe("validateScore", () => {
  it("accepts non-negative integers", () => {
    expect(validateScore(0)).toBeNull();
    expect(validateScore(9999)).toBeNull();
  });

  it("rejects negative numbers", () => {
    expect(validateScore(-1)).not.toBeNull();
  });

  it("rejects non-integers", () => {
    expect(validateScore(1.5)).not.toBeNull();
    expect(validateScore(NaN)).not.toBeNull();
  });
});
