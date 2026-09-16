import { useEffect, useRef, useState } from "react";

/** Whether the element is on screen; with `once`, stays true after the first time. */
export function useInView<T extends Element>(margin = "200px", once = true) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || (once && inView)) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setInView(true);
        else if (!once) setInView(false);
      },
      { rootMargin: margin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [inView, margin, once]);
  return { ref, inView };
}
