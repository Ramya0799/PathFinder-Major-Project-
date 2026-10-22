import { continueRouteConversation, createConversationState } from "@shared/assistant-conversation";
import { supportedLanguageCodes } from "@shared/i18n";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { AssistantRouteResult } from "./AssistantRouteResult";

afterEach(cleanup);

describe("Assistant route-result panel", () => {
  it.each(supportedLanguageCodes)("runs every route action from the production assistant route panel in %s", async (language) => {
    const route = continueRouteConversation("from Main Gate to Central Library", createConversationState(language)).route!;
    const launches: unknown[] = [];
    const navigations: string[] = [];
    const user = userEvent.setup();
    render(<AssistantRouteResult route={route} accessibilityRequired={false} language={language} saveLaunch={(launch) => launches.push(launch)} navigate={(href) => navigations.push(href)} onError={() => { throw new Error("Route action should not fail"); }} />);

    await user.click(screen.getByRole("button", { name: "Start voice guidance" }));
    await user.click(screen.getByRole("button", { name: "Open map" }));
    await user.click(screen.getByRole("button", { name: "3D campus view" }));
    await user.click(screen.getByRole("button", { name: "AR guidance" }));

    expect(launches).toEqual([
      expect.objectContaining({ sourceNodeId: "gate", destinationId: "d10", autoStart: true, voiceOn: true, language }),
      expect.objectContaining({ sourceNodeId: "gate", destinationId: "d10", autoStart: false, voiceOn: false, language }),
    ]);
    expect(navigations).toEqual(["/map", "/map", "/campus-3d?from=gate&to=d10", "/ar"]);
    console.info(`ASSISTANT_ROUTE_PANEL_VALIDATED language=${language} actions=voice,map,campus3d,ar`);
  });
});
