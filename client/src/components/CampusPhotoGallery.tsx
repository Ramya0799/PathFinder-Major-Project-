import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { alvasLandingContent } from "@shared/landing-content";
import { Expand, MapPinned, Route, X } from "lucide-react";
import React, { useMemo, useState } from "react";
import { useLocation } from "wouter";

type CampusPhoto = {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly imageUrl: string;
  readonly originalFilename: string;
  readonly alt: string;
  readonly description: string;
  readonly routeDestinationId?: string;
};

const filters = ["All", "Campus", "Academic", "Arrival", "New Building", "Campus life"] as const;
const campusPhotos: readonly CampusPhoto[] = alvasLandingContent.campusPhotoArchive;

export function CampusPhotoGallery() {
  const [, setLocation] = useLocation();
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]>("All");
  const [selectedPhoto, setSelectedPhoto] = useState<CampusPhoto | null>(null);
  const visiblePhotos = useMemo(() => activeFilter === "All" ? campusPhotos : campusPhotos.filter((photo) => photo.category === activeFilter), [activeFilter]);

  const openConfiguredRoute = (photo: CampusPhoto) => {
    if (!photo.routeDestinationId) return;
    sessionStorage.setItem("pathfinder-destination", photo.routeDestinationId);
    setSelectedPhoto(null);
    setLocation("/map");
  };

  return <>
    <div className="mt-8 flex flex-wrap gap-2" role="toolbar" aria-label="Landmark image filters">{filters.map((filter) => <button key={filter} type="button" onClick={() => setActiveFilter(filter)} aria-pressed={activeFilter === filter} className={`min-h-10 border px-3 text-xs font-bold uppercase tracking-[.13em] transition ${activeFilter === filter ? "border-[#7e1532] bg-[#7e1532] text-white" : "border-[#d8cac0] bg-[#fffdfa] text-[#6d5d60] hover:border-[#a91e42] hover:text-[#7e1532]"}`}>{filter}</button>)}</div>
    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{visiblePhotos.map((photo, index) => <article key={photo.id} className={`group relative min-h-64 overflow-hidden bg-[#201119] shadow-[0_18px_42px_rgba(58,24,33,.14)] ${index === 0 && activeFilter === "All" ? "sm:col-span-2 sm:min-h-[31rem]" : ""}`}>
      <img src={photo.imageUrl} alt={photo.alt} loading={index < 3 ? "eager" : "lazy"} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04] motion-reduce:transform-none" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,4,8,.04)_25%,rgba(20,7,12,.86)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 p-4 text-white"><div className="flex items-center justify-between gap-2"><span className="border border-white/20 bg-black/20 px-2 py-1 text-[10px] font-bold uppercase tracking-[.14em] backdrop-blur-sm">{photo.category}</span><button type="button" onClick={() => setSelectedPhoto(photo)} className="grid h-9 w-9 place-items-center border border-white/25 bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20" aria-label={`View ${photo.title} image`}><Expand className="h-4 w-4" /></button></div><h3 className="mt-8 font-display text-xl font-bold leading-tight">{photo.title}</h3><p className="mt-1 line-clamp-2 text-xs leading-5 text-white/75">{photo.description}</p></div>
    </article>)}</div>
    <p className="mt-5 text-xs leading-5 text-[#6d5d60]">Visual archive based on user-supplied campus photographs and the submitted PathFinder presentation. Images support orientation and discovery; they do not establish room coordinates, floor assignments, or unsurveyed route details.</p>
    <Dialog open={Boolean(selectedPhoto)} onOpenChange={(open) => { if (!open) setSelectedPhoto(null); }}><DialogContent className="max-w-5xl border-[#34202a] bg-[#170b11] p-0 text-white sm:rounded-[1.6rem]"><DialogHeader className="sr-only"><DialogTitle>{selectedPhoto?.title}</DialogTitle><DialogDescription>{selectedPhoto?.description}</DialogDescription></DialogHeader>{selectedPhoto && <div className="grid max-h-[88vh] overflow-y-auto md:grid-cols-[minmax(0,1fr)_20rem]"><div className="min-h-72 bg-black"><img src={selectedPhoto.imageUrl} alt={selectedPhoto.alt} className="h-full max-h-[68vh] w-full object-contain" /></div><aside className="flex flex-col p-6"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#f3c64f]">AIET visual landmark</p><h3 className="mt-3 font-display text-3xl font-bold">{selectedPhoto.title}</h3><p className="mt-4 text-sm leading-6 text-white/72">{selectedPhoto.description}</p><p className="mt-5 border-t border-white/10 pt-4 text-xs leading-5 text-white/45">Original image: {selectedPhoto.originalFilename}</p>{selectedPhoto.routeDestinationId ? <Button onClick={() => openConfiguredRoute(selectedPhoto)} className="mt-auto bg-[#f3c64f] text-[#2a111a] hover:bg-[#ffe08c]"><Route className="mr-2 h-4 w-4" />Plan configured route</Button> : <div className="mt-auto flex gap-2 border border-white/10 bg-white/[.05] p-3 text-xs leading-5 text-white/65"><MapPinned className="mt-0.5 h-4 w-4 shrink-0 text-[#f3c64f]" />No verified destination handoff is configured for this visual landmark yet.</div>}</aside></div>}</DialogContent></Dialog>
  </>;
}
