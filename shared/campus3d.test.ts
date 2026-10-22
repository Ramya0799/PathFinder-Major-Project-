import { describe, expect, it } from "vitest";
import { campus3dBuildings, findApprovedCampus3DModelForZone, findCampus3DBuildingForDestination } from "./campus3d";

describe("campus 3D content model", () => {
  it("keeps every visible campus zone source-bound and ready for a later model upload", () => {
    expect(campus3dBuildings.length).toBeGreaterThanOrEqual(4);
    for (const building of campus3dBuildings) {
      expect(building.officialSource).toMatch(/^https:\/\/www\.aiet\.org\.in\//);
      expect(building.model).toEqual(expect.objectContaining({ enabled: false, scale: expect.any(Number), rotationY: expect.any(Number) }));
      expect(building.highlights.length).toBeGreaterThan(0);
    }
  });

  it("maps the verified library zone to the existing Central Library route destination", () => {
    expect(findCampus3DBuildingForDestination("d10")).toEqual(expect.objectContaining({ id: "learning-library", title: "Central Library & Learning" }));
  });

  it("resolves an approved model to the matching public library zone without relying on display labels", () => {
    const approvedModels = [{ zoneId: "learning-library", modelUrl: "https://cdn.example.org/aiet-library.glb" }];
    expect(findApprovedCampus3DModelForZone("learning-library", approvedModels)).toEqual(approvedModels[0]);
    expect(findApprovedCampus3DModelForZone("student-facilities", approvedModels)).toBeUndefined();
  });
});
