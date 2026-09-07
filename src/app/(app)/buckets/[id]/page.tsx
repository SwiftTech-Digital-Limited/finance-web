import { ResourceDetail } from "@/components/resource-detail";
export default async function Page({ params }: PageProps<"/buckets/[id]">) {
  const { id } = await params;
  return <ResourceDetail kind="buckets" id={id} />;
}
