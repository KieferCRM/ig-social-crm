"use client";

import { useEffect, useState } from "react";
import { isPreviewModeClient } from "@/lib/preview-mode";

export function usePreviewMode(): boolean {
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    setPreview(isPreviewModeClient());
  }, []);

  return preview;
}
