import { Suspense } from "react";
import { BackfillWizard } from "@/features/backfills/wizard";
import { LoadingBlock } from "@/components/ui-kit";

export default function DataSetupPage() {
  return (
    <Suspense fallback={<LoadingBlock rows={7} />}>
      <BackfillWizard />
    </Suspense>
  );
}
