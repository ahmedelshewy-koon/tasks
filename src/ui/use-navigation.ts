"use client";
import { useEffect, useState } from "react";
export function useMobileNavigation(open: boolean, close: () => void) {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 800px)");
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!open || !mobile) return;
    const panel = document.getElementById("task-navigation");
    const previous = document.activeElement as HTMLElement | null;
    const buttons = () =>
      Array.from(
        panel?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ||
          [],
      ).filter((el) => el.offsetParent !== null);
    buttons()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
      if (event.key === "Tab") {
        const list = buttons();
        const first = list[0],
          last = list[list.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [open, mobile, close]);
  return mobile;
}
