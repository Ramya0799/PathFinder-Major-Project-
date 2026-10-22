import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useGLTFSpy = vi.hoisted(() => vi.fn());
const setLocationSpy = vi.hoisted(() => vi.fn());

vi.mock("@/components/TopNav", () => ({
  TopNav: () => <div data-testid="top-nav" />,
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    campus: {
      models3d: {
        useQuery: () => ({
          data: [
            {
              zoneId: "learning-library",
              modelUrl: "https://models.example.org/aiet-library.glb",
              scale: "1.2",
              rotationY: "15",
            },
          ],
        }),
      },
      indoorLocations: {
        useQuery: () => ({
          data: [
            {
              id: 12,
              zoneId: "learning-library",
              name: "Reference desk",
              buildingLabel: "Central Library",
              floorLabel: "Ground floor",
              roomLabel: "L-01",
              roomType: "facility",
              routeNodeExternalId: "d10",
              searchAliases: "help counter, information desk",
              commonSearchTerms: "library assistance, research support",
              description: "Verified reference and help desk.",
              accessibilityInfo: "Step-free access via the main entrance.",
            },
          ],
        }),
      },
      floorPlanOverlays: {
        useQuery: () => ({
          data: [
            {
              id: 8,
              zoneId: "learning-library",
              buildingLabel: "Central Library",
              floorLabel: "Ground floor",
              title: "Central Library ground-floor plan",
              isPriorityOffice: true,
              overlayUrl: "https://plans.example.org/library-ground.png",
              sourceReference: "Campus office plan",
            },
          ],
        }),
      },
      floorPlanMarkers: {
        useQuery: () => ({
          data: [
            {
              id: 4,
              overlayId: 8,
              indoorLocationId: 12,
              label: "Reference desk",
              xPercent: 48,
              yPercent: 36,
              routeNodeExternalId: "d10",
            },
          ],
        }),
      },
    },
  },
}));
vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="campus-canvas">{children}</div>
  ),
  useFrame: () => undefined,
  useThree: () => ({ camera: { position: { lerp: vi.fn() } } }),
}));
vi.mock("@react-three/drei", () => ({
  OrbitControls: () => null,
  useGLTF: (url: string) => {
    useGLTFSpy(url);
    return { scene: { clone: () => ({}) } };
  },
}));
vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useLocation: () => ["/campus-3d?to=d10", setLocationSpy],
  };
});

import Campus3D from "./Campus3D";

beforeEach(() => {
  setLocationSpy.mockReset();
  window.sessionStorage.clear();
  window.history.pushState({}, "", "/campus-3d?to=d10");
});
afterEach(() => {
  cleanup();
  useGLTFSpy.mockReset();
  window.sessionStorage.clear();
  window.history.pushState({}, "", "/campus-3d");
});

