"use client"

import type { AnalysisHeatmapProject, HeadroomReport, HeadroomScore } from "@gridpath/shared"
import { Check, Copy, Loader2, MapPin, Zap } from "lucide-react"
import maplibregl, {
  type GeoJSONSource,
  type Map as MapLibreMap,
  type Marker
} from "maplibre-gl"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

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
      { id: "dark-matter", type: "raster", source: "darkMatter" }
    ]
  }
}

const scoreStyles: Record<HeadroomScore, { label: string; className: string; tone: string }> = {
  high: {
    label: "High headroom",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    tone: "emerald"
  },
  medium: {
    label: "Medium headroom",
    className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    tone: "amber"
  },
  low: {
    label: "Low headroom",
    className: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    tone: "orange"
  },
  saturated: {
    label: "Saturated",
    className: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    tone: "rose"
  }
}

function formatMw(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)} GW`
  }
  return `${Math.round(value).toLocaleString()} MW`
}

function formatMonths(value: number | null): string {
  if (value === null) return "—"
  if (value < 1) return "<1 mo"
  return `${value.toFixed(1)} mo`
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

type Props = {
  initialReport: HeadroomReport | null
  initialRadius: number
  heatmapProjects: AnalysisHeatmapProject[]
  readOnly?: boolean
}

export function HeadroomExplorer({
  initialReport,
  initialRadius,
  heatmapProjects,
  readOnly = false
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const radiusCircleAddedRef = useRef(false)
  const radiusRef = useRef(initialRadius)

  const [radius, setRadius] = useState(initialRadius)
  const [latInput, setLatInput] = useState(initialReport?.center.lat.toFixed(4) ?? "")
  const [lngInput, setLngInput] = useState(initialReport?.center.lng.toFixed(4) ?? "")
  const [selectedCenter, setSelectedCenter] = useState(initialReport?.center ?? null)
  const [isPending, setIsPending] = useState(false)

  const heatmapGeoJson = useMemo(() => projectsToGeoJson(heatmapProjects), [heatmapProjects])

  const pushReport = useCallback(
    (lat: number, lng: number, radiusMi: number) => {
      const params = new URLSearchParams()
      params.set("lat", lat.toFixed(5))
      params.set("lng", lng.toFixed(5))
      params.set("radius", String(Math.round(radiusMi)))
      setIsPending(true)
      router.push(`/headroom?${params.toString()}`)
    },
    [router]
  )

  const analyzeLocation = useCallback(
    (lat: number, lng: number, radiusMi: number) => {
      setLatInput(lat.toFixed(4))
      setLngInput(lng.toFixed(4))
      setSelectedCenter({ lat, lng })
      pushReport(lat, lng, radiusMi)
    },
    [pushReport]
  )

  useEffect(() => {
    radiusRef.current = radius
  }, [radius])

  useEffect(() => {
    if (!initialReport) return
    setSelectedCenter(initialReport.center)
    setLatInput(initialReport.center.lat.toFixed(4))
    setLngInput(initialReport.center.lng.toFixed(4))
    setRadius(initialReport.radiusMiles)
  }, [initialReport])

  // Reset pending state when the URL actually changes
  useEffect(() => {
    setIsPending(false)
  }, [searchParams])

  // Initialize the map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return
    }
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: tileStyle(),
      center: selectedCenter ? [selectedCenter.lng, selectedCenter.lat] : [-99.35, 31.05],
      zoom: selectedCenter ? 8 : 4.5,
      minZoom: 2.7,
      maxZoom: 11,
      maxBounds: USA_BOUNDS
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right")

    if (!readOnly) {
      map.on("click", (event) => {
        const { lng, lat } = event.lngLat
        analyzeLocation(lat, lng, radiusRef.current)
      })
    }

    return () => {
      map.remove()
      mapRef.current = null
    }
    // We intentionally initialize once; the pin/radius effects update state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Render the all-USA development density layer underneath the selected radius.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const apply = () => {
      const existingSource = map.getSource("headroom-development-heatmap") as
        | GeoJSONSource
        | undefined

      if (existingSource) {
        existingSource.setData(heatmapGeoJson)
        return
      }

      map.addSource("headroom-development-heatmap", {
        type: "geojson",
        data: heatmapGeoJson
      })

      map.addLayer({
        id: "headroom-development-heatmap",
        type: "heatmap",
        source: "headroom-development-heatmap",
        maxzoom: 10,
        paint: {
          "heatmap-weight": [
            "interpolate",
            ["linear"],
            ["min", ["coalesce", ["get", "mwRequested"], 0], 3000],
            0,
            0,
            50,
            0.06,
            250,
            0.2,
            750,
            0.45,
            1500,
            0.72,
            3000,
            1
          ],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 3, 0.7, 6, 1.2, 9, 1.8],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 3, 9, 5, 15, 8, 26, 10, 42],
          "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0.68, 8, 0.84, 10, 0.74],
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(3, 7, 18, 0)",
            0.1,
            "rgba(30, 64, 175, 0.48)",
            0.24,
            "rgba(14, 165, 233, 0.68)",
            0.44,
            "rgba(250, 204, 21, 0.76)",
            0.64,
            "rgba(249, 115, 22, 0.84)",
            0.86,
            "rgba(220, 38, 38, 0.94)",
            1,
            "rgba(153, 27, 27, 0.98)"
          ]
        }
      })
    }

    if (map.isStyleLoaded()) {
      apply()
    } else {
      map.once("load", apply)
    }
  }, [heatmapGeoJson])

  // Render the pin and radius circle when center/radius changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedCenter) return

    if (markerRef.current) {
      markerRef.current.setLngLat([selectedCenter.lng, selectedCenter.lat])
    } else {
      markerRef.current = new maplibregl.Marker({ color: "#22d3ee" })
        .setLngLat([selectedCenter.lng, selectedCenter.lat])
        .addTo(map)
    }

    const apply = () => {
      const radiusMeters = radius * 1609.344
      const ring = buildCircleGeoJson(selectedCenter.lng, selectedCenter.lat, radiusMeters)
      const source = map.getSource("headroom-radius") as maplibregl.GeoJSONSource | undefined
      if (source) {
        source.setData(ring)
        radiusCircleAddedRef.current = true
      } else {
        map.addSource("headroom-radius", { type: "geojson", data: ring })
      }
      if (!map.getLayer("headroom-radius-fill")) {
        map.addLayer({
          id: "headroom-radius-fill",
          type: "fill",
          source: "headroom-radius",
          paint: { "fill-color": "#22d3ee", "fill-opacity": 0.08 }
        })
      }
      if (!map.getLayer("headroom-radius-line")) {
        map.addLayer({
          id: "headroom-radius-line",
          type: "line",
          source: "headroom-radius",
          paint: { "line-color": "#22d3ee", "line-width": 1.5, "line-opacity": 0.7 }
        })
      }
      radiusCircleAddedRef.current = true
      map.easeTo({ center: [selectedCenter.lng, selectedCenter.lat], zoom: 8, duration: 600 })
    }

    if (map.isStyleLoaded()) {
      apply()
    } else {
      map.once("load", apply)
    }
  }, [selectedCenter, radius])

  const handleManualSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const lat = Number(latInput)
      const lng = Number(lngInput)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
      analyzeLocation(lat, lng, radius)
    },
    [analyzeLocation, latInput, lngInput, radius]
  )

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full overflow-hidden">
      <div className="relative flex-1">
        <div ref={mapContainerRef} className="h-full w-full" />
        {readOnly ? null : (
          <div className="pointer-events-none absolute left-4 top-4 z-10 max-w-sm rounded-md bg-background/85 px-3 py-2 text-xs text-muted-foreground shadow backdrop-blur">
            <span className="font-medium text-foreground">Click anywhere</span> to analyze
            interconnect headroom in that area. Best for siting data centers, large loads,
            or new generation.
          </div>
        )}
        {isPending ? (
          <div className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-md bg-background/90 px-3 py-2 text-sm shadow">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing…
          </div>
        ) : null}
      </div>
      <aside className="flex w-[420px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-border bg-card/30 p-4">
        {readOnly ? null : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4" /> Pick a location
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleManualSubmit} className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="lat" className="text-xs text-muted-foreground">
                    Latitude
                  </Label>
                  <Input
                    id="lat"
                    value={latInput}
                    onChange={(event) => setLatInput(event.target.value)}
                    placeholder="32.7"
                    inputMode="decimal"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="lng" className="text-xs text-muted-foreground">
                    Longitude
                  </Label>
                  <Input
                    id="lng"
                    value={lngInput}
                    onChange={(event) => setLngInput(event.target.value)}
                    placeholder="-96.8"
                    inputMode="decimal"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label htmlFor="radius" className="text-xs text-muted-foreground">
                    Radius: {radius} mi
                  </Label>
                  <input
                    id="radius"
                    type="range"
                    min={5}
                    max={100}
                    step={5}
                    value={radius}
                    onChange={(event) => setRadius(Number(event.target.value))}
                    className="w-full"
                  />
                </div>
                <Button type="submit" className="col-span-2" disabled={isPending}>
                  Analyze
                </Button>
                {initialReport ? <ShareLinkButton report={initialReport} /> : null}
              </form>
            </CardContent>
          </Card>
        )}

        {initialReport ? (
          <ReportPanel report={initialReport} />
        ) : (
          <EmptyState />
        )}
      </aside>
    </div>
  )
}

function ReportPanel({ report }: { report: HeadroomReport }) {
  const score = scoreStyles[report.score]
  return (
    <>
      <Card>
        <CardContent className="space-y-3 pt-4">
          <div
            className={cn(
              "rounded-md border px-3 py-2 text-sm font-medium",
              score.className
            )}
          >
            {score.label}
          </div>
          <p className="text-sm text-muted-foreground">{report.scoreRationale}</p>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Metric label="Queued" value={formatMw(report.mwQueued)} />
            <Metric label="Energized" value={formatMw(report.mwEnergized)} />
            <Metric label="Projects" value={report.projectsInArea.toLocaleString()} />
            <Metric label="Median queue" value={formatMonths(report.medianQueueMonths)} />
          </div>
          {report.isoCoverage.length > 0 ? (
            <p className="pt-1 text-xs text-muted-foreground">
              ISO{report.isoCoverage.length > 1 ? "s" : ""}: {report.isoCoverage.join(", ")}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {report.fuelBreakdown.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Fuel mix in area</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {report.fuelBreakdown.slice(0, 6).map((row) => (
              <div key={row.fuelType} className="flex items-center justify-between text-sm">
                <span className="capitalize text-muted-foreground">{row.fuelType}</span>
                <span className="font-medium">
                  {formatMw(row.mwQueued)}{" "}
                  <span className="text-xs text-muted-foreground">
                    · {row.projectCount} proj
                  </span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {report.nearbySubstations.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Zap className="h-4 w-4" /> Nearest substations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {report.nearbySubstations.slice(0, 6).map((sub) => (
              <Link
                key={sub.id}
                href={`/substations/${sub.id}`}
                className="flex items-center justify-between rounded px-1 py-0.5 text-sm hover:bg-card"
              >
                <span className="truncate pr-2 text-muted-foreground">
                  {sub.name ?? sub.hifldId}
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  {sub.voltageKv ? `${sub.voltageKv} kV` : "—"}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {sub.distanceMiles?.toFixed(1) ?? "?"} mi
                  </span>
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {report.nearbyProjects.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top nearby projects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {report.nearbyProjects.slice(0, 8).map((proj) => (
              <a
                key={proj.id}
                href={`/projects/${proj.id}`}
                className="flex items-center justify-between gap-2 rounded px-1 py-0.5 text-sm hover:bg-card"
              >
                <span className="truncate pr-2">
                  {proj.projectName ?? proj.queueId}
                  <span className="ml-1 text-xs text-muted-foreground">
                    · {proj.iso}
                  </span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {proj.mwRequested ? `${Math.round(proj.mwRequested)} MW` : "—"}
                </span>
              </a>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/40 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="space-y-2 pt-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">No location selected yet</p>
        <p>
          Click anywhere on the map, or enter coordinates above. We&apos;ll show queued
          MW, nearby substations, project mix, and a headroom score for the area.
        </p>
        <p className="pt-1 text-xs">
          Try Loudoun County, VA (39.05, -77.62) for a data-center hotspot, or West Texas
          (32.0, -101.5) for a high-headroom corridor.
        </p>
      </CardContent>
    </Card>
  )
}

function ShareLinkButton({ report }: { report: HeadroomReport }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams({
      lat: report.center.lat.toFixed(5),
      lng: report.center.lng.toFixed(5),
      radius: String(report.radiusMiles)
    })
    const url = `${window.location.origin}/share/headroom?${params.toString()}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API can be unavailable on non-HTTPS or older browsers; fall back to prompt
      window.prompt("Copy this share link:", url)
    }
  }, [report])

  return (
    <Button
      type="button"
      variant="secondary"
      className="col-span-2"
      onClick={handleCopy}
    >
      {copied ? (
        <>
          <Check className="mr-1.5 h-3.5 w-3.5" /> Copied!
        </>
      ) : (
        <>
          <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy share link
        </>
      )}
    </Button>
  )
}

function buildCircleGeoJson(
  lng: number,
  lat: number,
  radiusMeters: number,
  points = 64
): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = []
  const earthRadius = 6378137
  const latRad = (lat * Math.PI) / 180
  for (let i = 0; i <= points; i += 1) {
    const angle = (i / points) * 2 * Math.PI
    const dx = radiusMeters * Math.cos(angle)
    const dy = radiusMeters * Math.sin(angle)
    const deltaLat = (dy / earthRadius) * (180 / Math.PI)
    const deltaLng = ((dx / earthRadius) * (180 / Math.PI)) / Math.cos(latRad)
    coords.push([lng + deltaLng, lat + deltaLat])
  }
  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [coords] },
    properties: {}
  }
}
