export const APP_NAME = "PathFinder Smart Campus";
export const SMALL_GRAPH_NODE_THRESHOLD = 50;
export const DEVIATION_THRESHOLD_METERS = 20;
export const REROUTE_COOLDOWN_MS = 15000;
export const WALKING_SPEED_METERS_PER_SECOND = 1.4;

export type NodeType = "gate" | "junction" | "entrance" | "office" | "room" | "lab" | "facility" | "staircase" | "outdoor";

export type CampusNode = {
  id: string;
  name: string;
  buildingId: string | null;
  buildingName: string;
  floorId: string | null;
  floorName: string;
  latitude: number;
  longitude: number;
  xCoordinate: number;
  yCoordinate: number;
  nodeType: NodeType;
  isAccessible: boolean;
  isActive: boolean;
};

export type CampusEdge = {
  id: string;
  sourceNodeId: string;
  destinationNodeId: string;
  distance: number;
  estimatedTime: number;
  isBidirectional: boolean;
  isBlocked: boolean;
  isAccessible: boolean;
  edgeType: "walkway" | "corridor" | "stairs" | "ramp";
};

export type Destination = {
  id: string;
  nodeId: string;
  name: string;
  category: "Academic" | "Administration" | "Facility" | "Accommodation" | "Transport";
  buildingId: string | null;
  buildingName: string;
  floorName: string;
  description: string;
  roomNumber?: string;
  accessibilityInfo: string;
  isActive: boolean;
};

export const campusBuildings = [
  { id: "admin", name: "AIET Administration Block", description: "Admissions, examination, and leadership offices." },
  { id: "cse", name: "AIET CSE & Innovation Block", description: "Computer Science department, laboratories, and innovation spaces." },
  { id: "central", name: "AIET Learning & Events Block", description: "Library, seminar, auditorium, and student facilities." },
];

export const campusFloors = [
  { id: "admin-g", buildingId: "admin", name: "Ground Floor", number: 0 },
  { id: "admin-f1", buildingId: "admin", name: "First Floor", number: 1 },
  { id: "cse-g", buildingId: "cse", name: "Ground Floor", number: 0 },
  { id: "cse-f1", buildingId: "cse", name: "First Floor", number: 1 },
  { id: "central-g", buildingId: "central", name: "Ground Floor", number: 0 },
  { id: "central-f1", buildingId: "central", name: "First Floor", number: 1 },
];

