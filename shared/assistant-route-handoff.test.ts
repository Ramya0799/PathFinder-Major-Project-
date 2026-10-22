import { describe, expect, it } from "vitest";
import { createAssistantRouteLaunch } from "../client/src/lib/assistantRouteLaunch";
import { createAssistantRouteActionLinks } from "../client/src/lib/assistantRouteActions";
import { continueRouteConversation, createConversationState } from "./assistant-conversation";
import { supportedLanguageCodes } from "./i18n";
import { createLocalizedVoiceGuidance } from "./voice-guidance";

describe("assistant route handoff", () => {
  it("carries a verified route into the map, 3D, AR, and voice-guidance actions", () => {
    const response = continueRouteConversation("from Main Gate to Central Library", createConversationState("en", "route-handoff"));
    expect(response.route).toBeDefined();
    const route = response.route!;
    const links = createAssistantRouteActionLinks(route.source.id, route.destination.id);
    const launch = createAssistantRouteLaunch({ sourceNodeId: route.source.id, destinationId: route.destination.id, accessibleOnly: false, autoStart: true, voiceOn: true, language: "en" });
    const voiceSteps = createLocalizedVoiceGuidance(route.instructions, "en");

    expect(links).toEqual({ map: "/map", campus3d: `/campus-3d?from=${route.source.id}&to=${route.destination.id}`, ar: "/ar" });
    expect(launch).toMatchObject({ sourceNodeId: route.source.id, destinationId: route.destination.id, autoStart: true, voiceOn: true, language: "en" });
    expect(voiceSteps[0]).toContain(route.instructions[0]);
  });

  it("preserves every selected language from route planning through spoken guidance", () => {
    for (const language of supportedLanguageCodes) {
      const response = continueRouteConversation("from Main Gate to Central Library", createConversationState(language, `route-handoff-${language}`));
      const route = response.route!;
      const launch = createAssistantRouteLaunch({ sourceNodeId: route.source.id, destinationId: route.destination.id, accessibleOnly: false, autoStart: true, voiceOn: true, language });
      expect(launch.language).toBe(language);
      expect(createLocalizedVoiceGuidance(route.instructions, language)).toHaveLength(route.instructions.length);
    }
  });
});
