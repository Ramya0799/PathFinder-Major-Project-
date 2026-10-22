import { CampusMap, MapPosition } from "@/components/CampusMap";
import { TopNav } from "@/components/TopNav";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { clearAssistantRouteLaunch, readAssistantRouteLaunch, resolveMapRouteLaunchState } from "@/lib/assistantRouteLaunch";
import { speakText } from "@/lib/browserSpeech";
import { useLanguage } from "@/contexts/LanguageContext";
import { createLocalizedVoiceGuidance } from "@shared/voice-guidance";
import { calculateRoute, createRouteInstructions, evaluateRouteDeviation, haversineDistanceMeters } from "@shared/routing";
import { deriveRouteProgress } from "@shared/route-progress";
import { clearLiveNavigationSnapshot, writeLiveNavigationSnapshot } from "@shared/live-navigation";
import { campusEdges, campusNodes, DEVIATION_THRESHOLD_METERS, destinations, getNode, REROUTE_COOLDOWN_MS } from "@shared/pathfinder";
import { getRoutableDestinationLocations, getRoutableSourceNodes, resolveDestinationLocation, useRouteSelection } from "@/lib/routeSelection";
import { AlertTriangle, Camera, CheckCircle2, ChevronLeft, Compass, Heart, LocateFixed, Map as MapIcon, Navigation, Pause, RefreshCw, Route, ShieldAlert, Volume2, X } from "lucide-react";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";

type LocationState = MapPosition & { speed?: number; timestamp?: number };
const demoPosition: LocationState = { latitude: 13.02170, longitude: 74.98105, accuracy: 12, heading: 42, speed: 0, timestamp: Date.now() };

