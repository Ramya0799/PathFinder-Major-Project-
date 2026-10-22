import { describe, expect, it } from "vitest";
import { createAssistantRouteActionLinks, createAssistantRouteActionResult, executeAssistantRouteAction } from "../client/src/lib/assistantRouteActions";

describe("assistant rendered route actions", () => {
  it("generates the configured map, 3D campus, and AR destinations", () => {
    expect(createAssistantRouteActionLinks("gate", "d10")).toEqual({ map: "/map", campus3d: "/campus-3d?from=gate&to=d10", ar: "/ar" });
  });

  it("executes each rendered action through the correct navigation and handoff state", () => {
    const launches: unknown[] = [];
    const destinations: string[] = [];
    const effects = { saveLaunch: (launch: unknown) => launches.push(launch), navigate: (href: string) => destinations.push(href) };
    const base = { sourceNodeId: "gate", destinationId: "d10", accessibleOnly: true, language: "ml" as const };

    const voiceResult = executeAssistantRouteAction({ ...base, action: "voice" }, effects);
    const mapResult = executeAssistantRouteAction({ ...base, action: "map" }, effects);
    const campusResult = executeAssistantRouteAction({ ...base, action: "campus3d" }, effects);
    const arResult = executeAssistantRouteAction({ ...base, action: "ar" }, effects);

    expect(voiceResult).toMatchObject({ href: "/map", launch: { autoStart: true, voiceOn: true, language: "ml" } });
    expect(mapResult).toMatchObject({ href: "/map", launch: { autoStart: false, voiceOn: false, language: "ml" } });
    expect(campusResult).toEqual({ href: "/campus-3d?from=gate&to=d10" });
    expect(arResult).toEqual({ href: "/ar" });
    expect(launches).toHaveLength(2);
    expect(destinations).toEqual(["/map", "/map", "/campus-3d?from=gate&to=d10", "/ar"]);
  });

  it("keeps direct action result generation available for the component layer", () => {
    expect(createAssistantRouteActionResult({ action: "voice", sourceNodeId: "gate", destinationId: "d10", accessibleOnly: false, language: "en" })).toMatchObject({ launch: { autoStart: true } });
  });
});
