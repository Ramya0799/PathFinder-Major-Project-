import { Badge } from "@/components/ui/badge";
import { alvasLandingContent } from "@shared/landing-content";
import { Move3d, Pause, Play, Sparkles, UsersRound } from "lucide-react";
import { useState, type CSSProperties, type PointerEvent } from "react";

type Tilt = { x: number; y: number };

const restingTilt: Tilt = { x: 0, y: 0 };

export function AlvasCampusShowcase() {
  const [tilt, setTilt] = useState<Tilt>(restingTilt);
  const [isRotating, setIsRotating] = useState(true);
  const primaryScene = alvasLandingContent.campusScenes[0];

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch") return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    setTilt({ x: Number((-y * 7).toFixed(2)), y: Number((x * 9).toFixed(2)) });
  };

  const cardStyle = {
    "--tilt-x": `${tilt.x}deg`,
    "--tilt-y": `${tilt.y}deg`,
  } as CSSProperties;

  return (
    <section
      className="campus-showcase-wrap group relative mx-auto w-full max-w-[39rem]"
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setTilt(restingTilt)}
      aria-label="Interactive AIET campus community showcase"
    >
      <div className="campus-aura absolute -inset-8 -z-10 rounded-[3rem]" />
      <div className={`campus-showcase-card ${isRotating ? "is-rotating" : ""}`} style={cardStyle}>
        <div className="campus-image-frame relative overflow-hidden rounded-[1.6rem] border border-white/20 bg-[#19080e] p-2.5 shadow-[0_38px_90px_rgba(6,0,3,0.48)]">
          <img
            src={primaryScene.image}
            alt={primaryScene.alt}
            className="campus-image campus-360-image campus-scene-enter block aspect-[1.18/1] w-full rounded-[1.15rem] object-cover"
          />
          <div className="campus-vignette absolute inset-2.5 rounded-[1.15rem]" />
          <div className="campus-scanline absolute inset-x-[11%] top-[32%] h-px" />
          <div className="campus-orbit-marker absolute right-[15%] top-[24%] grid h-12 w-12 place-items-center rounded-full border border-white/70 bg-[#7e132b]/85 text-white shadow-lg shadow-black/30">
            <UsersRound className="h-5 w-5" />
          </div>
          <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-3">
            <Badge className="border border-white/20 bg-[#19080e]/80 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-md hover:bg-[#19080e]/80">
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-amber-300" /> {primaryScene.label}
            </Badge>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsRotating((rotating) => !rotating)}
                className="grid h-9 w-9 place-items-center rounded-xl border border-white/25 bg-white/10 text-amber-200 backdrop-blur-md transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
                aria-label={isRotating ? alvasLandingContent.rotation.activeLabel : alvasLandingContent.rotation.inactiveLabel}
                aria-pressed={isRotating}
              >
                {isRotating ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/25 bg-white/10 text-amber-200 backdrop-blur-md" aria-hidden="true">
                <Move3d className="h-4.5 w-4.5" />
              </span>
            </div>
          </div>
        </div>
        <div className="campus-card-caption flex items-center justify-between gap-4 px-2 pb-1 pt-4 text-white">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-200">Explore AIET</p>
            <p className="mt-1 text-sm text-white/70">{primaryScene.description} · Ambient motion and pointer tilt.</p>
          </div>
          <span className="hidden rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 sm:inline">Community view</span>
        </div>
      </div>
    </section>
  );
}
