import { useEffect, useRef } from "react";

/**
 * Calls `onReach` whenever the element is on screen. The observer is
 * recreated when `deps` change, which re-checks the position: revealing
 * content that leaves the sentinel in view triggers the next step.
 */
export function useSentinel<T extends Element>(
  onReach: () => void,
  deps: unknown[],
  margin = "400px",
) {
  const ref = useRef<T | null>(null);
  const callback = useRef(onReach);
  useEffect(() => {
    callback.current = onReach;
  });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) callback.current();
      },
      { rootMargin: margin },
    );
    observer.observe(element);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [margin, ...deps]);
  return ref;
}
