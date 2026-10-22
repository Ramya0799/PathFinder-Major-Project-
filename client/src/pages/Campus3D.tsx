import { TopNav } from "@/components/TopNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveAssistantRouteLaunch } from "@/lib/assistantRouteLaunch";
import { trpc } from "@/lib/trpc";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import {
  campus3dBuildings,
  findApprovedCampus3DModelForZone,
  findCampus3DBuildingForDestination,
  type Campus3DBuilding,
} from "@shared/campus3d";
import { campusEdges, campusNodes, destinations, getNode } from "@shared/pathfinder";
import { calculateRoute, createRouteInstructions } from "@shared/routing";
import { deriveRouteProgress } from "@shared/route-progress";
import { readLiveNavigationSnapshot, writeLiveNavigationSnapshot, type LiveNavigationSnapshot } from "@shared/live-navigation";
import { officialCampusGallery } from "@shared/campusGallery";
import {
  AlertTriangle,
  ArrowLeft,
  Box,
  BoxSelect,
  Building2,
  Compass,
  ExternalLink,
  Layers3,
  Map as MapIcon,
  MapPinned,
  Maximize2,
  Navigation,
  RotateCcw,
  ScanLine,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Color, Vector3 } from "three";
import { Link, useLocation } from "wouter";

type ApprovedCampusModel = {
  zoneId: string;
  modelUrl: string;
  scale: string | number;
  rotationY: string | number;
};
type PublicIndoorLocation = {
  id: number;
  zoneId: string;
  name: string;
  buildingLabel: string;
  floorLabel: string;
  roomLabel: string;
  roomType: string;
  routeNodeExternalId: string | null;
  searchAliases: string | null;
  commonSearchTerms: string | null;
  description: string | null;
  accessibilityInfo: string | null;
};
type PublicFloorPlanOverlay = {
  id: number;
  zoneId: string;
  buildingLabel: string;
  floorLabel: string;
  title: string;
  isPriorityOffice: boolean;
  overlayUrl: string;
  sourceReference: string;
};
type PublicFloorPlanMarker = {
  id: number;
  overlayId: number;
  indoorLocationId: number;
  label: string;
  xPercent: number;
  yPercent: number;
  routeNodeExternalId: string | null;
};

