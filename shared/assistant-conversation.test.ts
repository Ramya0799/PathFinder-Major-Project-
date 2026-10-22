import { describe, expect, it } from "vitest";
import { continueRouteConversation, createConversationState, prepareSpokenRouteRequest, resolveCampusDestination, resolveCampusSource } from "./assistant-conversation";

describe("assistant route conversation", () => {
  it("continues the exact library → yes → Main Gate follow-up without asking the AI model", () => {
    const first = continueRouteConversation("Where is the Central Library?", createConversationState("en", "conversation-1"));
    expect(first.state.intent).toBe("awaiting_route_confirmation");
    expect(first.state.destinationId).toBe("d10");

    const confirmation = continueRouteConversation("yes", first.state);
    expect(confirmation.handled).toBe(true);
    expect(confirmation.state.intent).toBe("awaiting_source");

    const routed = continueRouteConversation("Main Gate", confirmation.state);
    expect(routed.state.intent).toBe("route_ready");
    expect(routed.route?.source.id).toBe("gate");
    expect(routed.route?.destination.id).toBe("d10");
    expect(routed.route?.result.totalDistance).toBeGreaterThan(0);
    expect(routed.route?.result.nodeIds).toEqual(["gate", "reception", "library-entry", "library"]);
    expect(routed.route?.instructions.length).toBeGreaterThan(1);
    expect(routed.state.route).toMatchObject({ sourceNodeId: "gate", destinationId: "d10" });
  });

  it("resolves only configured aliases and supports a direct source-to-destination request", () => {
    expect(resolveCampusDestination("AIET Library")?.id).toBe("d10");
    expect(resolveCampusDestination("CSE")?.id).toBe("d5");
    expect(resolveCampusSource("Administrative Block")?.id).toBe("admin-entry");
    expect(resolveCampusDestination("unlisted destination")).toBeUndefined();

    const direct = continueRouteConversation("Give me directions from Main Gate to the library", createConversationState("en", "conversation-2"));
    expect(direct.route?.destination.name).toBe("Central Library");
  });

  it("normalizes a spoken configured destination into a direct route from the selected start", () => {
    expect(prepareSpokenRouteRequest("Navigate to the library", "gate")).toBe("from Main Gate to Central Library");
    expect(prepareSpokenRouteRequest("Navigate to the library")).toBe("Navigate to the library");
    expect(prepareSpokenRouteRequest("Navigate to an unlisted place", "gate")).toBe("Navigate to an unlisted place");
  });

  it("preserves a verified route when the user starts navigation", () => {
    const ready = continueRouteConversation("Main Gate", continueRouteConversation("yes", continueRouteConversation("Library", createConversationState("en", "conversation-3")).state).state);
    const started = continueRouteConversation("Start navigation", ready.state);
    expect(started.action).toBe("start_navigation");
    expect(started.state.navigationStatus).toBe("active");
    expect(started.state.route).toEqual(ready.state.route);
  });

  it("resolves configured Kannada source aliases into a usable route", () => {
    const state = { ...createConversationState("kn", "conversation-kn"), intent: "awaiting_source" as const, destinationId: "d10" };
    const routed = continueRouteConversation("ಮುಖ್ಯ ದ್ವಾರ", state);
    expect(routed.route?.source.id).toBe("gate");
    expect(routed.route?.destination.id).toBe("d10");
    expect(routed.reply).toContain("ಮಾರ್ಗ ದೊರಕಿದೆ");
  });

  it("accepts a localized navigation-start follow-up for a verified route", () => {
    const initial = createConversationState("hi", "localized-navigation");
    const route = continueRouteConversation("Main Gate to Central Library", initial);
    const navigation = continueRouteConversation("नेविगेशन शुरू करें", route.state);
    expect(navigation.state.intent).toBe("navigating");
    expect(navigation.reply).toContain("नेविगेशन तैयार है");
  });

  it("keeps a route-calculation failure localized instead of exposing a generic server error", () => {
    const state = { ...createConversationState("ta", "conversation-ta"), intent: "awaiting_source" as const, destinationId: "d10" };
    const missing = continueRouteConversation("unlisted starting point", state);
    expect(missing.handled).toBe(true);
    expect(missing.reply).toContain("முதன்மை நுழைவாயில்");
  });
});
