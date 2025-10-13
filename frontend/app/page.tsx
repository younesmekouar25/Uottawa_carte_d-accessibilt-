"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import Sidebar from "@/components/Sidebar";

export default function Home() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    // Style "Voyager" (beige) proche du rendu Mapsted
    const style: maplibregl.StyleSpecification = {
      version: 8,
      sources: {
        cartoVoyager: {
          type: "raster",
          tiles: [
            "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
            "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
            "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
            "https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
          ],
          tileSize: 256,
          attribution: "© OpenStreetMap contributors, © CARTO",
        },
      },
      layers: [{ id: "basemap", type: "raster", source: "cartoVoyager" }],
    };

    const map = new maplibregl.Map({
      container: mapRef.current,
      style,
      center: [-75.685, 45.4236], // UOttawa (lon, lat)
      zoom: 15.8,
      hash: false,
    });
    mapInstance.current = map;

    map.on("load", () => {
      // --- SOURCES ---
      map.addSource("buildings", {
        type: "geojson",
        data: "/data/buildings.geojson",
        promoteId: "id", // utile pour hover/selection
      });

      map.addSource("pois", {
        type: "geojson",
        data: "/data/pois.geojson",
      });

      // --- LAYERS: Bâtiments ---
      map.addLayer({
        id: "b-fill",
        type: "fill",
        source: "buildings",
        paint: {
          "fill-color": "#8c6b4f", // brun Mapsted-like
          "fill-opacity": 0.55,
        },
      });

      map.addLayer({
        id: "b-outline",
        type: "line",
        source: "buildings",
        paint: {
          "line-color": "#3b2f26",
          "line-width": 1,
        },
      });

      map.addLayer({
        id: "b-label",
        type: "symbol",
        source: "buildings",
        layout: {
          "text-field": ["get", "name"],
          "text-size": 12,
          "text-font": ["Noto Sans Regular"],
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#111",
          "text-halo-color": "rgba(255,255,255,0.85)",
          "text-halo-width": 1.2,
        },
      });

      // --- LAYERS: POI ---
      map.addLayer({
        id: "poi-circle",
        type: "circle",
        source: "pois",
        paint: {
          "circle-color": [
            "match",
            ["get", "type"],
            "elevator",
            "#1e90ff",
            "ramp",
            "#16a34a",
            "toilet",
            "#9333ea",
            /* other */ "#111827",
          ],
          "circle-radius": 6,
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1.5,
        },
      });

      // --- Hover highlight bâtiments ---
      map.addLayer({
        id: "b-hover",
        type: "line",
        source: "buildings",
        paint: { "line-color": "#111", "line-width": 3 },
        filter: ["==", ["id"], ""],
      });

      map.on("mousemove", "b-fill", (e) => {
        const id = e.features?.[0]?.id ?? "";
        map.setFilter("b-hover", ["==", ["id"], id]);
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "b-fill", () => {
        map.setFilter("b-hover", ["==", ["id"], ""]);
        map.getCanvas().style.cursor = "";
      });

      // --- Popups ---
      const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true });

      map.on("click", "b-fill", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const name = (f.properties as any)?.name ?? "Building";
        const code = (f.properties as any)?.code ? ` (${(f.properties as any).code})` : "";
        popup
          .setLngLat([e.lngLat.lng, e.lngLat.lat])
          .setHTML(`<strong>${name}${code}</strong>`)
          .addTo(map);
      });

      map.on("click", "poi-circle", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as any;
        popup
          .setLngLat([e.lngLat.lng, e.lngLat.lat])
          .setHTML(
            `<div style="font:13px/1.3 system-ui">
              <strong>${p.name || p.type}</strong><br/>
              <small>Type: ${p.type} • Bldg: ${p.building ?? "-"} • Floor: ${p.floor ?? "-"}</small>
            </div>`
          )
          .addTo(map);
      });

      // --- Contrôles ---
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
      map.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: "metric" }), "bottom-left");
    });

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  return (
    <main className="w-screen h-screen relative bg-neutral-100">
      {/* Carte */}
      <div ref={mapRef} className="w-full h-full" />

      {/* Barre de recherche (devant la sidebar) */}
      <div className="absolute top-5 left-[120px] right-10 z-30 flex items-center justify-start">
        <div className="flex items-center gap-3 bg-white/95 backdrop-blur-xl border border-black/10 shadow-[0_8px_24px_rgba(0,0,0,.12)] px-5 py-2 rounded-[28px] w-full max-w-2xl">
          <span aria-hidden className="text-blue-600 text-lg">🔎</span>
          <input
            type="search"
            placeholder="Search buildings, rooms, accessibility..."
            className="w-full bg-transparent outline-none text-sm"
            aria-label="Search map"
          />
          <button
            className="rounded-full border border-black/15 hover:bg-black/5 px-4 py-1 text-sm font-medium"
            aria-label="Filters"
          >
            Filters
          </button>
        </div>
      </div>

      {/* Sidebar (légèrement en arrière, z-10) */}
      <Sidebar onSelect={(id) => console.log("clicked:", id)} />
    </main>
  );
}
