"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** The server render assumes online, so the page never flashes an offline banner before hydration. */
function readOnline(): boolean {
  return navigator.onLine;
}

/** True while the browser has a connection. The till sells online only (plan 3.9: no offline queue). */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, readOnline, () => true);
}