function CampusMassing({
  building,
  selected,
  onSelect,
}: {
  building: Campus3DBuilding;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [width, height, depth] = building.dimensions;
  const facade =
    building.id === "learning-library"
      ? "#d7c8ad"
      : building.id === "visitor-services"
        ? "#efe7d3"
        : building.id === "student-facilities"
          ? "#dfd8c8"
          : "#e6e1d6";
  const roof = building.id === "visitor-services" ? "#b56a45" : "#934c36";
  const window = "#294653";
  const glow = new Color(building.accent);
  return (
    <group
      name={`fallback-massing-${building.id}`}
      position={[building.position[0], height / 2, building.position[2]]}
      onClick={event => {
        event.stopPropagation();
        onSelect(building.id);
      }}
      onPointerOver={event => {
        event.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      {selected && (
        <mesh position={[0, -height / 2 + 0.045, 0]} receiveShadow>
          <boxGeometry args={[width * 1.18, 0.08, depth * 1.18]} />
          <meshStandardMaterial
            color={glow}
            emissive={glow}
            emissiveIntensity={0.35}
            roughness={0.72}
            metalness={0.02}
          />
        </mesh>
      )}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={facade}
          roughness={0.78}
          metalness={0.02}
          emissive={hovered ? glow : new Color("#000000")}
          emissiveIntensity={hovered ? 0.045 : 0}
        />
      </mesh>
      <mesh
        position={[0, height / 2 + 0.15, 0]}
        rotation={[0, Math.PI / 4, 0]}
        castShadow
      >
        <boxGeometry
          args={[
            Math.max(width * 0.82, 0.9),
            0.22,
            Math.max(depth * 0.82, 0.9),
          ]}
        />
        <meshStandardMaterial color={roof} roughness={0.9} metalness={0.01} />
      </mesh>
      {Array.from({ length: Math.max(2, Math.floor(width)) }).map(
        (_, index) => (
          <mesh
            key={index}
            position={[-width / 2 + 0.5 + index * 0.9, 0.1, depth / 2 + 0.012]}
          >
            <planeGeometry args={[0.46, Math.max(0.38, height * 0.34)]} />
            <meshStandardMaterial
              color={window}
              emissive="#3aa6b8"
              emissiveIntensity={0.08}
              roughness={0.3}
            />
          </mesh>
        )
      )}
    </group>
  );
}

function ApprovedModelAsset({
  building,
  model,
  onSelect,
}: {
  building: Campus3DBuilding;
  model: ApprovedCampusModel;
  onSelect: (id: string) => void;
}) {
  const { scene } = useGLTF(model.modelUrl);
  const asset = useMemo(() => scene.clone(true), [scene]);
  return (
    <group
      name={`approved-model-${building.id}`}
      position={building.position}
      scale={Number(model.scale)}
      rotation={[0, (Number(model.rotationY) * Math.PI) / 180, 0]}
      onClick={(event: { stopPropagation: () => void }) => {
        event.stopPropagation();
        onSelect(building.id);
      }}
      onPointerOver={() => {
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      <primitive object={asset} />
    </group>
  );
}

function CampusCirculationGuide() {
  const paths = [
    [-3.25, 0.04, 0.9, 0.55, 4.7, 0.16],
    [1.1, 0.045, -0.4, 0.55, 4.7, 0.16],
    [3.8, 0.05, 2.8, 0.55, 4.7, 0.16],
    [-0.9, 0.055, 3.75, 0.55, 4.7, 0.16],
  ] as const;
  return (
    <group
      name="illustrative-campus-circulation"
      rotation={[0, Math.PI / 4, 0]}
    >
      <mesh position={[0, 0.035, 1.9]} receiveShadow>
        <circleGeometry args={[1.35, 32]} />
        <meshStandardMaterial
          color="#b8aa8e"
          roughness={0.92}
          metalness={0.01}
        />
      </mesh>
      {paths.map(([x, y, z, width, length, height], index) => (
        <mesh
          key={index}
          position={[x * 0.16, y, z * 0.16]}
          rotation={[-Math.PI / 2, 0, index % 2 ? 0.2 : -0.2]}
          receiveShadow
        >
          <planeGeometry args={[width, length]} />
          <meshStandardMaterial
            color="#aaa79a"
            roughness={0.95}
            metalness={0.01}
          />
        </mesh>
      ))}
      <mesh position={[0, 0.16, 1.9]} castShadow>
        <cylinderGeometry args={[0.18, 0.18, 0.24, 16]} />
        <meshStandardMaterial color="#6d4a34" roughness={0.82} />
      </mesh>
    </group>
  );
}

function DemoFloorPlanPreview({ zoneTitle }: { zoneTitle: string }) {
  const demoRooms = [
    "Demo room A",
    "Demo room B",
    "Unassigned room",
    "Test commons",
  ];
  return (
    <section
      aria-label="Staged demo floor plan"
      className="mt-5 rounded-[2rem] border border-amber-300/25 bg-amber-300/[0.045] p-5 shadow-xl"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Layers3 className="h-5 w-5 text-amber-200" />
            <h2 className="font-display text-xl font-bold">
              Staged floor-plan preview
            </h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            A safe dummy floor experience for testing the explorer UI. It is not
            an AIET plan and contains no real room, office, coordinate, or route
            assignment.
          </p>
        </div>
        <Badge className="border border-amber-300/30 bg-amber-300/10 text-amber-100 hover:bg-amber-300/10">
          Demo only · no routing
        </Badge>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="relative overflow-hidden rounded-2xl border border-amber-100/20 bg-[#1c2930] p-4">
          <div className="absolute left-4 top-4 rounded-full border border-white/15 bg-slate-950/70 px-3 py-1 text-xs font-semibold text-amber-100">
            {zoneTitle} · Demo Level 1
          </div>
          <svg
            viewBox="0 0 720 360"
            className="mt-7 h-auto w-full"
            role="img"
            aria-label={`Fictional demo floor plan for ${zoneTitle}`}
          >
            <rect
              x="24"
              y="24"
              width="672"
              height="312"
              rx="18"
              fill="#d8d0bd"
            />
            <rect
              x="44"
              y="44"
              width="190"
              height="120"
              rx="8"
              fill="#eee7d8"
              stroke="#8b7258"
              strokeWidth="3"
            />
            <rect
              x="250"
              y="44"
              width="190"
              height="120"
              rx="8"
              fill="#eee7d8"
              stroke="#8b7258"
              strokeWidth="3"
            />
            <rect
              x="456"
              y="44"
              width="220"
              height="120"
              rx="8"
              fill="#eee7d8"
              stroke="#8b7258"
              strokeWidth="3"
            />
            <rect
              x="44"
              y="184"
              width="300"
              height="132"
              rx="8"
              fill="#eee7d8"
              stroke="#8b7258"
              strokeWidth="3"
            />
            <rect
              x="360"
              y="184"
              width="316"
              height="132"
              rx="8"
              fill="#eee7d8"
              stroke="#8b7258"
              strokeWidth="3"
            />
            <path
              d="M234 104h16M440 104h16M344 250h16"
              stroke="#9a8062"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <circle
              cx="360"
              cy="174"
              r="26"
              fill="#b7a585"
              stroke="#735c45"
              strokeWidth="3"
            />
            <text
              x="139"
              y="105"
              textAnchor="middle"
              fill="#425058"
              fontSize="18"
              fontWeight="700"
            >
              DEMO A
            </text>
            <text
              x="345"
              y="105"
              textAnchor="middle"
              fill="#425058"
              fontSize="18"
              fontWeight="700"
            >
              DEMO B
            </text>
            <text
              x="566"
              y="105"
              textAnchor="middle"
              fill="#425058"
              fontSize="18"
              fontWeight="700"
            >
              TEST C
            </text>
            <text
              x="194"
              y="254"
              textAnchor="middle"
              fill="#425058"
              fontSize="18"
              fontWeight="700"
            >
              COMMONS
            </text>
            <text
              x="518"
              y="254"
              textAnchor="middle"
              fill="#425058"
              fontSize="18"
              fontWeight="700"
            >
              UNASSIGNED
            </text>
            <text
              x="360"
              y="180"
              textAnchor="middle"
              fill="#433a2b"
              fontSize="12"
              fontWeight="700"
            >
              NODE
            </text>
          </svg>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-amber-100">
            Test fixture
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Use this preview to test floor switching, zoom framing, and future
            marker UI before authorised plans arrive.
          </p>
          <div className="mt-4 space-y-2">
            {demoRooms.map(room => (
              <div
                key={room}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300"
              >
                <span>{room}</span>
                <span className="text-amber-200">Demo</span>
              </div>
            ))}
          </div>
          <p className="mt-4 flex gap-2 text-xs leading-5 text-amber-100">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Do not use this drawing for wayfinding or safety decisions.
          </p>
        </div>
      </div>
    </section>
  );
}

function guidanceDirection(instruction: string) {
  const normalized = instruction.toLocaleLowerCase();
  if (normalized.includes("arrive") || normalized.includes("reached")) return "arrive" as const;
  if (normalized.includes("left")) return "left" as const;
  if (normalized.includes("right")) return "right" as const;
  return "straight" as const;
}

function ModelLoadingPlaceholder({ building }: { building: Campus3DBuilding }) {
  return (
    <group name={`model-loading-${building.id}`} position={building.position}>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[building.dimensions[0] * 0.9, 0.12, building.dimensions[2] * 0.9]} />
        <meshStandardMaterial color="#38bdf8" emissive="#22d3ee" emissiveIntensity={0.25} transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

function FocusControls({
  building,
  sceneMode,
  guidanceDirection: activeGuidanceDirection,
}: {
  building: Campus3DBuilding;
  sceneMode: "model" | "site" | "street";
  guidanceDirection?: "left" | "right" | "straight" | "arrive";
}) {
  const controls = useRef<any>(null);
  const { camera } = useThree();
  const desiredPosition = useMemo(
    () => {
      if (sceneMode === "site") return new Vector3(11, 10.5, 13);
      if (sceneMode === "street") {
        const side = activeGuidanceDirection === "left" ? -1 : activeGuidanceDirection === "right" ? 1 : 0.55;
        return new Vector3(building.position[0] + side * 5.2, 3.1, building.position[2] + 5.8);
      }
      return new Vector3(building.position[0] + 7.6, 6.8, building.position[2] + 8.6);
    },
    [building.position, sceneMode, activeGuidanceDirection]
  );
  const desiredTarget = useMemo(
    () =>
      sceneMode === "site"
        ? new Vector3(0, 0.8, 1.2)
        : sceneMode === "street"
          ? new Vector3(
              building.position[0],
              Math.max(0.8, building.dimensions[1] * 0.42),
              building.position[2]
            )
          : new Vector3(
              building.position[0],
              Math.max(0.65, building.dimensions[1] / 2),
              building.position[2]
            ),
    [building.dimensions, building.position, sceneMode]
  );
  useFrame(() => {
    camera.position.lerp(desiredPosition, 0.045);
    controls.current?.target.lerp(desiredTarget, 0.065);
    controls.current?.update();
  });
  return (
    <OrbitControls
      ref={controls}
      enablePan
      enableZoom
      minDistance={7}
      maxDistance={21}
      minPolarAngle={0.35}
      maxPolarAngle={Math.PI / 2.18}
    />
  );
}

function CampusRouteGuide({ selected, progressPercent = 0, activeDirection }: { selected: Campus3DBuilding; progressPercent?: number; activeDirection?: "left" | "right" | "straight" | "arrive" }) {
  const start = new Vector3(-0.6, 0.12, 4.8);
  const destination = new Vector3(
    selected.position[0],
    0.18,
    selected.position[2]
  );
  const bend = new Vector3(destination.x, 0.15, start.z);
  const points = [start, bend, destination];
  return (
    <group name="illustrative-route-preview">
      {points.slice(0, -1).map((point, index) => {
        const next = points[index + 1];
        const dx = next.x - point.x;
        const dz = next.z - point.z;
        const length = Math.max(0.12, Math.sqrt(dx * dx + dz * dz));
        const angle = Math.atan2(dz, dx);
        return (
          <mesh
            key={`route-segment-${index}`}
            position={[(point.x + next.x) / 2, 0.1, (point.z + next.z) / 2]}
            rotation={[0, -angle, 0]}
          >
            <boxGeometry args={[length, 0.08, 0.16]} />
            <meshStandardMaterial
              color="#5eead4"
              emissive="#22d3ee"
              emissiveIntensity={0.45}
              roughness={0.3}
            />
          </mesh>
        );
      })}
      {[start, destination].map((point, index) => (
        <mesh key={`route-node-${index}`} position={point}>
          <sphereGeometry args={[index === 0 ? 0.18 : 0.24, 16, 12]} />
          <meshStandardMaterial
            color={index === 0 ? "#38bdf8" : "#fbbf24"}
            emissive={index === 0 ? "#38bdf8" : "#f59e0b"}
            emissiveIntensity={0.65}
          />
        </mesh>
      ))}
      <mesh position={[bend.x, 0.2, bend.z]} rotation={[0, activeDirection === "left" ? Math.PI / 4 : activeDirection === "right" ? -Math.PI / 4 : 0, 0]}>
        <coneGeometry args={[0.16, 0.34, 4]} />
        <meshStandardMaterial
          color="#d9f99d"
          emissive="#84cc16"
          emissiveIntensity={0.35}
        />
      </mesh>
      {progressPercent > 0 && progressPercent < 100 && (
        <mesh name="live-guidance-progress" position={[start.x + (destination.x - start.x) * progressPercent / 100, 0.22, start.z + (destination.z - start.z) * progressPercent / 100]}>
          <sphereGeometry args={[0.16, 16, 12]} />
          <meshStandardMaterial color="#fef08a" emissive="#facc15" emissiveIntensity={0.75} />
        </mesh>
      )}
    </group>
  );
}
function CampusScene({
  selected,
  onSelect,
  sceneMode,
  approvedModels,
  showRoute,
  quality,
  liveGuidance,
}: {
  selected: Campus3DBuilding;
  onSelect: (id: string) => void;
  sceneMode: "model" | "site" | "street";
  approvedModels: ApprovedCampusModel[];
  showRoute: boolean;
  quality: "high" | "medium" | "low";
  liveGuidance?: { progressPercent: number; activeDirection: "left" | "right" | "straight" | "arrive" };
}) {
  return (
    <Canvas
      camera={{ position: [10, 9, 11], fov: 42 }}
      dpr={
        quality === "high"
          ? [1, 1.5]
          : quality === "medium"
            ? [0.8, 1.15]
            : [0.65, 0.9]
      }
      shadows={quality !== "low"}
      gl={{ antialias: quality !== "low" }}
      aria-label="Interactive 3D campus massing model"
    >
      <color attach="background" args={["#071424"]} />
      <fog attach="fog" args={["#071424", 17, 33]} />
      <ambientLight intensity={1.15} />
      <directionalLight
        position={[7, 12, 6]}
        intensity={2.8}
        color="#fff4d6"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight
        position={[-6, 5, -4]}
        intensity={0.45}
        color="#b9e7ef"
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial
          color="#526b52"
          roughness={0.96}
          metalness={0.01}
        />
      </mesh>
      <CampusCirculationGuide />
      <Suspense fallback={<ModelLoadingPlaceholder building={selected} />}>
        {showRoute && <CampusRouteGuide selected={selected} progressPercent={liveGuidance?.progressPercent} activeDirection={liveGuidance?.activeDirection} />}
        {campus3dBuildings.map(building => {
          const model = findApprovedCampus3DModelForZone(building.id, approvedModels);
          const shouldLoadModel = building.id === selected.id && quality !== "low";
          return model && shouldLoadModel ? (
            <ApprovedModelAsset key={building.id} building={building} model={model} onSelect={onSelect} />
          ) : (
            <CampusMassing key={building.id} building={building} selected={building.id === selected.id} onSelect={onSelect} />
          );
        })}
      </Suspense>
      <FocusControls building={selected} sceneMode={sceneMode} guidanceDirection={liveGuidance?.activeDirection} />
    </Canvas>
  );
}

export default function Campus3D() {
  const [, setLocation] = useLocation();
  const [query] = useState(() => new URLSearchParams(window.location.search));
  const sourceNodeId = query.get("from") ?? "gate";
  const requestedDestinationId = query.get("to") ?? undefined;
  const defaultBuilding =
    findCampus3DBuildingForDestination(requestedDestinationId) ??
    campus3dBuildings[1];
  const [selectedId, setSelectedId] = useState<string>(defaultBuilding.id);
  const [sceneMode, setSceneMode] = useState<"model" | "site" | "street">(
    "model"
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOverlayId, setSelectedOverlayId] = useState<number | null>(
    null
  );
  const liveMode = query.get("live") === "1";
  const [liveGuidance, setLiveGuidance] = useState<LiveNavigationSnapshot | null>(() => liveMode ? readLiveNavigationSnapshot() : null);
  const [showRoutePreview, setShowRoutePreview] = useState(liveMode);
  const [quality, setQuality] = useState<"high" | "medium" | "low">(() => window.matchMedia?.("(max-width: 767px)").matches ? "medium" : "high");
  const [showOnboarding, setShowOnboarding] = useState(
    () => window.localStorage.getItem("pathfinder-3d-onboarding-seen") !== "1"
  );
  const selected = campus3dBuildings.find(building => building.id === selectedId) ?? defaultBuilding;
  const liveDestination = liveGuidance ? destinations.find(destination => destination.id === liveGuidance.destinationId) : undefined;
  const liveRoute = useMemo(() => {
    if (!liveGuidance || !liveDestination) return null;
    const calculated = calculateRoute(campusNodes, campusEdges, liveGuidance.sourceNodeId, liveDestination.nodeId, "auto", false);
    const nodes = calculated.nodeIds.map(getNode).filter((node): node is NonNullable<typeof node> => Boolean(node));
    return { nodes, instructions: createRouteInstructions(campusNodes, calculated.nodeIds) };
  }, [liveGuidance?.sourceNodeId, liveGuidance?.destinationId, liveDestination?.nodeId]);
  const liveProgress = liveGuidance && liveRoute ? deriveRouteProgress(liveGuidance.position, liveRoute.nodes, liveGuidance.currentWaypointIndex) : null;
  const liveInstruction = liveProgress && liveRoute ? liveRoute.instructions[Math.min(liveProgress.currentWaypointIndex, liveRoute.instructions.length - 1)] ?? liveGuidance?.currentInstruction ?? "Live route ready." : liveGuidance?.currentInstruction ?? "Live route ready.";
  const liveDirection = guidanceDirection(liveInstruction);
  const selectedReferencePhoto = useMemo(
    () =>
      officialCampusGallery.find(
        photo =>
          photo.group ===
          (selected.id === "learning-library" ? "Library" : "Campus")
      ),
    [selected.id]
  );
  const approvedModels = trpc.campus.models3d.useQuery(undefined, {
    staleTime: 60_000,
  });
  const indoorResult = trpc.campus.indoorLocations.useQuery(undefined, {
    staleTime: 60_000,
  });
  const floorPlanResult = trpc.campus.floorPlanOverlays.useQuery(undefined, {
    staleTime: 60_000,
  });
  const selectedIndoorLocations = useMemo(
    () =>
      ((indoorResult.data as PublicIndoorLocation[] | undefined) ?? []).filter(
        location => location.zoneId === selected.id
      ),
    [indoorResult.data, selected.id]
  );
  const selectedOverlays = useMemo(
    () =>
      ((floorPlanResult.data as PublicFloorPlanOverlay[] | undefined) ?? [])
        .filter(overlay => overlay.zoneId === selected.id)
        .sort(
          (first, second) =>
            Number(second.isPriorityOffice) - Number(first.isPriorityOffice)
        ),
    [floorPlanResult.data, selected.id]
  );
  const activeOverlay =
    selectedOverlays.find(overlay => overlay.id === selectedOverlayId) ??
    selectedOverlays[0];
  const markerResult = trpc.campus.floorPlanMarkers.useQuery(
    activeOverlay ? { overlayId: activeOverlay.id } : undefined,
    { staleTime: 60_000 }
  );
  const activeMarkers =
    (markerResult.data as PublicFloorPlanMarker[] | undefined) ?? [];
  const searchResults = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase();
    if (!term) return [];
    const roomHits = (
      (indoorResult.data as PublicIndoorLocation[] | undefined) ?? []
    )
      .filter(location =>
        `${location.name} ${location.buildingLabel} ${location.floorLabel} ${location.roomLabel} ${location.roomType} ${location.searchAliases ?? ""} ${location.commonSearchTerms ?? ""}`
          .toLocaleLowerCase()
          .includes(term)
      )
      .slice(0, 6)
      .map(location => ({
        kind: "room" as const,
        id: `room-${location.id}`,
        zoneId: location.zoneId,
        title: location.name,
        detail: `${location.buildingLabel} · ${location.floorLabel} · ${location.roomLabel}`,
      }));
    const buildingHits = campus3dBuildings
      .filter(building =>
        `${building.title} ${building.shortLabel} ${building.highlights.join(" ")}`
          .toLocaleLowerCase()
          .includes(term)
      )
      .slice(0, 4)
      .map(building => ({
        kind: "building" as const,
        id: `building-${building.id}`,
        zoneId: building.id,
        title: building.title,
        detail: building.shortLabel,
      }));
    return [...roomHits, ...buildingHits];
  }, [indoorResult.data, searchTerm]);

  useEffect(() => {
    const target = findCampus3DBuildingForDestination(requestedDestinationId);
    if (target) setSelectedId(target.id);
  }, [requestedDestinationId]);
  useEffect(() => {
    const target = findCampus3DBuildingForDestination(liveGuidance?.destinationId);
    if (target) setSelectedId(target.id);
  }, [liveGuidance?.destinationId]);
  useEffect(() => {
    if (!liveMode || !liveGuidance || !liveRoute?.nodes.length || !navigator.geolocation) return;
    const watcher = navigator.geolocation.watchPosition(result => {
      setLiveGuidance(previous => {
        if (!previous) return previous;
        const position = { latitude: result.coords.latitude, longitude: result.coords.longitude, accuracy: result.coords.accuracy, heading: result.coords.heading ?? undefined, speed: result.coords.speed ?? undefined };
        const progress = deriveRouteProgress(position, liveRoute.nodes, previous.currentWaypointIndex);
        const instructions = liveRoute.instructions;
        const nextInstruction = instructions[Math.min(progress.currentWaypointIndex, instructions.length - 1)] ?? previous.currentInstruction;
        const next = { ...previous, currentWaypointIndex: progress.currentWaypointIndex, totalWaypoints: progress.totalWaypoints, progressPercent: progress.progressPercent, remainingDistance: progress.remainingDistance, currentInstruction: nextInstruction, currentVoiceInstruction: nextInstruction, isComplete: progress.isComplete, position, updatedAt: Date.now() };
        writeLiveNavigationSnapshot(next);
        return next;
      });
    }, () => undefined, { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 });
    return () => navigator.geolocation.clearWatch(watcher);
  }, [liveMode, liveGuidance?.destinationId, liveGuidance?.sourceNodeId, liveRoute]);
  useEffect(() => {
    setSelectedOverlayId(null);
  }, [selected.id]);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    window.localStorage.setItem("pathfinder-3d-onboarding-seen", "1");
  };
  const selectBuilding = (id: string) => {
    setSelectedId(id);
    setShowRoutePreview(true);
    dismissOnboarding();
  };
  const startRoute = (destinationId = selected.routeDestinationId) => {
    if (!destinationId) return;
    saveAssistantRouteLaunch({
      sourceNodeId,
      destinationId,
      accessibleOnly: false,
      autoStart: false,
      voiceOn: false,
      language: "en",
    });
    setLocation("/map");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <TopNav transparent />
      <main className="container py-5 sm:py-8">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/map"
              className="inline-flex items-center gap-1 text-sm font-semibold text-cyan-200 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to 2D map
            </Link>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Badge className="border border-cyan-300/25 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/10">
                <Box className="mr-1.5 h-3.5 w-3.5" />
                3D campus explorer
              </Badge>
              <Badge className="border border-amber-300/25 bg-amber-300/10 text-amber-100 hover:bg-amber-300/10">
                Illustrative twin · survey-aware
              </Badge>
              <Badge className="border border-emerald-300/25 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/10">
                Verified campus guide
              </Badge>
            </div>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Find it. See it. Navigate it.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Explore AIET services in 3D, select a destination, and hand off to
              verified PathFinder guidance. The world is spatial; the route
              truth remains in the campus graph.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="3D camera presentation"
            >
              <Button
                variant="outline"
                onClick={() => setSceneMode("site")}
                className={`border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white ${sceneMode === "site" ? "ring-2 ring-cyan-300/60" : ""}`}
              >
                <Maximize2 className="mr-2 h-4 w-4" />
                Overview
              </Button>
              <Button
                variant="outline"
                onClick={() => setSceneMode("model")}
                className={`border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white ${sceneMode === "model" ? "ring-2 ring-cyan-300/60" : ""}`}
              >
                <BoxSelect className="mr-2 h-4 w-4" />
                Focused view
              </Button>
              <Button
                variant="outline"
                onClick={() => setSceneMode("street")}
                className={`border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white ${sceneMode === "street" ? "ring-2 ring-cyan-300/60" : ""}`}
              >
                <MapPinned className="mr-2 h-4 w-4" />
                Street view
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedId(defaultBuilding.id);
                setSceneMode("model");
              }}
              className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset focus
            </Button>
          </div>
        </div>

        <section
          aria-label="3D navigation command deck"
          className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]"
        >
          <div className="relative">
            <label className="sr-only" htmlFor="spatial-destination-search">
              Search a campus destination
            </label>
            <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-cyan-200" />
            <Input
              id="spatial-destination-search"
              value={searchTerm}
              onChange={event => {
                setSearchTerm(event.target.value);
                dismissOnboarding();
              }}
              placeholder="Where do you want to go? Search a published zone or room"
              className="h-11 border-white/15 bg-white/[0.07] pl-11 text-white placeholder:text-slate-500"
            />
            {searchTerm && searchResults.length > 0 && (
              <div className="absolute inset-x-0 top-12 z-20 overflow-hidden rounded-xl border border-white/15 bg-[#0c1d2e] p-1 shadow-2xl">
                {searchResults.slice(0, 5).map(result => (
                  <button
                    key={result.id}
                    onClick={() => {
                      selectBuilding(result.zoneId);
                      setSearchTerm("");
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-cyan-300/10"
                  >
                    <span>
                      <span className="block font-semibold text-white">
                        {result.title}
                      </span>
                      <span className="text-xs text-slate-400">
                        {result.detail}
                      </span>
                    </span>
                    <MapPinned className="h-4 w-4 text-cyan-200" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button
            onClick={() => setShowRoutePreview(visible => !visible)}
            variant="outline"
            className={`h-11 border-white/15 bg-white/[0.07] text-white hover:bg-white/10 hover:text-white ${showRoutePreview ? "ring-2 ring-cyan-300/60" : ""}`}
          >
            <Navigation className="mr-2 h-4 w-4 text-cyan-200" />
            {showRoutePreview ? "Hide route preview" : "Preview route"}
          </Button>
          <div
            className="flex h-11 items-center gap-1 rounded-xl border border-white/10 bg-white/[0.05] p-1"
            role="group"
            aria-label="3D performance quality"
          >
            <span className="px-2 text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">
              Quality
            </span>
            {(["high", "medium", "low"] as const).map(level => (
              <button
                key={level}
                onClick={() => setQuality(level)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold capitalize transition ${quality === level ? "bg-cyan-300 text-slate-950" : "text-slate-300 hover:bg-white/10"}`}
              >
                {level}
              </button>
            ))}
          </div>
        </section>
        {liveMode && (
          <section aria-live="polite" className={`mb-5 rounded-2xl border p-4 shadow-xl ${liveGuidance ? "border-cyan-300/30 bg-cyan-300/10" : "border-amber-300/30 bg-amber-300/10"}`}>
            {liveGuidance ? (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-start gap-3"><Navigation className="mt-1 h-5 w-5 text-cyan-200" /><div><p className="text-xs font-bold uppercase tracking-[.16em] text-cyan-200">Live GPS · {liveProgress?.isComplete ? "arrived" : "turn-by-turn"}</p><h2 className="mt-1 text-lg font-bold">{liveProgress?.isComplete ? `You’ve reached ${selected.title}` : liveInstruction}</h2><p className="mt-1 text-xs text-slate-300">{liveProgress?.remainingDistance ?? liveGuidance.remainingDistance} m remaining · ±{Math.round(liveGuidance.position.accuracy)} m accuracy · {liveProgress?.progressPercent ?? liveGuidance.progressPercent}% complete</p></div></div>
                <div className="min-w-40"><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-300 transition-[width] duration-700" style={{ width: `${liveProgress?.progressPercent ?? liveGuidance.progressPercent}%` }} /></div><p className="mt-2 text-right text-[10px] uppercase tracking-[.12em] text-slate-400">3D cue follows the verified graph</p></div>
              </div>
            ) : <div><p className="font-semibold text-amber-100">Live 3D guidance is unavailable</p><p className="mt-1 text-sm text-amber-50/80">Return to the map, start a verified route, and open Live 3D again. No staged coordinates are used to infer your position.</p></div>}
          </section>
        )}
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="relative min-h-[540px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#071424] shadow-2xl">
            <CampusScene
              selected={selected}
              onSelect={selectBuilding}
              sceneMode={sceneMode}
              approvedModels={approvedModels.data ?? []}
              showRoute={showRoutePreview || Boolean(liveGuidance)}
              quality={quality}
              liveGuidance={liveGuidance ? { progressPercent: liveProgress?.progressPercent ?? liveGuidance.progressPercent, activeDirection: liveDirection } : undefined}
            />
            <div className="pointer-events-none absolute right-4 top-16 hidden w-36 rounded-xl border border-white/15 bg-slate-950/75 p-2 backdrop-blur sm:block">
              <div className="mb-2 flex items-center justify-between text-[9px] font-bold uppercase tracking-[.12em] text-slate-400">
                <span>Orientation</span>
                <Compass className="h-3 w-3 text-cyan-200" />
              </div>
              <div className="relative aspect-square overflow-hidden rounded-lg border border-cyan-200/15 bg-[#122b35]">
                <div className="absolute inset-[15%] rotate-12 rounded-[30%] border border-emerald-200/30 bg-emerald-200/[0.08]" />
                <div className="absolute left-[17%] top-[68%] h-1.5 w-1.5 rounded-full bg-sky-300 shadow-[0_0_10px_#38bdf8]" />
                <div className="absolute right-[22%] top-[24%] h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_10px_#fbbf24]" />
                <div className="absolute left-[20%] top-[67%] h-px w-[62%] rotate-[-31deg] bg-cyan-300/75" />
              </div>
              <p className="mt-1.5 text-[9px] leading-4 text-slate-500">
                Illustrative orientation · not surveyed
              </p>
            </div>
            {showOnboarding && (
              <div className="absolute inset-4 z-10 flex items-center justify-center">
                <div className="max-w-sm rounded-2xl border border-cyan-300/30 bg-[#071424]/95 p-5 text-center shadow-2xl backdrop-blur">
                  <p className="text-[10px] font-bold uppercase tracking-[.18em] text-cyan-200">
                    Welcome to PathFinder 3D
                  </p>
                  <h2 className="mt-2 font-display text-xl font-bold text-white">
                    Explore the campus spatially.
                  </h2>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-left text-xs text-slate-300">
                    <div className="rounded-lg bg-white/[0.06] p-2">
                      <strong className="block text-white">Drag</strong>Rotate
                      the view
                    </div>
                    <div className="rounded-lg bg-white/[0.06] p-2">
                      <strong className="block text-white">Scroll</strong>Zoom
                      in and out
                    </div>
                    <div className="rounded-lg bg-white/[0.06] p-2">
                      <strong className="block text-white">Click</strong>Inspect
                      a zone
                    </div>
                    <div className="rounded-lg bg-white/[0.06] p-2">
                      <strong className="block text-white">Search</strong>Find a
                      destination
                    </div>
                  </div>
                  <Button
                    onClick={dismissOnboarding}
                    className="mt-4 w-full bg-cyan-300 font-bold text-slate-950 hover:bg-cyan-200"
                  >
                    Start exploring
                  </Button>
                  <button
                    onClick={dismissOnboarding}
                    className="mt-3 text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    Skip tutorial
                  </button>
                </div>
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 backdrop-blur">
                <p className="text-xs font-bold uppercase tracking-[.16em] text-cyan-200">
                  Interactive campus guide
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  Drag to rotate · scroll or pinch to zoom · select a campus
                  zone ·{" "}
                  {showRoutePreview
                    ? liveGuidance
                      ? "live route cue active"
                      : "route preview active"
                    : "click a zone to inspect"}
                </p>
              </div>
              <div className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1.5 text-xs font-semibold text-slate-200 backdrop-blur">
                {sceneMode === "model"
                  ? "Focused view"
                  : sceneMode === "street"
                    ? "Street view"
                    : "Site overview"}
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-slate-950/70 px-4 py-3 backdrop-blur">
              <div className="flex items-center gap-2 text-xs leading-5 text-slate-300">
                <Sparkles className="h-4 w-4 shrink-0 text-cyan-300" />
                {approvedModels.data?.length
                  ? "Only administrator-approved model assets appear for published campus zones. The selected model loads first so other zones stay lightweight for mobile."
                  : "An interactive wayfinding guide; the miniature paths and building massing are illustrative until AIET-authorised geometry is supplied."}
              </div>
            </div>
          </div>

          <aside className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-xl backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
                  Selected campus profile
                </p>
                <h2 className="mt-2 font-display text-2xl font-bold leading-tight">
                  {selected.title}
                </h2>
              </div>
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-300 text-slate-950">
                <BoxSelect className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              {selected.description}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-white/10 bg-slate-950/45 p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">
                  Profile
                </p>
                <p className="mt-1 text-xs font-semibold text-white">
                  {String(
                    campus3dBuildings.findIndex(
                      building => building.id === selected.id
                    ) + 1
                  ).padStart(2, "0")}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-950/45 p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">
                  Route
                </p>
                <p className="mt-1 text-xs font-semibold text-white">
                  {selected.routeDestinationId ? "Ready" : "Pending"}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-950/45 p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">
                  Model
                </p>
                <p className="mt-1 text-xs font-semibold text-white">
                  {approvedModels.data?.some(
                    model => model.zoneId === selected.id
                  )
                    ? "Approved"
                    : "Guide"}
                </p>
              </div>
            </div>
            {selectedReferencePhoto && (
              <figure className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/45">
                <div className="grid grid-cols-2">
                  <div className="relative min-h-28">
                    <img
                      src={selectedReferencePhoto.imageUrl}
                      alt={selectedReferencePhoto.alt}
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute bottom-2 left-2 rounded bg-slate-950/80 px-2 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-white">
                      Real photo
                    </span>
                  </div>
                  <div className="grid min-h-28 place-items-center border-l border-white/10 bg-gradient-to-br from-[#6d8772] to-[#263c41] p-3 text-center">
                    <Box className="h-6 w-6 text-cyan-200" />
                    <span className="mt-2 text-[10px] font-bold uppercase tracking-[.12em] text-cyan-100">
                      3D guide
                    </span>
                  </div>
                </div>
                <figcaption className="border-t border-white/10 p-3 text-xs leading-5 text-slate-300">
                  Compare this source photograph with the staged 3D guide. It
                  supports recognition only and does not claim exact surveyed
                  geometry.
                </figcaption>
              </figure>
            )}
            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 p-3">
              <p className="text-xs font-bold uppercase tracking-[.14em] text-slate-400">
                Verified content
              </p>
              <ul className="mt-2 space-y-2 text-sm text-slate-200">
                {selected.highlights.map(highlight => (
                  <li key={highlight} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
                    {highlight}
                  </li>
                ))}
              </ul>
            </div>
            <div
              className={`mt-4 rounded-2xl border p-3 text-sm ${selected.contentStatus === "official-content" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-50" : "border-amber-300/20 bg-amber-300/10 text-amber-50"}`}
            >
              {selected.contentStatus === "official-content"
                ? "Public details verified against the AIET website."
                : "Information to be updated: model geometry and precise location have not been published by AIET."}
            </div>
            <a
              href={selected.officialSource}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 transition hover:text-white"
            >
              Open official AIET source <ExternalLink className="h-4 w-4" />
            </a>
            <div className="mt-5 grid gap-2">
              <Button
                onClick={() => startRoute()}
                className="bg-cyan-300 font-bold text-slate-950 hover:bg-cyan-200"
              >
                <Navigation className="mr-2 h-4 w-4" />
                Navigate with 2D map
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation("/ar")}
                className="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <ScanLine className="mr-2 h-4 w-4" />
                Open AR guidance
              </Button>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-400">
              Route planning uses the existing PathFinder graph. AR requires
              browser camera permission and remains an assisted guidance layer.
            </p>
          </aside>
        </section>

        <section
          aria-label="Campus property index"
          className="mt-5 overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.12),transparent_37%),rgba(255,255,255,.04)] p-4 shadow-xl sm:p-5"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.16em] text-cyan-200">
                Campus property index
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold">
                Select a zone. Inspect the guide. Continue with a route.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-slate-300">
              A property-style control deck for AIET’s published campus zones.
              It stays connected to approved models and configured PathFinder
              destinations.
            </p>
          </div>
          <div
            role="tablist"
            aria-label="Campus zone selector"
            className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          >
            {campus3dBuildings.map((building, index) => (
              <button
                role="tab"
                aria-selected={building.id === selected.id}
                key={building.id}
                onClick={() => {
                  selectBuilding(building.id);
                  setSceneMode("model");
                }}
                className={`group rounded-2xl border p-4 text-left transition duration-200 ${building.id === selected.id ? "border-cyan-300/60 bg-cyan-300/10 shadow-[0_12px_32px_rgba(34,211,238,.12)]" : "border-white/10 bg-slate-950/45 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.08] motion-reduce:transform-none"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-xl text-xs font-black ${building.id === selected.id ? "bg-cyan-300 text-slate-950" : "bg-white/10 text-slate-300"}`}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">
                    {building.routeDestinationId
                      ? "Route linked"
                      : "Guide only"}
                  </span>
                </div>
                <p className="mt-5 text-xs font-bold uppercase tracking-[.14em] text-slate-400">
                  {building.shortLabel}
                </p>
                <p className="mt-1 font-semibold text-white">
                  {building.title}
                </p>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">
                  {building.highlights[0]}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section
          aria-label="Search verified rooms and buildings"
          className="mt-5 rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-xl"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-cyan-300" />
                <h2 className="font-display text-xl font-bold">
                  Find a verified room or building
                </h2>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Search the published indoor directory and campus zones. Draft,
                archived, and unverified records are never included.
              </p>
            </div>
            <div className="w-full lg:max-w-md">
              <label className="sr-only" htmlFor="campus-explorer-search">
                Search verified rooms or buildings
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="campus-explorer-search"
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                  placeholder="Search room, floor, building, or service"
                  className="border-white/15 bg-slate-950/55 pl-9 pr-9 text-white placeholder:text-slate-500"
                />
                {searchTerm && (
                  <button
                    aria-label="Clear verified location search"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2 top-2 rounded p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
          {searchTerm ? (
            <div
              role="list"
              className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3"
            >
              {searchResults.length ? (
                searchResults.map(result => (
                  <button
                    role="listitem"
                    key={result.id}
                    onClick={() => {
                      setSelectedId(result.zoneId);
                      setSceneMode("model");
                    }}
                    className="rounded-xl border border-white/10 bg-slate-950/45 p-3 text-left transition hover:border-cyan-300/50 hover:bg-cyan-300/10"
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.12em] text-cyan-200">
                      {result.kind === "room" ? (
                        <MapPinned className="h-3.5 w-3.5" />
                      ) : (
                        <Building2 className="h-3.5 w-3.5" />
                      )}
                      {result.kind}
                    </div>
                    <p className="mt-2 font-semibold text-white">
                      {result.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      {result.detail}
                    </p>
                  </button>
                ))
              ) : (
                <p className="rounded-xl border border-dashed border-white/15 bg-slate-950/35 p-4 text-sm text-slate-300">
                  No published, verified rooms or buildings match “{searchTerm}
                  ”. Try a building name, room number, floor, or service.
                </p>
              )}
            </div>
          ) : null}
        </section>

        <section
          aria-label="Verified indoor locations"
          className="mt-5 rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-xl"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <MapPinned className="h-5 w-5 text-cyan-300" />
                <h2 className="font-display text-xl font-bold">
                  Verified floors and rooms
                </h2>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Floor and room details are displayed only when published by an
                AIET administrator. A route action appears only where the
                location is linked to an existing PathFinder anchor.
              </p>
            </div>
            <Badge className="border border-cyan-300/25 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/10">
              {selectedIndoorLocations.length} verified{" "}
              {selectedIndoorLocations.length === 1 ? "location" : "locations"}
            </Badge>
          </div>
          {indoorResult.isLoading ? (
            <p className="mt-5 text-sm text-slate-300">
              Loading verified indoor locations…
            </p>
          ) : selectedIndoorLocations.length ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {selectedIndoorLocations.map(location => (
                <article
                  key={location.id}
                  className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"
                >
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{location.roomType}</Badge>
                    <Badge
                      variant="outline"
                      className="border-white/15 text-slate-200"
                    >
                      {location.floorLabel}
                    </Badge>
                  </div>
                  <h3 className="mt-3 font-semibold text-white">
                    {location.name}
                  </h3>
                  <p className="mt-1 text-sm text-slate-300">
                    {location.buildingLabel} · {location.roomLabel}
                  </p>
                  {location.description && (
                    <p className="mt-3 text-sm leading-5 text-slate-400">
                      {location.description}
                    </p>
                  )}
                  {location.accessibilityInfo && (
                    <p className="mt-3 rounded-lg border border-cyan-300/15 bg-cyan-300/5 p-2 text-xs leading-5 text-cyan-50">
                      Accessibility: {location.accessibilityInfo}
                    </p>
                  )}
                  {location.routeNodeExternalId ? (
                    <Button
                      size="sm"
                      onClick={() =>
                        startRoute(location.routeNodeExternalId ?? undefined)
                      }
                      className="mt-4 bg-cyan-300 text-slate-950 hover:bg-cyan-200"
                    >
                      <Navigation className="mr-1.5 h-3.5 w-3.5" />
                      Route to this location
                    </Button>
                  ) : (
                    <p className="mt-4 flex gap-2 text-xs leading-5 text-amber-100">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      Location verified; an indoor route anchor has not yet been
                      published.
                    </p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-white/20 bg-slate-950/40 p-5 text-sm leading-6 text-slate-300">
              <AlertTriangle className="mb-2 h-5 w-5 text-amber-200" />
              No verified indoor floor or room entries have been published for
              this campus zone. The administrator workspace keeps drafts private
              until an authorised source confirms them.
            </div>
          )}
        </section>

        <section
          aria-label="Verified floor-plan overlays"
          className="mt-5 rounded-[2rem] border border-cyan-300/20 bg-cyan-400/[0.045] p-5 shadow-xl"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Layers3 className="h-5 w-5 text-cyan-300" />
                <h2 className="font-display text-xl font-bold">
                  Verified floor-plan overlays
                </h2>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Published campus-office plans can be viewed beside the 3D guide.
                Route markers appear only when an administrator has linked a
                verified room to an existing PathFinder route step.
              </p>
            </div>
            <Badge className="border border-cyan-300/25 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/10">
              {selectedOverlays.length} approved plan
              {selectedOverlays.length === 1 ? "" : "s"}
            </Badge>
          </div>
          {floorPlanResult.isLoading ? (
            <p className="mt-5 text-sm text-slate-300">
              Loading approved floor plans…
            </p>
          ) : selectedOverlays.length ? (
            <div className="mt-5 grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
              <div className="space-y-2">
                {selectedOverlays.map(overlay => (
                  <button
                    key={overlay.id}
                    onClick={() => setSelectedOverlayId(overlay.id)}
                    className={`w-full rounded-xl border p-3 text-left transition ${activeOverlay?.id === overlay.id ? "border-cyan-300/60 bg-cyan-300/10" : "border-white/10 bg-slate-950/40 hover:border-white/25"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-white">
                        {overlay.title}
                      </p>
                      {overlay.isPriorityOffice && (
                        <Badge className="border border-amber-300/25 bg-amber-300/10 text-[10px] text-amber-100 hover:bg-amber-300/10">
                          Priority office
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {overlay.buildingLabel} · {overlay.floorLabel}
                    </p>
                  </button>
                ))}
              </div>
              {activeOverlay && (
                <figure className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/55">
                  <div className="relative">
                    <img
                      src={activeOverlay.overlayUrl}
                      alt={`Verified floor plan: ${activeOverlay.title}`}
                      className="max-h-[520px] w-full object-contain"
                    />
                    {activeMarkers.map(marker => (
                      <button
                        key={marker.id}
                        aria-label={`Navigate to ${marker.label} from the floor plan`}
                        title={`Route to ${marker.label}`}
                        onClick={() =>
                          marker.routeNodeExternalId &&
                          startRoute(marker.routeNodeExternalId)
                        }
                        disabled={!marker.routeNodeExternalId}
                        style={{
                          left: `${marker.xPercent}%`,
                          top: `${marker.yPercent}%`,
                        }}
                        className="group absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-950 bg-cyan-300 p-1.5 text-slate-950 shadow-lg transition hover:scale-110 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <MapPinned className="h-4 w-4" />
                        <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 hidden w-max max-w-44 -translate-x-1/2 rounded-md bg-slate-950 px-2 py-1 text-xs font-semibold text-white shadow-xl group-hover:block">
                          {marker.label}
                        </span>
                      </button>
                    ))}
                  </div>
                  <figcaption className="border-t border-white/10 p-3 text-xs leading-5 text-slate-300">
                    Verified source: {activeOverlay.sourceReference}.{" "}
                    {activeMarkers.length
                      ? `${activeMarkers.length} configured route marker${activeMarkers.length === 1 ? "" : "s"}; select a pin to open the linked route.`
                      : "No route markers have been published for this floor plan yet."}{" "}
                    Follow current on-site access and safety signage.
                  </figcaption>
                </figure>
              )}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-white/20 bg-slate-950/40 p-5 text-sm leading-6 text-slate-300">
              <Layers3 className="mb-2 h-5 w-5 text-cyan-200" />
              No approved floor-plan overlay has been published for this campus
              zone. Administrators can upload one after campus-office
              verification.
            </div>
          )}
        </section>

        <DemoFloorPlanPreview zoneTitle={selected.title} />

        <section
          aria-label="Official AIET visual archive"
          className="mt-5 rounded-[2rem] border border-emerald-300/20 bg-emerald-300/[0.045] p-5 shadow-xl"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-200" />
                <h2 className="font-display text-xl font-bold">
                  Official AIET visual archive
                </h2>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Source-attributed library and campus-life imagery from AIET’s
                public galleries. These images support recognition and
                exploration only; they are not floor plans, surveyed building
                geometry, or route instructions.
              </p>
            </div>
            <Badge className="border border-emerald-300/25 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/10">
              {officialCampusGallery.length} official images
            </Badge>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {officialCampusGallery.map(item => (
              <figure
                key={item.id}
                className="group overflow-hidden rounded-2xl border border-white/10 bg-slate-950/55 shadow-lg"
              >
                <img
                  src={item.imageUrl}
                  alt={item.alt}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-[1.025] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                />
                <figcaption className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      variant="outline"
                      className="border-white/15 text-slate-200"
                    >
                      {item.group}
                    </Badge>
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open the source for ${item.title}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-200 transition hover:text-white"
                    >
                      Source <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                  <h3 className="mt-3 font-semibold text-white">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    Published by {item.sourceLabel}. Visual reference only.
                  </p>
                  {item.routeDestinationId && (
                    <Button
                      size="sm"
                      onClick={() => startRoute(item.routeDestinationId)}
                      className="mt-3 bg-emerald-300 text-slate-950 hover:bg-emerald-200"
                    >
                      <Navigation className="mr-1.5 h-3.5 w-3.5" />
                      Navigate to Central Library
                    </Button>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section
          aria-label="Campus zones"
          className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {campus3dBuildings.map(building => (
            <button
              key={building.id}
              onClick={() => setSelectedId(building.id)}
              className={`rounded-2xl border p-4 text-left transition duration-200 ${building.id === selected.id ? "border-cyan-300/60 bg-cyan-300/10 shadow-[0_12px_32px_rgba(34,211,238,.12)]" : "border-white/10 bg-white/[0.04] hover:border-white/25 hover:bg-white/[0.08]"}`}
            >
              <p className="text-xs font-bold uppercase tracking-[.14em] text-slate-400">
                {building.shortLabel}
              </p>
              <p className="mt-1 font-semibold text-white">{building.title}</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                {building.contentStatus === "official-content"
                  ? "Official public content"
                  : "Information to be updated"}
              </p>
            </button>
          ))}
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <MapIcon className="h-5 w-5 text-cyan-300" />
            <h2 className="mt-3 font-semibold">2D route continuity</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Published room anchors use the existing route engine, preserving
              live progress, accessibility preference, and spoken guidance.
            </p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <Compass className="h-5 w-5 text-cyan-300" />
            <h2 className="mt-3 font-semibold">Mobile-first exploration</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              The canvas supports one-finger rotation and two-finger zoom or
              pan, while zone cards and room cards remain keyboard-operable
              alternatives.
            </p>
          </article>
          <article className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] p-5">
            <AlertTriangle className="h-5 w-5 text-amber-200" />
            <h2 className="mt-3 font-semibold">Verified data boundary</h2>
            <p className="mt-2 text-sm leading-6 text-amber-50/80">
              Unverified room details, drafts, and unapproved models are
              deliberately excluded from the public guide.
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}
