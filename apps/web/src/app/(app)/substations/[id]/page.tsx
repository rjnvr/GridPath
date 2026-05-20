import { notFound } from "next/navigation"

import { SubstationDetail } from "@/components/substations/substation-detail"
import { getSubstationDetail } from "@/lib/data"

export const dynamic = "force-dynamic"

export default async function SubstationDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getSubstationDetail(id)
  if (!data) {
    notFound()
  }
  return <SubstationDetail data={data} />
}
