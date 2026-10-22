export type Campus3DContentStatus = "official-content" | "information-to-be-updated";
export const campus3dZoneIds = ["academic-areas", "learning-library", "student-facilities", "visitor-services"] as const;
export type Campus3DZoneId = (typeof campus3dZoneIds)[number];

export type Campus3DBuilding = {
  id: Campus3DZoneId;
  title: string;
  shortLabel: string;
  description: string;
  position: readonly [number, number, number];
  dimensions: readonly [number, number, number];
  accent: string;
  routeDestinationId?: string;
  contentStatus: Campus3DContentStatus;
  officialSource: string;
  highlights: readonly string[];
  model: {
    url?: string;
    scale: number;
    rotationY: number;
    enabled: boolean;
  };
};

/**
 * The massing is a navigational visualization, not an architectural survey.
 * Model URLs, coordinates, floors, and room data intentionally remain configurable
 * until AIET provides verified source material for them.
 */
export const campus3dBuildings: readonly Campus3DBuilding[] = [
  {
    id: "academic-areas",
    title: "Academic & Departmental Areas",
    shortLabel: "Academic",
    description: "A configurable campus zone for the departments publicly listed by AIET, including CSE-related programmes, AI & ML, ISE, Civil, Mechanical, Agriculture Engineering, MBA, and Training & Placement.",
    position: [-3.25, 0, 0.9],
    dimensions: [3.4, 2.4, 2.7],
    accent: "#22d3ee",
    routeDestinationId: "d5",
    contentStatus: "official-content",
    officialSource: "https://www.aiet.org.in/department/",
    highlights: ["Official department listing", "Configured route anchor available", "Floor and room data to be updated"],
    model: { scale: 1, rotationY: 0, enabled: false },
  },
  {
    id: "learning-library",
    title: "Central Library & Learning",
    shortLabel: "Library",
    description: "AIET publicly identifies the Central Library and Digital Resources as a campus learning facility, with books, journals, e-resources, and a digital-library section.",
    position: [1.1, 0, -0.4],
    dimensions: [3.1, 2.1, 2.5],
    accent: "#fbbf24",
    routeDestinationId: "d10",
    contentStatus: "official-content",
    officialSource: "https://www.aiet.org.in/amenities-facilities/",
    highlights: ["Central Library", "Digital resources", "Learning support"],
    model: { scale: 1, rotationY: 0, enabled: false },
  },
  {
    id: "student-facilities",
    title: "Student Facilities",
    shortLabel: "Facilities",
    description: "AIET’s official amenities page lists food, hostels, transport, ATM access, health and life support, sports and fitness, Wi-Fi, auditoriums, and learning support.",
    position: [3.8, 0, 2.8],
    dimensions: [2.7, 1.75, 2.2],
    accent: "#22d3ee",
    routeDestinationId: "d13",
    contentStatus: "official-content",
    officialSource: "https://www.aiet.org.in/amenities-facilities/",
    highlights: ["Food and wellbeing", "Sports and fitness", "Transport and Wi-Fi"],
    model: { scale: 1, rotationY: 0, enabled: false },
  },
  {
    id: "visitor-services",
    title: "Visitor & Contact Services",
    shortLabel: "Contact",
    description: "Use this campus contact point to find AIET’s public address and visitor-facing contact information. Exact building geometry is awaiting official campus-model data.",
    position: [-0.9, 0, 3.75],
    dimensions: [2.25, 1.35, 1.85],
    accent: "#fbbf24",
    routeDestinationId: "d2",
    contentStatus: "information-to-be-updated",
    officialSource: "https://www.aiet.org.in/contact-us/",
    highlights: ["Shobhavana Campus, Mijar", "Visitor contact details", "Geometry to be updated"],
    model: { scale: 1, rotationY: 0, enabled: false },
  },
];

export function findCampus3DBuilding(id?: string) {
  return campus3dBuildings.find((building) => building.id === id);
}

export function findCampus3DBuildingForDestination(destinationId?: string) {
  return campus3dBuildings.find((building) => building.routeDestinationId === destinationId);
}

export function findApprovedCampus3DModelForZone<T extends { zoneId: string }>(zoneId: Campus3DZoneId, models: readonly T[]) {
  return models.find((model) => model.zoneId === zoneId);
}