export default function MapNavigation() {
  const [, setLocation] = useLocation();
  const [assistantLaunch] = useState(() => readAssistantRouteLaunch());
  const [mapLaunch] = useState(() => resolveMapRouteLaunchState(assistantLaunch, { destinationId: sessionStorage.getItem("pathfinder-destination") || "d7", sourceNodeId: sessionStorage.getItem("aiet-source") || "gate" }));
  const [routeSelection, setRouteSelection] = useRouteSelection({ sourceNodeId: mapLaunch.sourceNodeId, destinationId: mapLaunch.destinationId });
  const { destinationId, sourceNodeId } = routeSelection;
  const [position, setPosition] = useState<LocationState | undefined>();
  const [locationMessage, setLocationMessage] = useState("Location not yet shared. The selected starting point is shown as the route preview.");
  const [tracking, setTracking] = useState(false);
  const [accessibleOnly, setAccessibleOnly] = useState(() => mapLaunch.accessibleOnly);
  const [active, setActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [offRoute, setOffRoute] = useState(false);
  const [voiceOn, setVoiceOn] = useState(() => mapLaunch.voiceOn);
  const [persistedRouteId, setPersistedRouteId] = useState<number | null>(null);
  const [deviationCount, setDeviationCount] = useState(0);
  const [rerouteStartNodeId, setRerouteStartNodeId] = useState<string | null>(null);
  const lastRerouteAt = useRef<number | undefined>(undefined);
  const lastProgressPersistedAt = useRef(0);
  const announcedVoiceWaypoints = useRef<Set<number>>(new Set());
  const announcedVoiceRouteKey = useRef<string | undefined>(undefined);
  const { user } = useAuth();
  const { language } = useLanguage();
  const assistantLaunchHandled = useRef(false);
  const destination = resolveDestinationLocation(destinationId) ?? { id: "", nodeId: "", name: "Choose a destination", buildingName: "", floorName: "" };
  const destinationRecord = destinations.find(item => item.id === destinationId);
  const startNodeId = rerouteStartNodeId ?? sourceNodeId;
  const sourceNode = sourceNodeId ? getNode(startNodeId) : undefined;
  const selectedSourceNode = sourceNodeId ? getNode(sourceNodeId) : undefined;
  const destinationNode = getNode(destination.nodeId);
  const routeState = useMemo(() => {
    if (!sourceNodeId) return { route: undefined, error: "Select a starting point to calculate a route." };
    if (!destinationId) return { route: undefined, error: "Select a destination to calculate a route." };
    if (!selectedSourceNode || !destinationNode) return { route: undefined, error: "This location does not have valid map and routing data." };
    if (!sourceNode) return { route: undefined, error: "The selected route start is unavailable." };
    try {
      return { route: calculateRoute(campusNodes, campusEdges, startNodeId, destination.nodeId, "auto", accessibleOnly), error: "" };
    } catch (error) {
      return { route: undefined, error: error instanceof Error ? error.message : "Route calculation failed." };
    }
  }, [sourceNodeId, destinationId, selectedSourceNode, sourceNode, destinationNode, destination.nodeId, accessibleOnly, startNodeId]);
  const route = routeState.route;
  const routeNodes = useMemo(() => route?.nodeIds.map(getNode).filter((node): node is NonNullable<typeof node> => Boolean(node)) ?? [], [route]);
  const instructions = useMemo(() => route ? createRouteInstructions(campusNodes, route.nodeIds) : [], [route]);
  const liveProgress = useMemo(() => position && route ? deriveRouteProgress(position, routeNodes, currentStep) : { currentWaypointIndex: currentStep, totalWaypoints: routeNodes.length, remainingDistance: Math.max(0, Math.round((route?.totalDistance ?? 0) * (1 - currentStep / Math.max(1, routeNodes.length - 1)))), progressPercent: Math.round((currentStep / Math.max(1, routeNodes.length - 1)) * 100), isComplete: false, distanceToCurrentWaypoint: 0, arrivalThreshold: 18 }, [position, routeNodes, currentStep, route?.totalDistance, route]);
  const activeWaypointIndex = Math.max(currentStep, liveProgress.currentWaypointIndex);
  const currentInstruction = instructions[Math.min(activeWaypointIndex, instructions.length - 1)] ?? "Route ready.";
  const voiceLanguage = assistantLaunch?.language ?? language;
  const localizedVoiceInstructions = useMemo(() => createLocalizedVoiceGuidance(routeNodes.map((node) => node.name), voiceLanguage), [routeNodes, voiceLanguage]);
  const voiceRouteKey = route?.nodeIds.join("|") ?? `${startNodeId}|${destination.nodeId}|unavailable`;
  const activeVoiceWaypointIndex = liveProgress.isComplete ? Math.max(0, localizedVoiceInstructions.length - 1) : Math.min(activeWaypointIndex, Math.max(0, localizedVoiceInstructions.length - 1));
  const currentVoiceInstruction = localizedVoiceInstructions[activeVoiceWaypointIndex] ?? currentInstruction;
  useLayoutEffect(() => {
    setRerouteStartNodeId(null);
    setCurrentStep(0);
    if (active) {
      setActive(false);
      setTracking(false);
      setPersistedRouteId(null);
      clearLiveNavigationSnapshot();
    }
  }, [sourceNodeId, destinationId, accessibleOnly]);
  const startSession = trpc.routing.startSession.useMutation({ onSuccess: result => setPersistedRouteId(result.routeId) });
  const completeSession = trpc.routing.completeSession.useMutation();
  const updateProgress = trpc.routing.updateProgress.useMutation();
  const recordDeviation = trpc.routing.recordDeviation.useMutation();
  const utils = trpc.useUtils();
  const favoriteRoutes = trpc.favorites.list.useQuery(undefined, { enabled: Boolean(user) });
  const saveFavorite = trpc.favorites.save.useMutation({ onSuccess: () => utils.favorites.list.invalidate() });
  const removeFavorite = trpc.favorites.remove.useMutation({ onSuccess: () => utils.favorites.list.invalidate() });
  const currentFavorite = favoriteRoutes.data?.find(item => item.sourceNodeExternalId === sourceNodeId && item.destinationExternalId === destinationId && item.accessibleOnly === accessibleOnly);
  useEffect(() => {
    if (active && announcedVoiceRouteKey.current !== voiceRouteKey) {
      announcedVoiceWaypoints.current.clear();
      announcedVoiceRouteKey.current = voiceRouteKey;
      if (currentStep !== 0) {
        setCurrentStep(0);
        return;
      }
    }
    if (!voiceOn || !active || !currentVoiceInstruction || announcedVoiceWaypoints.current.has(activeVoiceWaypointIndex)) return;
    announcedVoiceWaypoints.current.add(activeVoiceWaypointIndex);
    speakText(currentVoiceInstruction, voiceLanguage);
  }, [voiceOn, active, voiceRouteKey, currentStep, activeVoiceWaypointIndex, currentVoiceInstruction, voiceLanguage]);
  useEffect(() => {
    if (!active || !position) return;
    const deviation = evaluateRouteDeviation(position, routeNodes, DEVIATION_THRESHOLD_METERS, lastRerouteAt.current, REROUTE_COOLDOWN_MS);
    if (deviation.shouldReroute) { const nearestSafeNode = campusNodes.filter(node => node.isAccessible).reduce((closest, node) => haversineDistanceMeters(position, node) < haversineDistanceMeters(position, closest) ? node : closest, campusNodes[0]); setOffRoute(true); setRerouteStartNodeId(nearestSafeNode.id); setLocationMessage(`You're off the planned route. Rerouting from ${nearestSafeNode.name}.`); lastRerouteAt.current = Date.now(); setDeviationCount(count => count + 1); if (persistedRouteId) recordDeviation.mutate({ routeId: persistedRouteId, latitude: position.latitude, longitude: position.longitude, distanceFromRoute: deviation.distanceFromRoute, rerouted: true }); }
    else if (!deviation.isOffRoute) setOffRoute(false);
  }, [active, position, routeNodes, persistedRouteId]);
  useEffect(() => {
    if (!active || !position || liveProgress.currentWaypointIndex <= currentStep) return;
    setCurrentStep(liveProgress.currentWaypointIndex);
  }, [active, position, liveProgress.currentWaypointIndex, currentStep]);
  useEffect(() => {
    if (!active || !position) {
      if (!active) clearLiveNavigationSnapshot();
      return;
    }
    writeLiveNavigationSnapshot({
      active: true,
      sourceNodeId: startNodeId,
      destinationId,
      currentWaypointIndex: activeWaypointIndex,
      totalWaypoints: liveProgress.totalWaypoints,
      progressPercent: liveProgress.progressPercent,
      remainingDistance: liveProgress.remainingDistance,
      currentInstruction,
      currentVoiceInstruction,
      isComplete: liveProgress.isComplete,
      position: { ...position, accuracy: position.accuracy ?? 999 },
      updatedAt: Date.now(),
    });
  }, [active, position, startNodeId, destinationId, activeWaypointIndex, liveProgress.totalWaypoints, liveProgress.progressPercent, liveProgress.remainingDistance, currentInstruction, currentVoiceInstruction, liveProgress.isComplete]);
  useEffect(() => {
    if (!active || !persistedRouteId || !user || !position || updateProgress.isPending) return;
    const now = Date.now();
    if (!liveProgress.isComplete && now - lastProgressPersistedAt.current < 5000) return;
    lastProgressPersistedAt.current = now;
    updateProgress.mutate({ routeId: persistedRouteId, currentWaypointIndex: activeWaypointIndex, totalWaypoints: liveProgress.totalWaypoints, remainingDistance: liveProgress.remainingDistance, navigationState: liveProgress.isComplete ? "completed" : "active" });
  }, [active, persistedRouteId, user, position, activeWaypointIndex, liveProgress.totalWaypoints, liveProgress.remainingDistance, liveProgress.isComplete, updateProgress]);
  const requestLocation = () => {
    if (!navigator.geolocation) { setLocationMessage("Geolocation is not supported in this browser. Map navigation remains available."); return; }
    setLocationMessage("Requesting live location…");
    navigator.geolocation.getCurrentPosition(result => { const next = { latitude: result.coords.latitude, longitude: result.coords.longitude, accuracy: result.coords.accuracy, heading: result.coords.heading ?? undefined, speed: result.coords.speed ?? undefined, timestamp: result.timestamp }; setPosition(next); setLocationMessage(result.coords.accuracy > 30 ? `Location acquired, but accuracy is low (±${Math.round(result.coords.accuracy)} m). Move outdoors for a more reliable route.` : `Location connected • ±${Math.round(result.coords.accuracy)} m`); }, error => { const messages: Record<number, string> = { 1: "Location permission was denied. Map guidance remains available.", 2: "Location is currently unavailable. Try moving outdoors or use map guidance.", 3: "Location request timed out. Please try again." }; setLocationMessage(messages[error.code] ?? "Location could not be obtained."); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 });
  };
  useEffect(() => { if (!tracking || !navigator.geolocation) return; const watcher = navigator.geolocation.watchPosition(result => { setPosition({ latitude: result.coords.latitude, longitude: result.coords.longitude, accuracy: result.coords.accuracy, heading: result.coords.heading ?? undefined, speed: result.coords.speed ?? undefined, timestamp: result.timestamp }); if (result.coords.accuracy > 30) setLocationMessage(`Location tracking is low accuracy (±${Math.round(result.coords.accuracy)} m). Move outdoors for a more reliable route.`); }, error => { const messages: Record<number, string> = { 1: "Location permission was denied. Map guidance remains available.", 2: "Live location became unavailable. Continuing with map guidance.", 3: "Live location tracking timed out. Please try locating again." }; setTracking(false); setLocationMessage(messages[error.code] ?? "Live location tracking stopped."); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }); return () => navigator.geolocation.clearWatch(watcher); }, [tracking]);
  const startNavigation = () => { if (!route) return; announcedVoiceWaypoints.current.clear(); announcedVoiceRouteKey.current = voiceRouteKey; setActive(true); setTracking(true); setCurrentStep(0); setDeviationCount(0); setRerouteStartNodeId(null); lastProgressPersistedAt.current = 0; if (!position) setPosition(demoPosition); if (user) startSession.mutate({ algorithm: route.algorithm, totalDistance: route.totalDistance, estimatedTime: route.estimatedTime, startLatitude: position?.latitude, startLongitude: position?.longitude, waypoints: routeNodes.map((node, index) => ({ latitude: node.latitude, longitude: node.longitude, instruction: instructions[index] })) }); };
  useEffect(() => { if (!mapLaunch.autoStart || assistantLaunchHandled.current) return; assistantLaunchHandled.current = true; clearAssistantRouteLaunch(); startNavigation(); }, [mapLaunch]);
  const finishNavigation = () => { setActive(false); setTracking(false); clearLiveNavigationSnapshot(); if (persistedRouteId && user) completeSession.mutate({ routeId: persistedRouteId, completionStatus: liveProgress.isComplete || activeWaypointIndex >= instructions.length - 1 ? "completed" : "stopped", deviationCount, actualDistance: (route?.totalDistance ?? 0) - liveProgress.remainingDistance }); setPersistedRouteId(null); };
  const toggleFavorite = () => {
    if (!user) { setLocation("/account"); return; }
    if (currentFavorite) { removeFavorite.mutate({ favoriteId: currentFavorite.id }); return; }
    if (!destinationRecord) return;
    saveFavorite.mutate({ label: `${selectedSourceNode?.name ?? "Start"} → ${destination.name}`, sourceNodeExternalId: sourceNodeId, destinationExternalId: destinationId, accessibleOnly });
  };
  const launchFavorite = (favorite: NonNullable<typeof favoriteRoutes.data>[number]) => { setRouteSelection({ sourceNodeId: favorite.sourceNodeExternalId, destinationId: favorite.destinationExternalId }); setAccessibleOnly(favorite.accessibleOnly); setRerouteStartNodeId(null); };
  return <div className="min-h-screen bg-slate-50"><TopNav /><main className="container py-5 sm:py-8"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><Link href="/destinations" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-cyan-700"><ChevronLeft className="h-4 w-4" />Route planner</Link><h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Your AIET route</h1><p className="mt-1 text-sm text-slate-500">From <strong className="text-slate-800">{selectedSourceNode?.name ?? "Choose a starting point"}</strong> to <strong className="text-slate-800">{destination.name}</strong></p></div><div className="flex items-center gap-2"><Badge className="border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50"><Route className="mr-1.5 h-3.5 w-3.5" />{route ? `${route.algorithm === "dijkstra" ? "Dijkstra" : "A*"} selected automatically` : "Route unavailable"}</Badge><Button variant="outline" onClick={() => setAccessibleOnly(value => !value)} className={accessibleOnly ? "border-cyan-400 bg-cyan-50 text-cyan-800" : ""}>Accessible route</Button></div></div>
    <div className="mb-5 grid gap-3 rounded-2xl border border-amber-200/70 bg-gradient-to-r from-amber-50 via-white to-cyan-50 p-4 shadow-sm md:grid-cols-[1fr_auto_1fr_auto]"><label className="text-sm font-semibold text-slate-700">Starting point<select aria-label="Starting point" value={sourceNodeId} onChange={event => setRouteSelection({ sourceNodeId: event.target.value })} className="mt-1.5 block h-10 w-full rounded-lg border border-amber-200 bg-white px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"><option value="">Choose a starting point</option>{getRoutableSourceNodes().map(node => <option key={node.id} value={node.id}>{node.name} · {node.buildingName} · {node.floorName}</option>)}</select></label><div className="hidden items-center justify-center pt-6 text-amber-500 md:flex">→</div><label className="text-sm font-semibold text-slate-700">Destination<select aria-label="Destination" value={destinationId} onChange={event => setRouteSelection({ destinationId: event.target.value })} className="mt-1.5 block h-10 w-full rounded-lg border border-cyan-200 bg-white px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"><option value="">Choose a destination</option>{getRoutableDestinationLocations().map(item => <option key={item.id} value={item.id}>{item.name} · {item.buildingName} · {item.floorName}</option>)}</select></label><Link href="/destinations" className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white transition hover:bg-slate-800">Change destination</Link></div>
    <p role="status" aria-live="polite" className={`mb-4 rounded-lg px-3 py-2 text-sm ${!route ? "border border-rose-200 bg-rose-50 text-rose-800" : "border border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{!sourceNodeId ? "Choose a starting point to calculate a route." : !destinationId ? "Choose a destination to calculate a route." : !route ? `No walking route is currently available between these locations. ${routeState.error}` : sourceNodeId === destination.nodeId ? "You are already at this location. This is a zero-distance route." : `Route ready: ${selectedSourceNode?.name} to ${destination.name}.`}</p>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_370px]"><section className="relative"><CampusMap nodes={campusNodes} route={routeNodes} source={selectedSourceNode} destination={destinationNode} userPosition={position} onLocate={requestLocation} className="h-[52vh] min-h-[450px]" />{offRoute && <div className="absolute left-4 right-4 top-4 z-[600] flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-lg"><AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" /><div><p className="font-bold">You're off the planned route.</p><p className="mt-0.5 text-sm">The system will recalculate from the closest safe graph node after the reroute cooldown.</p></div><button onClick={() => setOffRoute(false)} className="ml-auto"><X className="h-4 w-4" /></button></div>}</section>
      <aside className="flex flex-col gap-4"><section className={`rounded-2xl bg-slate-950 p-5 text-white shadow-xl transition-[box-shadow,transform] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${active ? "shadow-cyan-950/35" : "shadow-slate-900/10"}`}><div className="flex items-start justify-between gap-4"><div aria-live="polite"><p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">{liveProgress.isComplete ? "Destination reached" : active ? "Navigation in progress" : "Route preview"}</p><h2 className="mt-1 font-display text-2xl font-bold">{active ? (liveProgress.isComplete ? `You’ve reached ${destination.name}` : currentInstruction) : `${sourceNode?.name ?? "Choose a starting point"} → ${destination.name}`}</h2></div><div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cyan-400 text-slate-950 transition-transform duration-500 motion-reduce:transition-none ${active && !liveProgress.isComplete ? "animate-[route-beacon_2.4s_ease-in-out_infinite] motion-reduce:animate-none" : ""}`}><Navigation className="h-5 w-5" /></div></div><div className="mt-5 grid grid-cols-4 gap-2"><div className="rounded-xl bg-white/10 p-3 transition-colors duration-500 motion-reduce:transition-none"><p className="text-xs text-slate-400">Distance</p><p className="mt-1 font-semibold tabular-nums">{route?.totalDistance ?? "—"} m</p></div><div className="rounded-xl bg-white/10 p-3"><p className="text-xs text-slate-400">Walking time</p><p className="mt-1 font-semibold tabular-nums">{route ? (route.totalDistance === 0 ? "0" : String(Math.max(1, Math.ceil(route.estimatedTime / 60)))) : "—"} min</p></div><div className="rounded-xl bg-white/10 p-3 transition-colors duration-500 motion-reduce:transition-none"><p className="text-xs text-slate-400">Progress</p><p className="mt-1 font-semibold tabular-nums">{active ? liveProgress.progressPercent : 0}%</p></div><div className="rounded-xl bg-white/10 p-3"><p className="text-xs text-slate-400">Accuracy</p><p className="mt-1 font-semibold text-cyan-300 tabular-nums">±{Math.round(position?.accuracy ?? 12)} m</p></div></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10" aria-label={`Route progress: ${active ? liveProgress.progressPercent : 0}%`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={active ? liveProgress.progressPercent : 0}><div className="h-full rounded-full bg-cyan-400 transition-[width] duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none" style={{ width: `${active ? liveProgress.progressPercent : 0}%` }} /></div>{active && <div className="mt-3 rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs leading-5 text-cyan-50"><span className="font-bold text-cyan-200">{voiceOn ? "Spoken turn-by-turn guidance on." : "Spoken turn-by-turn guidance paused."}</span>{voiceOn && <span className="block text-slate-300">Latest cue: {currentVoiceInstruction}</span>}<span className="mt-1 block text-slate-300">Live progress is calculated on this device. Only a route-progress snapshot is saved for signed-in users.</span></div>}</section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h3 className="font-display text-lg font-bold">Route controls</h3><Badge variant="outline" className="text-slate-500">{route?.nodeIds.length ?? 0} waypoints</Badge></div><div className="mt-4 grid grid-cols-2 gap-2">{!active ? <Button disabled={!route} onClick={startNavigation} className="col-span-2 bg-cyan-500 font-bold text-slate-950 hover:bg-cyan-400"><Compass className="mr-2 h-4 w-4" />Start navigation</Button> : liveProgress.isComplete ? <Button onClick={finishNavigation} className="col-span-2 bg-cyan-500 font-bold text-slate-950 hover:bg-cyan-400"><CheckCircle2 className="mr-2 h-4 w-4" />Complete route</Button> : <Button onClick={() => setCurrentStep(step => Math.min(instructions.length - 1, step + 1))} className="col-span-2 bg-cyan-500 font-bold text-slate-950 hover:bg-cyan-400"><CheckCircle2 className="mr-2 h-4 w-4" />Mark next waypoint reached</Button>}<Button variant="outline" disabled={!destinationRecord} onClick={toggleFavorite} className={currentFavorite ? "border-rose-200 bg-rose-50 text-rose-700" : ""}><Heart className={`mr-2 h-4 w-4 ${currentFavorite ? "fill-current" : ""}`} />{currentFavorite ? "Saved" : "Save route"}</Button><Button variant="outline" onClick={requestLocation}><LocateFixed className="mr-2 h-4 w-4" />Locate</Button><Button variant="outline" onClick={() => setOffRoute(true)}><RefreshCw className="mr-2 h-4 w-4" />Recalculate</Button><Button variant="outline" onClick={() => setVoiceOn(value => !value)} className={voiceOn ? "border-cyan-300 bg-cyan-50 text-cyan-800" : ""}><Volume2 className="mr-2 h-4 w-4" />Voice {voiceOn ? "on" : "off"}</Button><Button variant="outline" onClick={() => setLocation("/ar")}><Camera className="mr-2 h-4 w-4" />Open AR</Button>{active && <Button variant="outline" onClick={() => setLocation(`/campus-3d?from=${sourceNodeId}&to=${destinationId}&live=1`)} className="border-cyan-300 bg-cyan-50 text-cyan-800"><Route className="mr-2 h-4 w-4" />Open live 3D</Button>}{active && <Button variant="ghost" onClick={finishNavigation} className="col-span-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700"><Pause className="mr-2 h-4 w-4" />Stop navigation</Button>}</div></section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><h3 className="font-display text-lg font-bold">Saved routes</h3>{user ? <Badge variant="outline">{favoriteRoutes.data?.length ?? 0}</Badge> : <Link href="/account" className="text-xs font-bold text-cyan-700 hover:underline">Sign in to save</Link>}</div>{user && <div className="mt-3 space-y-2">{favoriteRoutes.data?.map(favorite => <div key={favorite.id} className="rounded-xl bg-slate-50 p-3 transition-colors duration-200 hover:bg-cyan-50"><div className="flex items-center gap-2"><button onClick={() => launchFavorite(favorite)} className="min-w-0 flex-1 text-left"><p className="truncate text-sm font-semibold text-slate-800">{favorite.label}</p><p className="mt-0.5 text-xs text-slate-500">{favorite.accessibleOnly ? "Accessible route" : "Standard route"}</p></button><button aria-label={`Remove ${favorite.label}`} onClick={() => removeFavorite.mutate({ favoriteId: favorite.id })} className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-rose-600"><X className="h-4 w-4" /></button></div>{(favorite.note || favorite.tags.length > 0) && <div className="mt-2 border-t border-slate-200 pt-2"><p className="text-xs leading-5 text-slate-600">{favorite.note}</p><div className="mt-1.5 flex flex-wrap gap-1">{favorite.tags.map((tag) => <span key={tag} className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-semibold text-cyan-800">#{tag}</span>)}</div></div>}</div>)}{!favoriteRoutes.data?.length && <p className="rounded-xl bg-slate-50 p-3 text-sm leading-5 text-slate-600">Save this configured route to reopen it here later.</p>}</div>}</section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex gap-3"><MapIcon className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" /><div><h3 className="font-semibold">Location status</h3><p className="mt-1 text-sm leading-6 text-slate-600">{locationMessage}</p></div></div><div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900"><ShieldAlert className="mr-1 inline h-3.5 w-3.5" />Location and camera features require HTTPS (or localhost) and user permission.</div></section>
      </aside></div></main></div>;
}
