import type { SVGProps } from "react"

type FuelIconProps = SVGProps<SVGSVGElement> & { size?: number }

function base({ size = 16, ...rest }: FuelIconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...rest
  }
}

export function SolarIcon(props: FuelIconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
    </svg>
  )
}

export function WindIcon(props: FuelIconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 8h11a3 3 0 1 0-3-3" />
      <path d="M3 14h15a3 3 0 1 1-3 3" />
      <path d="M3 11h7" />
    </svg>
  )
}

export function StorageIcon(props: FuelIconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="7" width="15" height="10" rx="1.5" />
      <path d="M18 10h2v4h-2" />
      <path d="M7 12h2M11 10v4M14 10v4" />
    </svg>
  )
}

export function GasIcon(props: FuelIconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3c2 3 4 5 4 8a4 4 0 1 1-8 0c0-2 1.5-3.5 2.5-5 .5-.7.8-1.3 1.5-3z" />
      <path d="M12 16a2 2 0 0 0 2-2" />
    </svg>
  )
}

export function HydroIcon(props: FuelIconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3c3 4 6 7 6 11a6 6 0 1 1-12 0c0-4 3-7 6-11z" />
    </svg>
  )
}

export function OtherFuelIcon(props: FuelIconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4M12 16h0.01" />
    </svg>
  )
}

export const fuelIcons = {
  solar: SolarIcon,
  wind: WindIcon,
  storage: StorageIcon,
  gas: GasIcon,
  hydro: HydroIcon,
  other: OtherFuelIcon
} as const

export type FuelKey = keyof typeof fuelIcons

export function fuelIconFor(fuelType: string | null | undefined): typeof SolarIcon {
  const key = (fuelType ?? "").toLowerCase()
  if (key in fuelIcons) {
    return fuelIcons[key as FuelKey]
  }
  return OtherFuelIcon
}

export const fuelTokenClass: Record<FuelKey, string> = {
  solar: "text-fuel-solar",
  wind: "text-fuel-wind",
  storage: "text-fuel-storage",
  gas: "text-fuel-gas",
  hydro: "text-fuel-hydro",
  other: "text-fuel-other"
}

export function fuelTokenClassFor(fuelType: string | null | undefined): string {
  const key = (fuelType ?? "").toLowerCase()
  if (key in fuelTokenClass) {
    return fuelTokenClass[key as FuelKey]
  }
  return fuelTokenClass.other
}
