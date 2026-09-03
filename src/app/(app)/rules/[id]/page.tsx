import { RuleDetail } from "@/components/rules-page";
export default async function Page({ params }: PageProps<"/rules/[id]">) { const { id } = await params; return <RuleDetail id={id} />; }
