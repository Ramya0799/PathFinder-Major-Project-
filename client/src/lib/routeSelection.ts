import { useCallback, useEffect, useRef, useState } from "react";
import { campusEdges, campusNodes, destinations, getNode } from "@shared/pathfinder";

export const ROUTE_SELECTION_EVENT = "pathfinder:route-selection-change";
export const DEFAULT_SOURCE_NODE_ID = "gate";
export const DEFAULT_DESTINATION_ID = "d7";

export type RouteSelection = { sourceNodeId: string; destinationId: string };
type RouteSelectionPatch = Partial<RouteSelection>;

function validSourceId(id: string | null | undefined): id is string {
  if (!id) return false;
  const node = getNode(id);
  return Boolean(node?.isActive && Number.isFinite(node.latitude) && Number.isFinite(node.longitude));
}

function validDestinationId(id: string | null | undefined): id is string {
  if (!id) return false;
  const destination = destinations.find((item) => item.id === id && item.isActive);
  const node = getNode(destination?.nodeId ?? id);
  return Boolean(node?.isActive && Number.isFinite(node.latitude) && Number.isFinite(node.longitude) && campusEdges.some((edge) => !edge.isBlocked && (edge.sourceNodeId === node.id || edge.destinationNodeId === node.id)));
}

export function normalizeRouteSelection(selection: RouteSelection): RouteSelection {
  return {
    sourceNodeId: selection.sourceNodeId === "" ? "" : validSourceId(selection.sourceNodeId) ? selection.sourceNodeId : DEFAULT_SOURCE_NODE_ID,
    destinationId: selection.destinationId === "" ? "" : validDestinationId(selection.destinationId) ? selection.destinationId : DEFAULT_DESTINATION_ID,
  };
}

function readUrlSelection(): Partial<RouteSelection> {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const sourceNodeId = params.get("source") ?? params.get("sourceNodeId") ?? undefined;
  const destinationId = params.get("destination") ?? params.get("destinationId") ?? undefined;
  return {
    ...(sourceNodeId === "" || validSourceId(sourceNodeId) ? { sourceNodeId } : {}),
    ...(destinationId === "" || validDestinationId(destinationId) ? { destinationId } : {}),
  };
}

export function readRouteSelection(fallback?: RouteSelection): RouteSelection {
  const storedSource = typeof window === "undefined" ? null : window.sessionStorage.getItem("aiet-source");
  const storedDestination = typeof window === "undefined" ? null : window.sessionStorage.getItem("pathfinder-destination");
  const url = readUrlSelection();
  return normalizeRouteSelection({
    sourceNodeId: url.sourceNodeId ?? (fallback && (fallback.sourceNodeId === "" || validSourceId(fallback.sourceNodeId)) ? fallback.sourceNodeId : undefined) ?? (storedSource === "" ? "" : validSourceId(storedSource) ? storedSource : DEFAULT_SOURCE_NODE_ID),
    destinationId: url.destinationId ?? (fallback && (fallback.destinationId === "" || validDestinationId(fallback.destinationId)) ? fallback.destinationId : undefined) ?? (storedDestination === "" ? "" : validDestinationId(storedDestination) ? storedDestination : DEFAULT_DESTINATION_ID),
  });
}

export function writeRouteSelection(selection: RouteSelection) {
  if (typeof window === "undefined") return;
  const next = normalizeRouteSelection(selection);
  window.sessionStorage.setItem("aiet-source", next.sourceNodeId);
  window.sessionStorage.setItem("pathfinder-destination", next.destinationId);
  const url = new URL(window.location.href);
  url.searchParams.set("source", next.sourceNodeId);
  url.searchParams.set("destination", next.destinationId);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  window.dispatchEvent(new Event(ROUTE_SELECTION_EVENT));
}

export function useRouteSelection(initial?: RouteSelection) {
  const [selection, setSelection] = useState<RouteSelection>(() => readRouteSelection(initial));
  const selectionRef = useRef(selection);

  useEffect(() => {
    const sync = () => {
      const next = readRouteSelection();
      selectionRef.current = next;
      setSelection(next);
    };
    window.addEventListener(ROUTE_SELECTION_EVENT, sync);
    window.addEventListener("storage", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener(ROUTE_SELECTION_EVENT, sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  const updateSelection = useCallback((patch: RouteSelectionPatch | ((current: RouteSelection) => RouteSelection)) => {
    const current = selectionRef.current;
    const next = normalizeRouteSelection(typeof patch === "function" ? patch(current) : { ...current, ...patch });
    selectionRef.current = next;
    writeRouteSelection(next);
    setSelection(next);
  }, []);

  return [selection, updateSelection] as const;
}

export function getRoutableSourceNodes() {
  return campusNodes.filter((node) => node.isActive && Number.isFinite(node.latitude) && Number.isFinite(node.longitude) && campusEdges.some((edge) => !edge.isBlocked && (edge.sourceNodeId === node.id || edge.destinationNodeId === node.id)));
}

export function getRoutableDestinationLocations() {
  return getRoutableSourceNodes().map((node) => ({
    id: destinations.find((destination) => destination.nodeId === node.id && destination.isActive)?.id ?? node.id,
    nodeId: node.id,
    name: node.name,
    buildingName: node.buildingName,
    floorName: node.floorName,
  }));
}

export function resolveDestinationLocation(id: string) {
  const destination = destinations.find((item) => item.id === id && item.isActive);
  const node = getNode(destination?.nodeId ?? id);
  if (!node?.isActive || !Number.isFinite(node.latitude) || !Number.isFinite(node.longitude)) return undefined;
  return { id, nodeId: node.id, name: node.name, buildingName: node.buildingName, floorName: node.floorName };
}