// DEMO_COORDINATES: Replace this isolated campus graph with surveyed coordinates before production deployment.
export const campusNodes: CampusNode[] = [
  { id: "gate", name: "Main Gate", buildingId: null, buildingName: "Campus Grounds", floorId: null, floorName: "Outdoor", latitude: 13.02170, longitude: 74.98105, xCoordinate: 6, yCoordinate: 56, nodeType: "gate", isAccessible: true, isActive: true },
  { id: "reception", name: "Reception Plaza", buildingId: null, buildingName: "Campus Grounds", floorId: null, floorName: "Outdoor", latitude: 13.02190, longitude: 74.98128, xCoordinate: 18, yCoordinate: 48, nodeType: "junction", isAccessible: true, isActive: true },
  { id: "square", name: "Campus Square", buildingId: null, buildingName: "Campus Grounds", floorId: null, floorName: "Outdoor", latitude: 13.02212, longitude: 74.98166, xCoordinate: 37, yCoordinate: 40, nodeType: "junction", isAccessible: true, isActive: true },
  { id: "parking", name: "Parking Area", buildingId: null, buildingName: "Campus Grounds", floorId: null, floorName: "Outdoor", latitude: 13.02155, longitude: 74.98143, xCoordinate: 15, yCoordinate: 70, nodeType: "outdoor", isAccessible: true, isActive: true },
  { id: "admin-entry", name: "Administration Entrance", buildingId: "admin", buildingName: "Administration Block", floorId: "admin-g", floorName: "Ground Floor", latitude: 13.02220, longitude: 74.98128, xCoordinate: 18, yCoordinate: 30, nodeType: "entrance", isAccessible: true, isActive: true },
  { id: "admin-office", name: "Administrative Office", buildingId: "admin", buildingName: "Administration Block", floorId: "admin-g", floorName: "Ground Floor", latitude: 13.02232, longitude: 74.98122, xCoordinate: 14, yCoordinate: 24, nodeType: "office", isAccessible: true, isActive: true },
  { id: "principal", name: "Principal Office", buildingId: "admin", buildingName: "Administration Block", floorId: "admin-f1", floorName: "First Floor", latitude: 13.02238, longitude: 74.98136, xCoordinate: 22, yCoordinate: 19, nodeType: "office", isAccessible: false, isActive: true },
  { id: "exam", name: "Examination Cell", buildingId: "admin", buildingName: "Administration Block", floorId: "admin-g", floorName: "Ground Floor", latitude: 13.02236, longitude: 74.98110, xCoordinate: 8, yCoordinate: 19, nodeType: "office", isAccessible: true, isActive: true },
  { id: "library-entry", name: "Library Entrance", buildingId: "central", buildingName: "Central Learning Block", floorId: "central-g", floorName: "Ground Floor", latitude: 13.02233, longitude: 74.98183, xCoordinate: 47, yCoordinate: 27, nodeType: "entrance", isAccessible: true, isActive: true },
  { id: "library", name: "Central Library", buildingId: "central", buildingName: "Central Learning Block", floorId: "central-g", floorName: "Ground Floor", latitude: 13.02248, longitude: 74.98192, xCoordinate: 54, yCoordinate: 22, nodeType: "facility", isAccessible: true, isActive: true },
  { id: "seminar", name: "Seminar Hall", buildingId: "central", buildingName: "Central Learning Block", floorId: "central-f1", floorName: "First Floor", latitude: 13.02258, longitude: 74.98182, xCoordinate: 48, yCoordinate: 15, nodeType: "facility", isAccessible: false, isActive: true },
  { id: "auditorium", name: "Auditorium", buildingId: "central", buildingName: "Central Learning Block", floorId: "central-g", floorName: "Ground Floor", latitude: 13.02220, longitude: 74.98210, xCoordinate: 65, yCoordinate: 32, nodeType: "facility", isAccessible: true, isActive: true },
  { id: "cafe", name: "Cafeteria", buildingId: "central", buildingName: "Central Learning Block", floorId: "central-g", floorName: "Ground Floor", latitude: 13.02192, longitude: 74.98206, xCoordinate: 64, yCoordinate: 48, nodeType: "facility", isAccessible: true, isActive: true },
  { id: "cse-entry", name: "Computing Block Entrance", buildingId: "cse", buildingName: "Computing & Innovation Block", floorId: "cse-g", floorName: "Ground Floor", latitude: 13.02192, longitude: 74.98190, xCoordinate: 52, yCoordinate: 50, nodeType: "entrance", isAccessible: true, isActive: true },
  { id: "cs-dept", name: "Computer Science Department", buildingId: "cse", buildingName: "Computing & Innovation Block", floorId: "cse-g", floorName: "Ground Floor", latitude: 13.02175, longitude: 74.98192, xCoordinate: 54, yCoordinate: 60, nodeType: "office", isAccessible: true, isActive: true },
  { id: "cse-lab", name: "CSE Laboratory", buildingId: "cse", buildingName: "Computing & Innovation Block", floorId: "cse-g", floorName: "Ground Floor", latitude: 13.02168, longitude: 74.98208, xCoordinate: 64, yCoordinate: 65, nodeType: "lab", isAccessible: true, isActive: true },
  { id: "ai-lab", name: "AI Lab", buildingId: "cse", buildingName: "Computing & Innovation Block", floorId: "cse-f1", floorName: "First Floor", latitude: 13.02156, longitude: 74.98203, xCoordinate: 61, yCoordinate: 73, nodeType: "lab", isAccessible: false, isActive: true },
  { id: "innovation", name: "Innovation Lab", buildingId: "cse", buildingName: "Computing & Innovation Block", floorId: "cse-f1", floorName: "First Floor", latitude: 13.02147, longitude: 74.98185, xCoordinate: 50, yCoordinate: 78, nodeType: "lab", isAccessible: true, isActive: true },
  { id: "cse-stairs", name: "CSE Staircase", buildingId: "cse", buildingName: "Computing & Innovation Block", floorId: "cse-g", floorName: "Ground Floor", latitude: 13.02176, longitude: 74.98178, xCoordinate: 45, yCoordinate: 60, nodeType: "staircase", isAccessible: false, isActive: true },
  { id: "cse-f1", name: "CSE First-Floor Junction", buildingId: "cse", buildingName: "Computing & Innovation Block", floorId: "cse-f1", floorName: "First Floor", latitude: 13.02165, longitude: 74.98175, xCoordinate: 43, yCoordinate: 66, nodeType: "junction", isAccessible: false, isActive: true },
  { id: "hostel", name: "Student Hostel", buildingId: null, buildingName: "Campus Grounds", floorId: null, floorName: "Outdoor", latitude: 13.02135, longitude: 74.98172, xCoordinate: 40, yCoordinate: 86, nodeType: "facility", isAccessible: true, isActive: true },
  { id: "sports", name: "Sports Complex", buildingId: null, buildingName: "Campus Grounds", floorId: null, floorName: "Outdoor", latitude: 13.02130, longitude: 74.98120, xCoordinate: 12, yCoordinate: 93, nodeType: "facility", isAccessible: true, isActive: true },
  { id: "research", name: "Research Centre", buildingId: "cse", buildingName: "Computing & Innovation Block", floorId: "cse-f1", floorName: "First Floor", latitude: 13.02142, longitude: 74.98210, xCoordinate: 66, yCoordinate: 82, nodeType: "lab", isAccessible: true, isActive: true },
];

