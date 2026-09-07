import { IncomeLineage } from "@/components/transaction-detail";
export default async function Page({
  params,
}: PageProps<"/transactions/[id]/lineage">) {
  const { id } = await params;
  return <IncomeLineage id={id} />;
}
