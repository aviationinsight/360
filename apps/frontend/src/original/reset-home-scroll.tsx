"use client";

import { useEffect } from "react";

export function ResetHomeScroll() {
  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    const reset = () => window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    reset();
    const timer = window.setTimeout(reset, 80);
    window.addEventListener("pageshow", reset);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pageshow", reset);
    };
  }, []);
  return null;
}