describe("Campus3D approved model and indoor-directory integration", () => {
  it("loads an approved model for the canonical learning-library zone in the public explorer", async () => {
    render(<Campus3D />);
    await waitFor(() =>
      expect(useGLTFSpy).toHaveBeenCalledWith(
        "https://models.example.org/aiet-library.glb"
      )
    );
    expect(screen.getByTestId("campus-canvas")).toBeTruthy();
    expect(
      document.querySelector('group[name="approved-model-learning-library"]')
    ).toBeTruthy();
    expect(
      document.querySelector('group[name="fallback-massing-learning-library"]')
    ).toBeNull();
    expect(
      screen.getByText(
        /Only administrator-approved model assets appear for published campus zones\./
      )
    ).toBeTruthy();
  });

  it("shows only the verified floor and room data supplied for the selected zone", () => {
    render(<Campus3D />);
    expect(
      screen.getByRole("heading", { name: "Verified floors and rooms" })
    ).toBeTruthy();
    expect(screen.getAllByText("Reference desk").length).toBeGreaterThanOrEqual(
      1
    );
    expect(screen.getByText("Central Library · L-01")).toBeTruthy();
    expect(
      screen.getByText(/Step-free access via the main entrance/)
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Route to this location" })
    ).toBeTruthy();
  });

  it("finds a verified room and presents its approved floor-plan overlay", async () => {
    render(<Campus3D />);
    fireEvent.change(
      screen.getByRole("textbox", {
        name: "Search verified rooms or buildings",
      }),
      { target: { value: "reference" } }
    );
    await waitFor(() =>
      expect(
        screen.getAllByText("Reference desk").length
      ).toBeGreaterThanOrEqual(2)
    );
    expect(screen.getByText("Central Library ground-floor plan")).toBeTruthy();
    expect(
      screen
        .getByRole("img", {
          name: "Verified floor plan: Central Library ground-floor plan",
        })
        .getAttribute("src")
    ).toBe("https://plans.example.org/library-ground.png");
  });

  it("finds a verified room through its approved common search terms", async () => {
    render(<Campus3D />);
    fireEvent.change(
      screen.getByRole("textbox", {
        name: "Search verified rooms or buildings",
      }),
      { target: { value: "research support" } }
    );
    await waitFor(() =>
      expect(
        screen.getAllByText("Reference desk").length
      ).toBeGreaterThanOrEqual(2)
    );
  });

  it("shows a route-linked marker only within the approved active floor-plan overlay", () => {
    render(<Campus3D />);
    const marker = screen.getByRole("button", {
      name: "Navigate to Reference desk from the floor plan",
    });
    expect(marker).toBeTruthy();
    expect(screen.getByText(/1 configured route marker/)).toBeTruthy();
    expect(screen.getByText("Priority office")).toBeTruthy();
    fireEvent.click(marker);
    expect(setLocationSpy).toHaveBeenCalledWith("/map");
  });

  it("renders the source-aware official library and campus gallery without treating it as navigation evidence", () => {
    render(<Campus3D />);
    expect(
      screen.getByRole("heading", { name: "Official AIET visual archive" })
    ).toBeTruthy();
    expect(
      screen
        .getAllByRole("img", {
          name: "Official AIET Library Gallery image labelled Main Reading Hall.",
        })
        .some(
          image =>
            image.getAttribute("src") ===
            "/manus-storage/library-main-reading-hall_d69b24cc.jpg"
        )
    ).toBe(true);
    expect(
      screen.getAllByText(/Visual reference only\./).length
    ).toBeGreaterThanOrEqual(9);
    expect(
      screen.getAllByRole("button", { name: "Navigate to Central Library" })
        .length
    ).toBe(6);
    expect(
      screen.getByText(
        /they are not floor plans, surveyed building geometry, or route instructions/i
      )
    ).toBeTruthy();
  });

  it("renders an accessible property-style campus command deck using only the existing published zones", () => {
    render(<Campus3D />);
    expect(
      screen.getByRole("heading", {
        name: "Select a zone. Inspect the guide. Continue with a route.",
      })
    ).toBeTruthy();
    expect(
      screen.getByRole("tablist", { name: "Campus zone selector" })
    ).toBeTruthy();
    const libraryTab = screen.getByRole("tab", {
      name: /Central Library & Learning/i,
    });
    expect(libraryTab.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Profile")).toBeTruthy();
    expect(screen.getByText("Approved")).toBeTruthy();
  });

  it("turns the 3D scene into a spatial route-preview surface with onboarding and quality controls", async () => {
    render(<Campus3D />);
    expect(screen.getByText("Welcome to PathFinder 3D")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Skip tutorial" }));
    expect(screen.queryByText("Welcome to PathFinder 3D")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Preview route" }));
    await waitFor(() =>
      expect(screen.getByText(/route preview active/)).toBeTruthy()
    );
    expect(
      document.querySelector('group[name="illustrative-route-preview"]')
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /low/i }));
    expect(screen.getByRole("button", { name: /low/i }).className).toContain(
      "bg-cyan-300"
    );
  });

  it("hydrates a verified live GPS snapshot and shows turn-by-turn 3D guidance", () => {
    window.sessionStorage.setItem("pathfinder-live-navigation", JSON.stringify({
      active: true,
      sourceNodeId: "gate",
      destinationId: "d10",
      currentWaypointIndex: 1,
      totalWaypoints: 4,
      progressPercent: 33,
      remainingDistance: 120,
      currentInstruction: "Continue toward the library.",
      currentVoiceInstruction: "Continue toward the library.",
      isComplete: false,
      position: { latitude: 13.0217, longitude: 74.98105, accuracy: 8 },
      updatedAt: Date.now(),
    }));
    window.history.pushState({}, "", "/campus-3d?from=gate&to=d10&live=1");
    render(<Campus3D />);
    expect(screen.getByText(/Live GPS · turn-by-turn/i)).toBeTruthy();
    expect(screen.getByText(/3D cue follows the verified graph/i)).toBeTruthy();
    expect(screen.getByText(/live route cue active/i)).toBeTruthy();
  });

  it("renders the staged demo floor preview without publishing navigation claims", () => {
    render(<Campus3D />);
    expect(
      screen.getByRole("heading", { name: "Staged floor-plan preview" })
    ).toBeTruthy();
    expect(screen.getByText("Demo only · no routing")).toBeTruthy();
    expect(
      screen.getByText(/It is not an AIET plan and contains no real room/i)
    ).toBeTruthy();
    expect(
      screen.getByRole("img", {
        name: "Fictional demo floor plan for Central Library & Learning",
      })
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Do not use this drawing for wayfinding or safety decisions."
      )
    ).toBeTruthy();
  });
});
