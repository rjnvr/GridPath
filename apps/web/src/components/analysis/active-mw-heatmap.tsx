"use client"

import type { AnalysisHeatmapProject } from "@gridpath/shared"
import { Activity } from "lucide-react"
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl"
import { useEffect, useMemo, useRef } from "react"

import "maplibre-gl/dist/maplibre-gl.css"

const USA_BOUNDS: [[number, number], [number, number]] = [
  [-125, 24],
  [-66, 50]
]

type HeatmapFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  {
    id: string
    iso: string
    mwRequested: number
  }
>

function tileStyle(): maplibregl.StyleSpecification | string {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY
  if (key) {
    return `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${key}`
  }
  return {
    version: 8,
    sources: {
      darkMatter: {
        type: "raster",
        tiles: [
          "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
          "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
          "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
        ],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors © CARTO"
      }
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: {
          "background-color": "#151515"
        }
      },
      {
        id: "dark-matter",
        type: "raster",
        source: "darkMatter",
        paint: {
          "raster-brightness-min": 0.08,
          "raster-contrast": -0.06,
          "raster-saturation": -0.12
        }
      }
    ]
  }
}

function projectsToGeoJson(projects: AnalysisHeatmapProject[]): HeatmapFeatureCollection {
  return {
    type: "FeatureCollection",
    features: projects.map((project) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [project.lng, project.lat]
      },
      properties: {
        id: project.id,
        iso: project.iso,
        mwRequested: project.mwRequested
      }
    }))
  }
}

export function ActiveMwHeatmap({ projects }: { projects: AnalysisHeatmapProject[] }) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const geoJson = useMemo(() => projectsToGeoJson(projects), [projects])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: tileStyle(),
      center: [-98.5, 39],
      zoom: 3.2,
      minZoom: 2.6,
      maxZoom: 8,
      maxBounds: USA_BOUNDS
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right")

    map.on("load", () => {
      map.addSource("active-mw-heatmap", {
        type: "geojson",
        data: geoJson
      })

      map.addLayer({
        id: "active-mw-heatmap",
        type: "heatmap",
        source: "active-mw-heatmap",
        maxzoom: 8,
        paint: {
          "heatmap-weight": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "mwRequested"], 0],
            0,
            0,
            100,
            0.12,
            500,
            0.5,
            1000,
            0.86,
            2000,
            1
          ],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 2.5, 0.55, 5, 1.25, 8, 2],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 2.5, 14, 5, 28, 8, 42],
          "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 2.5, 0.72, 7.5, 0.9],
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(3, 7, 18, 0)",
            0.12,
            "rgba(30, 64, 175, 0.55)",
            0.28,
            "rgba(14, 165, 233, 0.72)",
            0.46,
            "rgba(250, 204, 21, 0.78)",
            0.66,
            "rgba(249, 115, 22, 0.86)",
            0.86,
            "rgba(220, 38, 38, 0.94)",
            1,
            "rgba(153, 27, 27, 0.98)"
          ]
        }
      })
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded() || !map.getSource("active-mw-heatmap")) {
      return
    }
    ;(map.getSource("active-mw-heatmap") as GeoJSONSource).setData(geoJson)
  }, [geoJson])

  return (
    <section
      aria-label="Active MW heatmap"
      className="overflow-hidden rounded-md border border-border bg-card shadow-md"
    >
      <div className="flex h-12 items-center justify-between gap-3 border-b border-border bg-card/95 px-4 backdrop-blur">
        <div className="flex min-w-0 items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-medium">Active MW heatmap</h2>
            <p className="truncate text-xs text-muted-foreground">
              Queued-active project capacity across supported USA markets
            </p>
          </div>
        </div>
        <div className="hidden items-center gap-2 sm:flex" aria-hidden="true">
          <span className="h-2.5 w-8 rounded-sm bg-blue-700/70" />
          <span className="h-2.5 w-8 rounded-sm bg-cyan-500/70" />
          <span className="h-2.5 w-8 rounded-sm bg-yellow-400/80" />
          <span className="h-2.5 w-8 rounded-sm bg-orange-500/85" />
          <span className="h-2.5 w-8 rounded-sm bg-red-600/90" />
        </div>
      </div>
      <div className="relative h-[520px]">
        <div ref={mapContainerRef} className="absolute inset-0" />
        {projects.length === 0 ? (
          <div className="absolute left-5 bottom-5 rounded-md border border-border bg-card/90 px-4 py-3 text-sm text-muted-foreground shadow-md backdrop-blur">
            No active project coordinates available.
          </div>
        ) : null}
      </div>
    </section>
  )
}
