import {
  useCallback,
  useEffect,
  useRef,
  type PointerEventHandler,
  type RefCallback,
} from 'react';

type Point = {
  clientX: number;
  clientY: number;
};

export type CursorSpotlightBindings<T extends HTMLElement> = {
  ref: RefCallback<T>;
  onPointerMove: PointerEventHandler<T>;
  onPointerEnter: PointerEventHandler<T>;
  onPointerLeave: PointerEventHandler<T>;
};

function canUseCursorSpotlight(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;

  return !prefersReducedMotion && !coarsePointer;
}

export function useCursorSpotlight<T extends HTMLElement>(): CursorSpotlightBindings<T> {
  const nodeRef = useRef<T | null>(null);
  const frameRef = useRef<number | null>(null);
  const pointRef = useRef<Point | null>(null);
  const enabledRef = useRef(true);

  const commitPoint = useCallback(() => {
    frameRef.current = null;

    const node = nodeRef.current;
    const point = pointRef.current;
    if (!node || !point || !enabledRef.current) return;

    const rect = node.getBoundingClientRect();
    const x = point.clientX - rect.left;
    const y = point.clientY - rect.top;

    node.style.setProperty('--moss-home-cursor-x', `${x}px`);
    node.style.setProperty('--moss-home-cursor-y', `${y}px`);
    node.style.setProperty('--moss-home-spotlight-opacity', '1');
  }, []);

  const schedulePoint = useCallback(
    (point: Point) => {
      if (!enabledRef.current) return;

      pointRef.current = point;
      if (frameRef.current !== null) return;

      frameRef.current = window.requestAnimationFrame(commitPoint);
    },
    [commitPoint],
  );

  const ref = useCallback<RefCallback<T>>((node) => {
    nodeRef.current = node;
    enabledRef.current = canUseCursorSpotlight();

    if (!node) return;

    node.style.setProperty('--moss-home-cursor-x', '50%');
    node.style.setProperty('--moss-home-cursor-y', '35%');
    node.style.setProperty('--moss-home-spotlight-opacity', enabledRef.current ? '0.72' : '0');
  }, []);

  const onPointerMove = useCallback<PointerEventHandler<T>>(
    (event) => {
      if (event.pointerType === 'touch') return;
      schedulePoint({ clientX: event.clientX, clientY: event.clientY });
    },
    [schedulePoint],
  );

  const onPointerEnter = useCallback<PointerEventHandler<T>>(
    (event) => {
      if (event.pointerType === 'touch') return;
      schedulePoint({ clientX: event.clientX, clientY: event.clientY });
    },
    [schedulePoint],
  );

  const onPointerLeave = useCallback<PointerEventHandler<T>>(() => {
    const node = nodeRef.current;
    if (!node) return;
    node.style.setProperty('--moss-home-spotlight-opacity', '0');
  }, []);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return { ref, onPointerMove, onPointerEnter, onPointerLeave };
}
