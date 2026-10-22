import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";

const navigationSpy = vi.hoisted(() => vi.fn());

vi.mock("@/components/TopNav", () => ({ TopNav: () => <div data-testid="top-nav" /> }));
vi.mock("@/components/AlvasCampusShowcase", () => ({ AlvasCampusShowcase: () => <div data-testid="campus-lens" /> }));
vi.mock("@/lib/trpc", () => ({ trpc: { campus: { media: { useQuery: () => ({ data: [] }) } } } }));
vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return { ...actual, useLocation: () => ["/", navigationSpy] };
});

import Home from "./Home";

afterEach(() => {
  cleanup();
  navigationSpy.mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  localStorage.clear();
});

describe("cinematic Home page", () => {
  it("falls back from the campus video to the supplied AIET image when media cannot play", () => {
    render(<LanguageProvider><Home /></LanguageProvider>);
    fireEvent.error(screen.getByLabelText("AIET campus highlights"));
    expect(screen.getByAltText("AIET academic block")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Campus image fallback" })).toBeTruthy();
  });

  it("lets visitors pause and resume the cinematic campus video", async () => {
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LanguageProvider><Home /></LanguageProvider>);

    await user.click(screen.getByRole("button", { name: "Pause campus video" }));
    expect(pause).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Play campus video" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Play campus video" }));
    expect(play).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Pause campus video" })).toBeTruthy());
  });

  it("hands a selected configured source and destination to the live map", async () => {
    const user = userEvent.setup();
    render(<LanguageProvider><Home /></LanguageProvider>);
    await user.selectOptions(screen.getByLabelText("To"), "d11");
    await user.click(screen.getByRole("button", { name: "Start navigation" }));
    expect(sessionStorage.getItem("aiet-source")).toBe("gate");
    expect(sessionStorage.getItem("pathfinder-destination")).toBe("d11");
    expect(navigationSpy).toHaveBeenCalledWith("/map");
  });

  it("presents the navigation-product hero actions without removing planner access", () => {
    render(<LanguageProvider><Home /></LanguageProvider>);
    expect(screen.getByText("Never Get Lost", { exact: false })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start navigation from current position" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /View in 3D/i }).getAttribute("href")).toBe("/campus-3d");
    expect(screen.getByRole("link", { name: /AR navigation/i }).getAttribute("href")).toBe("/ar");
  });

  it("keeps the hero copy narrow and route actions compact without removing planner access", () => {
    render(<LanguageProvider><Home /></LanguageProvider>);

    const heroCopy = screen.getByTestId("hero-copy");
    const exploreLink = heroCopy.querySelector<HTMLAnchorElement>('a[href="#explore"]');
    const plannerLink = heroCopy.querySelector<HTMLAnchorElement>('a[href="/destinations"]');
    expect(heroCopy.className).toContain("max-w-lg");
    expect(exploreLink?.className).toContain("flex-1");
    expect(plannerLink?.className).toContain("flex-1");
    expect(plannerLink?.getAttribute("href")).toBe("/destinations");
  });

  it("plays the English route sample and presents first-run Tulu navigation prompts", async () => {
    const speak = vi.fn();
    vi.stubGlobal("speechSynthesis", { cancel: vi.fn(), speak });
    vi.stubGlobal("SpeechSynthesisUtterance", class {
      lang = "";
      rate = 1;
      onend: (() => void) | null = null;
      constructor(public text: string) {}
    });
    const user = userEvent.setup();
    render(<LanguageProvider><Home /></LanguageProvider>);

    await user.selectOptions(screen.getByLabelText("Preview language"), "tcy");
    expect(await screen.findByText("ತುಳುದ ಮಧಿಪ್ಪ್ ದಾರಿ ಕಲ್ಪನೆ")).toBeTruthy();
    expect(screen.getByText(/ಕೇಂದ್ರ ಗ್ರಂಥಾಲಯದ ದಾರಿ ತೋರ್ಸೆ/)).toBeTruthy();
    expect(screen.getByText(/ಮುಖ್ಯ ದ್ವಾರದಿಂದ ಪ್ರಾರಂಭ ಮಲ್ಪುಲೆ/)).toBeTruthy();
    expect(screen.getByText(/ಮಾರ್ಗದರ್ಶನ ಪ್ರಾರಂಭ ಮಲ್ಪುಲೆ/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Hear an English route sample" }));
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0][0]).toMatchObject({ text: "Turn left in 30 metres.", lang: "en-IN" });
    expect(screen.getByText("Playing the English route sample.")).toBeTruthy();
  });

  it("explains the readable English fallback when browser audio is unavailable", async () => {
    const user = userEvent.setup();
    render(<LanguageProvider><Home /></LanguageProvider>);

    await user.click(screen.getByRole("button", { name: "Hear an English route sample" }));
    expect(screen.getByText("English audio sample is unavailable in this browser. You can still read the English route prompt.")).toBeTruthy();
  });
});
