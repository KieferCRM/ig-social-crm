"use client";

import dynamic from "next/dynamic";

const SceneBackground = dynamic(() => import("./scene-background"), {
  ssr: false,
  loading: () => null,
});

export default function SceneBackgroundLazy() {
  return <SceneBackground />;
}
