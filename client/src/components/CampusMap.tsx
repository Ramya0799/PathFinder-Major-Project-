import { CampusNode } from "@shared/pathfinder";
import { Compass, LocateFixed } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import { useEffect } from "react";

export type MapPosition = { latitude: number; longitude: number; accuracy?: number; heading?: number };
const EMPTY_ROUTE: CampusNode[] = [];

const marker = (label: string, className: string) => L.divIcon({ className: "", html: `<div class="map-pin ${className}"><span>${label}</span></div>`, iconSize: [30, 30], iconAnchor: [15, 15] });

function Recenter({ position }: { position?: MapPosition }) {
  const map = useMap();
  useEffect(() => { if (position) map.flyTo([position.latitude, position.longitude], Math.max(map.getZoom(), 17), { duration: 0.65 }); }, [map, position]);
  return null;
}

function FitRoute({ route }: { route: CampusNode[] }) {
  const map = useMap();
  useEffect(() => {
    if (route.length > 1) map.fitBounds(route.map((node) => [node.latitude, node.longitude] as [number, number]), { padding: [48, 48], maxZoom: 18, animate: true });
    else if (route.length === 1) map.flyTo([route[0].latitude, route[0].longitude], Math.max(map.getZoom(), 17), { duration: 0.5 });
  }, [map, route]);
  return null;
}

function LocateButton({ onLocate }: { onLocate?: () => void }) {
  const map = useMap();
  return <button className="leaflet-locate" onClick={() => { onLocate?.(); map.locate({ setView: true, maxZoom: 18 }); }} aria-label="Locate me"><LocateFixed className="h-4 w-4" /></button>;
}

export function CampusMap({ nodes, route, destination, source, userPosition, onLocate, className = "", compact = false }: { nodes: CampusNode[]; route?: CampusNode[]; destination?: CampusNode; source?: CampusNode; userPosition?: MapPosition; onLocate?: () => void; className?: string; compact?: boolean }) {
  const center: [number, number] = [13.02192, 74.98168];
  const routeLine = route?.map(node => [node.latitude, node.longitude] as [number, number]) ?? [];
  const routeKey = route?.map((node) => node.id).join("-") ?? "no-route";
  return <div className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 ${className}`}>
    <MapContainer center={center} zoom={17} scrollWheelZoom={!compact} className="h-full min-h-[330px] w-full" zoomControl={!compact}>
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitRoute route={route ?? EMPTY_ROUTE} />
      {nodes.filter(node => (node.nodeType === "entrance" || node.nodeType === "gate" || node.nodeType === "facility") && node.id !== source?.id && node.id !== destination?.id).map(node => <Marker key={`poi-${node.id}`} position={[node.latitude, node.longitude]} icon={marker(node.nodeType === "gate" ? "G" : "•", node.nodeType === "gate" ? "map-pin-gate" : "map-pin-building")}><Tooltip direction="top" offset={[0, -16]}>{node.name}</Tooltip></Marker>)}
      {routeLine.length > 1 && <><Polyline key={`route-halo-${routeKey}`} positions={routeLine} pathOptions={{ color: "#fbbf24", weight: 12, opacity: 0.25, lineCap: "round", lineJoin: "round" }} /><Polyline key={`route-line-${routeKey}`} positions={routeLine} pathOptions={{ color: "#06b6d4", weight: 6, opacity: 0.95, lineCap: "round", lineJoin: "round" }} /></>}
      {route?.slice(1, -1).map((node, index) => <CircleMarker key={node.id} center={[node.latitude, node.longitude]} radius={6} pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#0e7490", fillOpacity: 1 }}><Tooltip>{`Waypoint ${index + 1}: ${node.name}`}</Tooltip></CircleMarker>)}
      {source && <Marker key={`source-${source.id}`} position={[source.latitude, source.longitude]} icon={marker("S", "map-pin-source")}><Tooltip permanent direction="top">Start • {source.name}</Tooltip></Marker>}
      {destination && <Marker key={`destination-${destination.id}`} position={[destination.latitude, destination.longitude]} icon={marker("D", "map-pin-destination")}><Tooltip permanent direction="top">Destination • {destination.name}</Tooltip></Marker>}
      {userPosition && <>
        <CircleMarker center={[userPosition.latitude, userPosition.longitude]} radius={userPosition.accuracy ? Math.max(10, Math.min(80, userPosition.accuracy)) : 18} pathOptions={{ color: "#0ea5e9", weight: 1, fillColor: "#38bdf8", fillOpacity: 0.12 }} />
        <Marker position={[userPosition.latitude, userPosition.longitude]} icon={marker("▲", "map-pin-user")}><Tooltip direction="top">You {userPosition.accuracy ? `• ±${Math.round(userPosition.accuracy)} m` : ""}</Tooltip></Marker>
        <Recenter position={undefined} />
      </>}
      <LocateButton onLocate={onLocate} />
    </MapContainer>
    {!compact && <div className="absolute bottom-3 left-3 z-[500] rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-xs font-medium text-white shadow-lg"><span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded bg-gradient-to-br from-amber-300 to-cyan-300 text-slate-950"><Compass className="h-3 w-3" /></span>AIET PathFinder • route preview</div>}
  </div>;
}
