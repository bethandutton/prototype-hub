import { useEffect, useRef, useState } from "react";

// A live, scaled-down view of the prototype itself. No screenshots to keep
// fresh: the card always shows what is on disk right now.
export function Thumb({ id, tick }: { id: string; tick: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.2);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / 1200);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="thumb" ref={ref}>
      <iframe key={tick} src={`/p/${id}/`} sandbox="allow-scripts" loading="lazy" tabIndex={-1} title="" style={{ transform: `scale(${scale})` }} />
    </div>
  );
}
