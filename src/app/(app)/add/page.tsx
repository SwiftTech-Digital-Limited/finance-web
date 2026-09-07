import { Suspense } from "react";
import { AddMoneyPage } from "@/components/add-money-page";
import { LoadingBlock } from "@/components/ui-kit";
export default function Page() {
  return (
    <Suspense fallback={<LoadingBlock rows={4} />}>
      <AddMoneyPage />
    </Suspense>
  );
}
