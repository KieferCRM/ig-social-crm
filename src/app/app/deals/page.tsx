import DealsBoardClient from "./deals-board-client";
import { isPreviewModeServer } from "@/lib/preview-mode";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const preview = await isPreviewModeServer();
  return <DealsBoardClient preview={preview} />;
}
