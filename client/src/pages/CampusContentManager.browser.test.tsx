import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <main data-testid="admin-shell">{children}</main> }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 1, role: "admin", name: "Campus admin" }, loading: false }) }));
vi.mock("@/lib/trpc", () => ({ trpc: { useUtils: () => ({ admin: { media: { invalidate: vi.fn() }, models3d: { invalidate: vi.fn() }, indoorLocations: { invalidate: vi.fn() }, floorPlanOverlays: { invalidate: vi.fn() }, floorPlanMarkers: { invalidate: vi.fn() } }, campus: { models3d: { invalidate: vi.fn() }, indoorLocations: { invalidate: vi.fn() }, floorPlanOverlays: { invalidate: vi.fn() }, floorPlanMarkers: { invalidate: vi.fn() } } }), admin: { media: { useQuery: () => ({ data: [], isLoading: false }) }, models3d: { useQuery: () => ({ data: [{ id: 4, zoneId: "learning-library", title: "Library BIM model", fileName: "library.glb", sourceReference: "Campus architect", scale: "1", rotationY: "0", approvalStatus: "approved", isActive: true }, { id: 5, zoneId: "academic-areas", title: "Academic draft", fileName: "academic.glb", sourceReference: "Planning office", scale: "1", rotationY: "0", approvalStatus: "draft", isActive: false }], isLoading: false }) }, indoorLocations: { useQuery: () => ({ data: [], isLoading: false }) }, floorPlanOverlays: { useQuery: () => ({ data: [], isLoading: false }) }, floorPlanMarkers: { useQuery: () => ({ data: [], isLoading: false }) }, uploadMedia: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }) }, deleteMedia: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) }, upload3DModel: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }) }, update3DModel: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) }, delete3DModel: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) }, createIndoorLocation: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }) }, updateIndoorLocation: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) }, deleteIndoorLocation: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) }, uploadFloorPlanOverlay: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }) }, updateFloorPlanOverlay: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) }, deleteFloorPlanOverlay: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) }, createFloorPlanMarker: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }) }, updateFloorPlanMarker: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) }, deleteFloorPlanMarker: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } } } }));

import CampusContentManager from "./CampusContentManager";

afterEach(cleanup);

describe("CampusContentManager", () => {
  it("provides trusted floor-plan publishing and searchable GLB lifecycle management", () => {
    render(<CampusContentManager />);
    expect(screen.getByTestId("admin-shell")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Verified indoor navigation" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Verified floor-plan overlay" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Searchable GLB model registry" })).toBeTruthy();
    expect(screen.getByText(/public explorer content requires authorised verification/i)).toBeTruthy();
    expect(screen.getByText(/JPG, PNG, or WebP/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /open 3D guide/i }).getAttribute("href")).toBe("/campus-3d");
  });

  it("filters registered GLB models by text, zone, and lifecycle status", () => {
    render(<CampusContentManager />);
    const search = screen.getByPlaceholderText("Search title, filename, source, or zone");
    fireEvent.change(search, { target: { value: "library" } });
    expect(screen.getByText("Library BIM model")).toBeTruthy();
    expect(screen.queryByText("Academic draft")).toBeNull();
    fireEvent.change(screen.getByRole("combobox", { name: "Filter GLB models by status" }), { target: { value: "draft" } });
    expect(screen.queryByText("Library BIM model")).toBeNull();
    expect(screen.queryByText("Academic draft")).toBeNull();
    fireEvent.change(search, { target: { value: "" } });
    expect(screen.getByText("Academic draft")).toBeTruthy();
  });
});
