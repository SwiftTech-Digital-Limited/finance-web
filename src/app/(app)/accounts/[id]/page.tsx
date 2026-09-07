import { ResourceDetail } from "@/components/resource-detail";
export default async function Page({ params }: PageProps<"/accounts/[id]">) {
  const { id } = await params;
  return <ResourceDetail kind="accounts" id={id} />;
}
