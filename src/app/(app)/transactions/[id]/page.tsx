import { TransactionDetail } from "@/components/transaction-detail";
export default async function Page({
  params,
}: PageProps<"/transactions/[id]">) {
  const { id } = await params;
  return <TransactionDetail id={id} />;
}