const edge = (id: string, sourceNodeId: string, destinationNodeId: string, distance: number, edgeType: CampusEdge["edgeType"] = "walkway", isAccessible = true): CampusEdge => ({ id, sourceNodeId, destinationNodeId, distance, estimatedTime: Math.round(distance / WALKING_SPEED_METERS_PER_SECOND), isBidirectional: true, isBlocked: false, isAccessible, edgeType });

export const campusEdges: CampusEdge[] = [
  edge("e01", "gate", "reception", 35), edge("e02", "gate", "parking", 44), edge("e03", "reception", "square", 52), edge("e04", "reception", "admin-entry", 44),
  edge("e05", "admin-entry", "admin-office", 24, "corridor"), edge("e06", "admin-office", "principal", 18, "stairs", false), edge("e07", "admin-office", "exam", 25, "corridor"), edge("e08", "square", "library-entry", 42),
  edge("e09", "library-entry", "library", 26, "corridor"), edge("e10", "library", "seminar", 22, "stairs", false), edge("e11", "library-entry", "auditorium", 47), edge("e12", "square", "cafe", 46),
  edge("e13", "cafe", "auditorium", 38), edge("e14", "square", "cse-entry", 39), edge("e15", "cse-entry", "cs-dept", 28, "corridor"), edge("e16", "cs-dept", "cse-lab", 24, "corridor"),
  edge("e17", "cse-lab", "ai-lab", 21, "stairs", false), edge("e18", "cs-dept", "cse-stairs", 20, "corridor"), edge("e19", "cse-stairs", "cse-f1", 18, "stairs", false), edge("e20", "cse-f1", "ai-lab", 25, "corridor"),
  edge("e21", "cse-f1", "innovation", 27, "corridor"), edge("e22", "innovation", "research", 26, "corridor"), edge("e23", "ai-lab", "research", 19, "corridor"), edge("e24", "cse-entry", "hostel", 82),
  edge("e25", "hostel", "sports", 58), edge("e26", "parking", "sports", 61), edge("e27", "parking", "cse-entry", 74), edge("e28", "square", "hostel", 91),
  edge("e29", "gate", "cafe", 98), edge("e30", "auditorium", "cse-entry", 44), edge("e31", "library-entry", "cse-entry", 54), edge("e32", "reception", "library-entry", 69),
  edge("e33", "admin-entry", "library-entry", 63), edge("e34", "cafe", "cse-entry", 40),
];

