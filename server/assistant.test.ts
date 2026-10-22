import { describe, expect, it } from "vitest";
import { assistantChatInputSchema, buildCampusContext, validateAssistantChatRequest } from "./assistant";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("campus assistant request validation", () => {
  it("accepts a bounded multilingual campus question", () => {
    const result = assistantChatInputSchema.parse({ message: "Where is the library?", language: "kn", history: [] });
    expect(result.language).toBe("kn");
  });

  it("rejects unsupported languages and oversized chat history", () => {
    const unsupportedLanguage = assistantChatInputSchema.safeParse({ message: "Hello", language: "fr" });
    expect(unsupportedLanguage.success).toBe(false);
    if (!unsupportedLanguage.success) expect(unsupportedLanguage.error.issues[0]?.path).toEqual(["language"]);
    expect(() => assistantChatInputSchema.parse({ message: "Hello", language: "en", history: Array.from({ length: 7 }, () => ({ role: "user", content: "Hello" })) })).toThrow();
  });

  it("returns the dedicated unsupported-language validation code for an assistant request", () => {
    expect(validateAssistantChatRequest({ message: "Hello", language: "fr", history: [] })).toEqual({ success: false, errorCode: "PRECONDITION_FAILED" });
  });

  it("exposes the dedicated error code through the assistant procedure", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.assistant.chat({ message: "Bonjour", language: "fr", history: [] })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("grounds the system context in the configured PathFinder data", () => {
    expect(buildCampusContext()).toContain("Central Library");
    expect(buildCampusContext()).toContain("Computer Science Department");
  });
});
