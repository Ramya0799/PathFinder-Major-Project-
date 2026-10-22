import { TopNav } from "@/components/TopNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { bearingDegrees, normalizeRelativeBearing } from "@shared/routing";
import { campusNodes, getNode } from "@shared/pathfinder";
import { AlertTriangle, Camera, Compass, Map as MapIcon, RotateCcw, ShieldAlert, Smartphone, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";

type OrientationEventWithPermission = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<"granted" | "denied"> };

export default function ARNavigation() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraStatus, setCameraStatus] = useState<"idle" | "active" | "error">("idle");
  const [orientationStatus, setOrientationStatus] = useState<"idle" | "granted" | "denied">("idle");
  const [heading, setHeading] = useState(25);
  const [error, setError] = useState("");
  const user = getNode("gate")!;
  const waypoint = getNode("reception")!;
  const targetBearing = bearingDegrees(user, waypoint);
  const relativeBearing = normalizeRelativeBearing(targetBearing, heading);
  const arrowRotation = Math.max(-80, Math.min(80, relativeBearing));
  const directionLabel = Math.abs(relativeBearing) <= 18 ? "Continue straight" : Math.abs(relativeBearing) > 145 ? "Turn around" : relativeBearing > 0 ? "Turn right" : "Turn left";
  const enableCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setCameraStatus("error"); setError("Camera access is unavailable in this browser. Open map navigation to continue."); return; }
    try { const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }); streamRef.current = stream; if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); } setCameraStatus("active"); setError(""); }
    catch { setCameraStatus("error"); setError("Camera access is required for AR navigation. Please allow camera permission and use HTTPS."); }
  };
  const enableOrientation = async () => {
    try { const eventWithPermission = DeviceOrientationEvent as OrientationEventWithPermission; if (typeof eventWithPermission.requestPermission === "function") { const result = await eventWithPermission.requestPermission(); if (result !== "granted") { setOrientationStatus("denied"); return; } } setOrientationStatus("granted"); }
    catch { setOrientationStatus("denied"); }
  };
  useEffect(() => { const handler = (event: DeviceOrientationEvent) => { const iosHeading = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading; const next = iosHeading ?? event.alpha; if (typeof next === "number") setHeading(Math.round((next + 360) % 360)); }; if (orientationStatus === "granted") window.addEventListener("deviceorientation", handler, true); return () => window.removeEventListener("deviceorientation", handler, true); }, [orientationStatus]);
  useEffect(() => () => { streamRef.current?.getTracks().forEach(track => track.stop()); }, []);
  return <div className="min-h-screen bg-slate-950 text-white"><TopNav transparent /><main className="container py-5 sm:py-8"><div className="mb-5 flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-[0.18em] text-cyan-300">Browser AR guidance</p><h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Follow the next waypoint</h1></div><Badge className="border border-amber-300/30 bg-amber-300/10 text-amber-200 hover:bg-amber-300/10"><ShieldAlert className="mr-1.5 h-3.5 w-3.5" />Experimental browser capability</Badge></div>
    <section className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900 shadow-2xl"><div className="relative aspect-[9/15] max-h-[680px] min-h-[560px] sm:aspect-[16/10]"><video ref={videoRef} playsInline muted className={`absolute inset-0 h-full w-full object-cover ${cameraStatus === "active" ? "opacity-100" : "opacity-0"}`} /><div className={`absolute inset-0 ${cameraStatus === "active" ? "bg-gradient-to-b from-slate-950/55 via-transparent to-slate-950/80" : "ar-fallback"}`} />
      {cameraStatus !== "active" && <div className="absolute inset-0 grid place-items-center p-6"><div className="max-w-md text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-cyan-400 text-slate-950"><Camera className="h-7 w-7" /></div><h2 className="mt-5 font-display text-2xl font-bold">Camera-first guidance, with a safe fallback.</h2><p className="mt-3 leading-7 text-slate-300">PathFinder uses your device camera and orientation only after permission. If either capability is unavailable, turn-by-turn map navigation stays available.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><Button onClick={enableCamera} className="bg-cyan-400 font-bold text-slate-950 hover:bg-cyan-300"><Camera className="mr-2 h-4 w-4" />Enable camera</Button><Link href="/map" className="inline-flex items-center rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10"><MapIcon className="mr-2 h-4 w-4" />Open map navigation</Link></div>{error && <p className="mt-4 rounded-xl border border-rose-300/30 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</p>}</div></div>}
      {cameraStatus === "active" && <><div className="absolute left-5 right-5 top-5 flex items-center justify-between"><div className="rounded-full bg-slate-950/70 px-3 py-1.5 text-xs font-bold backdrop-blur">AR navigation</div><button onClick={() => { streamRef.current?.getTracks().forEach(track => track.stop()); setCameraStatus("idle"); }} className="grid h-9 w-9 place-items-center rounded-full bg-slate-950/70 backdrop-blur" aria-label="Exit AR"><X className="h-4 w-4" /></button></div><div className="absolute left-1/2 top-[40%] -translate-x-1/2"><div className="ar-arrow" style={{ transform: `rotate(${arrowRotation}deg)` }}>➜</div><p className="mt-4 rounded-full bg-slate-950/75 px-4 py-2 text-center text-sm font-bold backdrop-blur">{directionLabel}</p></div><div className="absolute bottom-5 left-5 right-5 rounded-2xl bg-slate-950/80 p-4 backdrop-blur"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-cyan-300">Next waypoint</p><p className="mt-1 font-display text-xl font-bold">{waypoint.name}</p></div><div className="text-right"><p className="font-mono text-2xl font-medium text-cyan-300">38 m</p><p className="text-xs text-slate-300">bearing {Math.round(targetBearing)}°</p></div></div><div className="mt-3 h-1.5 rounded-full bg-white/15"><div className="h-full w-[28%] rounded-full bg-cyan-400" /></div></div></>}
    </div></section>
    <section className="mx-auto mt-5 grid max-w-5xl gap-4 md:grid-cols-3"><article className="rounded-2xl border border-white/10 bg-white/5 p-5"><Compass className="h-5 w-5 text-cyan-300" /><h2 className="mt-3 font-semibold">Motion & orientation</h2><p className="mt-1 text-sm leading-6 text-slate-300">Heading: {heading}°. AR position uses <span className="font-mono text-cyan-300">targetBearing − deviceHeading</span>.</p><Button variant="outline" onClick={enableOrientation} className="mt-4 border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"><Smartphone className="mr-2 h-4 w-4" />Enable motion & orientation</Button>{orientationStatus === "denied" && <p className="mt-2 text-xs text-amber-200">Compass access is required for accurate AR direction. Use the map fallback.</p>}</article><article className="rounded-2xl border border-white/10 bg-white/5 p-5"><RotateCcw className="h-5 w-5 text-cyan-300" /><h2 className="mt-3 font-semibold">WebXR / AR.js readiness</h2><p className="mt-1 text-sm leading-6 text-slate-300">This browser overlay runs as a secure-camera fallback layer. Production deployments may add WebXR or AR.js when the browser reports support.</p></article><article className="rounded-2xl border border-white/10 bg-white/5 p-5"><AlertTriangle className="h-5 w-5 text-amber-300" /><h2 className="mt-3 font-semibold">Indoor positioning limitation</h2><p className="mt-1 text-sm leading-6 text-slate-300">GPS position can degrade inside buildings. Confirm locations using campus markers or approved indoor positioning hardware where required.</p></article></section>
  </main></div>;
}
