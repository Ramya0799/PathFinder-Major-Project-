import { createRouteActionHandler, RouteActions } from "../client/src/components/RouteActions";
import { continueRouteConversation, createConversationState } from "./assistant-conversation";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

describe("assistant route action card", () => {
  it("renders every action for a verified source-to-destination route", () => {
    const route = continueRouteConversation("from Main Gate to Central Library", createConversationState("en", "route-ui")).route!;
    const markup = renderToStaticMarkup(createElement(RouteActions, { route, onAction: () => undefined }));
    expect(markup).toContain("Start voice guidance");
    expect(markup).toContain("Open map");
    expect(markup).toContain("3D campus view");
    expect(markup).toContain("AR guidance");
    expect(markup).toContain("Main Gate");
    expect(markup).toContain("Central Library");
  });

  it("binds every rendered control to its intended assistant action", () => {
    const actions: string[] = [];
    const onAction = (action: "voice" | "map" | "campus3d" | "ar") => actions.push(action);
    createRouteActionHandler("voice", onAction)();
    createRouteActionHandler("map", onAction)();
    createRouteActionHandler("campus3d", onAction)();
    createRouteActionHandler("ar", onAction)();
    expect(actions).toEqual(["voice", "map", "campus3d", "ar"]);
  });
});
