"use client"

import type { HeadroomReport, HeadroomScore } from "@gridpath/shared"
import { Loader2, MapPin, Zap } from "lucide-react"
import maplibregl, { type Map as MapLibreMap, type Marker } from "maplibre-gl"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

import "maplibre-gl/dist/maplibre-gl.css"

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
    layers: [{ id: "dark-matter", type: "raster", source: "darkMatter" }]
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

type Props = {
  initialReport: HeadroomReport | null
  initialRadius: number
}

export function HeadroomExplorer({ initialReport, initialRadius }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const radiusCircleAddedRef = useRef(false)

  const [radius, setRadius] = useState(initialRadius)
  const [latInput, setLatInput] = useState(initialReport?.center.lat.toFixed(4) ?? "")
  const [lngInput, setLngInput] = useState(initialReport?.center.lng.toFixed(4) ?? "")
  const [isPending, setIsPending] = useState(false)

  const center = useMemo(() => initialReport?.center ?? null, [initialReport])

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
      center: center ? [center.lng, center.lat] : [-99.35, 31.05],
      zoom: center ? 8 : 4.5
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right")

    map.on("click", (event) => {
      const { lng, lat } = event.lngLat
      setLatInput(lat.toFixed(4))
      setLngInput(lng.toFixed(4))
      pushReport(lat, lng, radius)
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
    // We intentionally initialize once; the pin/radius effects update state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Render the pin and radius circle when center/radius changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !center) return

    if (markerRef.current) {
      markerRef.current.setLngLat([center.lng, center.lat])
    } else {
      markerRef.current = new maplibregl.Marker({ color: "#22d3ee" })
        .setLngLat([center.lng, center.lat])
        .addTo(map)
    }

    const apply = () => {
      const radiusMeters = (initialReport?.radiusMiles ?? radius) * 1609.344
      const ring = buildCircleGeoJson(center.lng, center.lat, radiusMeters)
      if (radiusCircleAddedRef.current) {
        const source = map.getSource("headroom-radius") as maplibregl.GeoJSONSource | undefined
        source?.setData(ring)
      } else {
        if (!map.getSource("headroom-radius")) {
          map.addSource("headroom-radius", { type: "geojson", data: ring })
          map.addLayer({
            id: "headroom-radius-fill",
            type: "fill",
            source: "headroom-radius",
            paint: { "fill-color": "#22d3ee", "fill-opacity": 0.08 }
          })
          map.addLayer({
            id: "headroom-radius-line",
            type: "line",
            source: "headroom-radius",
            paint: { "line-color": "#22d3ee", "line-width": 1.5, "line-opacity": 0.7 }
          })
          radiusCircleAddedRef.current = true
        }
      }
      map.easeTo({ center: [center.lng, center.lat], zoom: 8, duration: 600 })
    }

    if (map.isStyleLoaded()) {
      apply()
    } else {
      map.once("load", apply)
    }
  }, [center, radius, initialReport?.radiusMiles])

  const handleManualSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const lat = Number(latInput)
      const lng = Number(lngInput)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
      pushReport(lat, lng, radius)
    },
    [latInput, lngInput, pushReport, radius]
  )

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full overflow-hidden">
      <div className="relative flex-1">
        <div ref={mapContainerRef} className="h-full w-full" />
        <div className="pointer-events-none absolute left-4 top-4 z-10 max-w-sm rounded-md bg-background/85 px-3 py-2 text-xs text-muted-foreground shadow backdrop-blur">
          <span className="font-medium text-foreground">Click anywhere</span> to analyze
          interconnect headroom in that area. Best for siting data centers, large loads,
          or new generation.
        </div>
        {isPending ? (
          <div className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-md bg-background/90 px-3 py-2 text-sm shadow">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing…
          </div>
        ) : null}
      </div>
      <aside className="flex w-[420px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-border bg-card/30 p-4">
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
            </form>
          </CardContent>
        </Card>

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
              <div key={sub.id} className="flex items-center justify-between text-sm">
                <span className="truncate pr-2 text-muted-foreground">
                  {sub.name ?? sub.hifldId}
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  {sub.voltageKv ? `${sub.voltageKv} kV` : "—"}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {sub.distanceMiles?.toFixed(1) ?? "?"} mi
                  </span>
                </span>
              </div>
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
