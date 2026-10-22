import { saveAssistantRouteLaunch, readAssistantRouteLaunch } from "@/lib/assistantRouteLaunch";
import { supportedLanguageCodes } from "@shared/i18n";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";

const speakTextSpy = vi.hoisted(() => vi.fn());
const watchPositionSpy = vi.hoisted(() => vi.fn());
vi.mock("@/components/TopNav", () => ({ TopNav: () => <div data-testid="top-nav" /> }));
vi.mock("@/components/CampusMap", () => ({ CampusMap: ({ route = [], source, destination }: { route?: { id: string }[]; source?: { name: string }; destination?: { name: string } }) => <div data-testid="campus-map" data-route={route.map((node) => node.id).join(",")} data-source={source?.name} data-destination={destination?.name} /> }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/lib/browserSpeech", () => ({ speakText: (...args: unknown[]) => speakTextSpy(...args) }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    routing: {
      startSession: { useMutation: () => ({ mutate: vi.fn() }) },
      completeSession: { useMutation: () => ({ mutate: vi.fn() }) },
      updateProgress: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      recordDeviation: { useMutation: () => ({ mutate: vi.fn() }) },
    },
    favorites: {
      list: { useQuery: () => ({ data: [] }) },
      save: { useMutation: () => ({ mutate: vi.fn() }) },
      remove: { useMutation: () => ({ mutate: vi.fn() }) },
    },
    useUtils: () => ({ favorites: { list: { invalidate: vi.fn() } } }),
  },
}));
vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return { ...actual, useLocation: () => ["/map", vi.fn()] };
});

import MapNavigation from "./MapNavigation";

let watchCallback: PositionCallback | undefined;

function createPosition(latitude: number, longitude: number): GeolocationPosition {
  return {
    coords: { latitude, longitude, accuracy: 6, altitude: null, altitudeAccuracy: null, heading: null, speed: null, toJSON: () => ({}) },
    timestamp: Date.now(),
    toJSON: () => ({}),
  } as GeolocationPosition;
}

beforeEach(() => {
  watchPositionSpy.mockImplementation((success: PositionCallback) => { watchCallback = success; return 73; });
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: vi.fn(), watchPosition: watchPositionSpy, clearWatch: vi.fn() } });
});

afterEach(() => { cleanup(); sessionStorage.clear(); window.history.replaceState(null, "", "/map"); speakTextSpy.mockReset(); watchPositionSpy.mockReset(); watchCallback = undefined; });

describe("MapNavigation assistant handoff", () => {
  it("shows clear prompts and removes the route when either endpoint is cleared", async () => {
    const user = userEvent.setup();
    render(<LanguageProvider><MapNavigation /></LanguageProvider>);

    await user.selectOptions(screen.getByRole("combobox", { name: "Starting point" }), "cafe");
    await user.selectOptions(screen.getByRole("combobox", { name: "Destination" }), "");
    expect(screen.getByRole("status").textContent).toContain("Choose a destination to calculate a route");
    expect(screen.getByTestId("campus-map").getAttribute("data-route")).toBe("");

    await user.selectOptions(screen.getByRole("combobox", { name: "Starting point" }), "");
    expect(screen.getByRole("status").textContent).toContain("Choose a starting point to calculate a route");
    expect(sessionStorage.getItem("aiet-source")).toBe("");
  });

  it("recalculates the active path when the source and destination selections change", async () => {
    const user = userEvent.setup();
    render(<LanguageProvider><MapNavigation /></LanguageProvider>);

    await user.selectOptions(screen.getByRole("combobox", { name: "Starting point" }), "cafe");
    expect(screen.getByText("From Cafeteria to AI Lab")).toBeTruthy();
    expect(screen.getByTestId("campus-map").getAttribute("data-route")).toContain("cse-entry");

    await user.selectOptions(screen.getByRole("combobox", { name: "Destination" }), "d10");
    expect(screen.getByText("From Cafeteria to Central Library")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Route ready: Cafeteria to Central Library");
    expect(screen.getByTestId("campus-map").getAttribute("data-route")).toContain("library-entry");
    expect(screen.getByTestId("campus-map").getAttribute("data-route")).not.toContain("ai-lab");
    expect(sessionStorage.getItem("aiet-source")).toBe("cafe");
    expect(sessionStorage.getItem("pathfinder-destination")).toBe("d10");
  });

  it.each(supportedLanguageCodes)("consumes an assistant voice launch and auto-starts localized guidance in %s", async (language) => {
    saveAssistantRouteLaunch({ sourceNodeId: "gate", destinationId: "d10", accessibleOnly: false, autoStart: true, voiceOn: true, language });
    render(<LanguageProvider><MapNavigation /></LanguageProvider>);
    await screen.findByText("Navigation in progress");
    await waitFor(() => expect(speakTextSpy).toHaveBeenCalledWith(expect.any(String), language));
    expect(readAssistantRouteLaunch()).toBeUndefined();
    expect(screen.getAllByText("Main Gate").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Central Library").length).toBeGreaterThan(0);
    console.info(`MAP_VOICE_HANDOFF_VALIDATED language=${language} route=gate:d10 autoStart=true`);
  });

  it("resets the spoken-waypoint guard after an off-route reroute", async () => {
    saveAssistantRouteLaunch({ sourceNodeId: "gate", destinationId: "d10", accessibleOnly: false, autoStart: true, voiceOn: true, language: "en" });
    render(<LanguageProvider><MapNavigation /></LanguageProvider>);

    await screen.findByText("Navigation in progress");
    await waitFor(() => expect(speakTextSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(watchPositionSpy).toHaveBeenCalled());

    await act(async () => { watchCallback?.(createPosition(13.02500, 74.98500)); });

    await screen.findByText("You're off the planned route.");
    await waitFor(() => expect(speakTextSpy).toHaveBeenLastCalledWith("Start from Central Library.", "en"));
    expect(speakTextSpy.mock.calls.filter(([text]) => text === "Start from Central Library.")).toHaveLength(1);
  });

  it("announces a waypoint once, preserves that guard after voice is toggled, and resets it for a new navigation session", async () => {
    const user = userEvent.setup();
    saveAssistantRouteLaunch({ sourceNodeId: "gate", destinationId: "d10", accessibleOnly: false, autoStart: true, voiceOn: true, language: "en" });
    render(<LanguageProvider><MapNavigation /></LanguageProvider>);

    await screen.findByText("Navigation in progress");
    await waitFor(() => expect(speakTextSpy).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: "Voice on" }));
    await user.click(screen.getByRole("button", { name: "Voice off" }));
    expect(speakTextSpy).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Mark next waypoint reached" }));
    await waitFor(() => expect(speakTextSpy).toHaveBeenCalledTimes(2));

    await user.click(screen.getByRole("button", { name: "Voice on" }));
    await user.click(screen.getByRole("button", { name: "Voice off" }));
    expect(speakTextSpy).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole("button", { name: "Stop navigation" }));
    await user.click(screen.getByRole("button", { name: "Start navigation" }));
    await waitFor(() => expect(speakTextSpy).toHaveBeenCalledTimes(3));
  });
});
