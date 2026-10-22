import { act, cleanup, renderHook } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { getRoutableDestinationLocations, getRoutableSourceNodes, readRouteSelection, resolveDestinationLocation, useRouteSelection } from "./routeSelection";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/destinations");
});

describe("shared route selection", () => {
  it("offers every connected campus graph node as a source and destination location", () => {
    const sourceNodes = getRoutableSourceNodes();
    const destinationLocations = getRoutableDestinationLocations();

    expect(sourceNodes.length).toBeGreaterThan(16);
    expect(destinationLocations).toEqual(expect.arrayContaining([expect.objectContaining({ id: "reception", name: "Reception Plaza" })]));
    expect(resolveDestinationLocation("reception")).toMatchObject({ nodeId: "reception", name: "Reception Plaza" });
  });

  it("preserves the other endpoint and persists rapid updates to the URL and session", () => {
    const { result } = renderHook(() => useRouteSelection());

    act(() => {
      result.current[1]({ sourceNodeId: "cafe" });
      result.current[1]({ destinationId: "d10" });
    });

    expect(result.current[0]).toEqual({ sourceNodeId: "cafe", destinationId: "d10" });
    expect(sessionStorage.getItem("aiet-source")).toBe("cafe");
    expect(sessionStorage.getItem("pathfinder-destination")).toBe("d10");
    expect(new URLSearchParams(window.location.search).get("source")).toBe("cafe");
    expect(new URLSearchParams(window.location.search).get("destination")).toBe("d10");
  });

  it("preserves intentional empty endpoints instead of silently restoring defaults", () => {
    const { result } = renderHook(() => useRouteSelection());

    act(() => result.current[1]({ sourceNodeId: "", destinationId: "" }));

    expect(result.current[0]).toEqual({ sourceNodeId: "", destinationId: "" });
    expect(readRouteSelection()).toEqual({ sourceNodeId: "", destinationId: "" });
    expect(sessionStorage.getItem("aiet-source")).toBe("");
    expect(new URLSearchParams(window.location.search).get("destination")).toBe("");
  });

  it("ignores invalid route IDs in a URL and safely falls back to valid stored selections", () => {
    sessionStorage.setItem("aiet-source", "cafe");
    sessionStorage.setItem("pathfinder-destination", "d10");
    window.history.replaceState(null, "", "/map?source=not-a-node&destination=not-a-destination");

    expect(readRouteSelection()).toEqual({ sourceNodeId: "cafe", destinationId: "d10" });
  });
});