export const destinations: Destination[] = [
  { id: "d1", nodeId: "gate", name: "Main Gate", category: "Transport", buildingId: null, buildingName: "Campus Grounds", floorName: "Outdoor", description: "Primary visitor entry point and campus landmark.", accessibilityInfo: "Step-free access", isActive: true },
  { id: "d2", nodeId: "admin-office", name: "Administrative Block", category: "Administration", buildingId: "admin", buildingName: "Administration Block", floorName: "Ground Floor", description: "Admissions, administrative support, and reception services.", roomNumber: "A-101", accessibilityInfo: "Ramp at entrance", isActive: true },
  { id: "d3", nodeId: "principal", name: "Principal Office", category: "Administration", buildingId: "admin", buildingName: "Administration Block", floorName: "First Floor", description: "Office of the campus principal.", roomNumber: "A-201", accessibilityInfo: "Stair access in current sample graph", isActive: true },
  { id: "d4", nodeId: "exam", name: "Examination Cell", category: "Administration", buildingId: "admin", buildingName: "Administration Block", floorName: "Ground Floor", description: "Examination services and academic records.", roomNumber: "A-104", accessibilityInfo: "Step-free corridor", isActive: true },
  { id: "d5", nodeId: "cs-dept", name: "Computer Science Department", category: "Academic", buildingId: "cse", buildingName: "Computing & Innovation Block", floorName: "Ground Floor", description: "Faculty offices and the Computer Science department reception.", roomNumber: "C-102", accessibilityInfo: "Step-free entrance", isActive: true },
  { id: "d6", nodeId: "cse-lab", name: "CSE Laboratory", category: "Academic", buildingId: "cse", buildingName: "Computing & Innovation Block", floorName: "Ground Floor", description: "General computer science laboratory.", roomNumber: "C-108", accessibilityInfo: "Step-free corridor", isActive: true },
  { id: "d7", nodeId: "ai-lab", name: "AI Lab", category: "Academic", buildingId: "cse", buildingName: "Computing & Innovation Block", floorName: "First Floor", description: "Artificial intelligence and machine learning laboratory.", roomNumber: "C-205", accessibilityInfo: "Stair access in current sample graph", isActive: true },
  { id: "d8", nodeId: "innovation", name: "Innovation Lab", category: "Academic", buildingId: "cse", buildingName: "Computing & Innovation Block", floorName: "First Floor", description: "Prototyping and student innovation workspace.", roomNumber: "C-211", accessibilityInfo: "Step-free route supported through accessible graph links", isActive: true },
  { id: "d9", nodeId: "research", name: "Research Centre", category: "Academic", buildingId: "cse", buildingName: "Computing & Innovation Block", floorName: "First Floor", description: "Interdisciplinary research and project collaboration space.", roomNumber: "C-214", accessibilityInfo: "Step-free route supported through accessible graph links", isActive: true },
  { id: "d10", nodeId: "library", name: "Central Library", category: "Facility", buildingId: "central", buildingName: "Central Learning Block", floorName: "Ground Floor", description: "Collections, quiet study, and service desk.", roomNumber: "L-102", accessibilityInfo: "Step-free entrance", isActive: true },
  { id: "d11", nodeId: "seminar", name: "Seminar Hall", category: "Facility", buildingId: "central", buildingName: "Central Learning Block", floorName: "First Floor", description: "Talks, events, and project presentations.", roomNumber: "L-201", accessibilityInfo: "Stair access in current sample graph", isActive: true },
  { id: "d12", nodeId: "auditorium", name: "Auditorium", category: "Facility", buildingId: "central", buildingName: "Central Learning Block", floorName: "Ground Floor", description: "Large-capacity campus event venue.", roomNumber: "L-110", accessibilityInfo: "Step-free entrance", isActive: true },
  { id: "d13", nodeId: "cafe", name: "Cafeteria", category: "Facility", buildingId: "central", buildingName: "Central Learning Block", floorName: "Ground Floor", description: "Food and refreshments for students and visitors.", roomNumber: "L-115", accessibilityInfo: "Step-free entrance", isActive: true },
  { id: "d14", nodeId: "hostel", name: "Student Hostel", category: "Accommodation", buildingId: null, buildingName: "Campus Grounds", floorName: "Outdoor", description: "Student accommodation precinct.", accessibilityInfo: "Outdoor paved route", isActive: true },
  { id: "d15", nodeId: "parking", name: "Parking Area", category: "Transport", buildingId: null, buildingName: "Campus Grounds", floorName: "Outdoor", description: "Visitor and staff parking area.", accessibilityInfo: "Outdoor paved route", isActive: true },
  { id: "d16", nodeId: "sports", name: "Sports Complex", category: "Facility", buildingId: null, buildingName: "Campus Grounds", floorName: "Outdoor", description: "Outdoor recreational and sports facilities.", accessibilityInfo: "Outdoor paved route", isActive: true },
];

export const getNode = (id: string) => campusNodes.find(node => node.id === id);
export const getDestination = (id: string) => destinations.find(destination => destination.id === id);
