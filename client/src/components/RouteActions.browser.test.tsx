import { executeAssistantRouteAction, type AssistantRouteAction } from "@/lib/assistantRouteActions";
import { continueRouteConversation, createConversationState } from "@shared/assistant-conversation";
import { supportedLanguageCodes } from "@shared/i18n";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { RouteActions } from "./RouteActions";

afterEach(cleanup);

describe("rendered assistant route actions", () => {
  it.each(supportedLanguageCodes)("activates map, 3D, AR, and voice guidance from the rendered card in %s", async (language) => {
    const route = continueRouteConversation("from Main Gate to Central Library", createConversationState(language)).route!;
    const navigations: string[] = [];
    const launches: unknown[] = [];
    const onAction = (action: AssistantRouteAction) => executeAssistantRouteAction(
      { action, sourceNodeId: route.source.id, destinationId: route.destination.id, accessibleOnly: false, language },
      { navigate: (href) => navigations.push(href), saveLaunch: (launch) => launches.push(launch) },
    );
    const user = userEvent.setup();
    render(<RouteActions route={route} onAction={onAction} />);

    await user.click(screen.getByRole("button", { name: "Start voice guidance" }));
    await user.click(screen.getByRole("button", { name: "Open map" }));
    await user.click(screen.getByRole("button", { name: "3D campus view" }));
    await user.click(screen.getByRole("button", { name: "AR guidance" }));

    expect(navigations).toEqual(["/map", "/map", "/campus-3d?from=gate&to=d10", "/ar"]);
    expect(launches).toEqual([
      expect.objectContaining({ language, autoStart: true, voiceOn: true, sourceNodeId: "gate", destinationId: "d10" }),
      expect.objectContaining({ language, autoStart: false, voiceOn: false, sourceNodeId: "gate", destinationId: "d10" }),
    ]);
    console.info(`RENDERED_ROUTE_ACTION_VALIDATED language=${language} actions=voice,map,campus3d,ar`);
  });
});
