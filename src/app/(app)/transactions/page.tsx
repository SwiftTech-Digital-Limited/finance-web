import { Suspense } from "react";
import { TransactionsPage } from "@/components/transactions-page";
import { LoadingBlock } from "@/components/ui-kit";
export default function Page() { return <Suspense fallback={<LoadingBlock rows={6} />}><TransactionsPage /></Suspense>; }
