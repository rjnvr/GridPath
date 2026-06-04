import { SUPPORTED_ISOS } from "@gridpath/shared"

export function formatIsoList(isos: readonly string[] = SUPPORTED_ISOS) {
  if (isos.length <= 1) return isos.join("")
  return `${isos.slice(0, -1).join(", ")}, and ${isos[isos.length - 1]}`
}

export const SUPPORTED_ISO_LABEL = formatIsoList(SUPPORTED_ISOS)
