import React, {
  type CSSProperties,
  useEffect,
  useRef,
  useState,
} from 'react';
import { motion } from 'framer-motion';

type EyeGeometry = {
  cx: number;
  cy: number;
  orbitR: number;
  pupilR: number;
  defOx: number;
  defOy: number;
};

type Gaze = {
  lx: number;
  ly: number;
  rx: number;
  ry: number;
};

export type WufanLoginMascotProps = {
  className?: string;
  style?: CSSProperties;
  desktopOnly?: boolean;
};

const LEFT_EYE: EyeGeometry = {
  cx: 17,
  cy: 14,
  orbitR: 3.8,
  pupilR: 2.2,
  defOx: 1.8,
  defOy: -0.5,
};

const RIGHT_EYE: EyeGeometry = {
  cx: 25,
  cy: 18,
  orbitR: 3.2,
  pupilR: 1.8,
  defOx: 1.5,
  defOy: -0.5,
};

const DEFAULT_GAZE: Gaze = {
  lx: LEFT_EYE.defOx,
  ly: LEFT_EYE.defOy,
  rx: RIGHT_EYE.defOx,
  ry: RIGHT_EYE.defOy,
};

function constrainPupil(
  eye: EyeGeometry,
  offsetX: number,
  offsetY: number,
): { cx: number; cy: number } {
  const availableRadius = eye.orbitR - eye.pupilR;
  const distance = Math.hypot(offsetX, offsetY);

  if (distance <= availableRadius) {
    return {
      cx: eye.cx + offsetX,
      cy: eye.cy + offsetY,
    };
  }

  const scale = availableRadius / distance;
  return {
    cx: eye.cx + offsetX * scale,
    cy: eye.cy + offsetY * scale,
  };
}

/**
 * Exact-source reconstruction of the current Wufan login mascot.
 *
 * Default placement, SVG geometry, colors, pointer tracking, blink cadence and
 * float motion match the archived production implementation in SRC-013.
 * Keep the default props and mount one instance per document for strict reuse.
 */
export function WufanLoginMascot({
  className,
  style,
  desktopOnly = true,
}: WufanLoginMascotProps): React.ReactElement {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window === 'undefined'
      ? false
      : window.matchMedia('(max-width: 767px)').matches,
  );
  const [isBlinking, setIsBlinking] = useState(false);
  const [gaze, setGaze] = useState<Gaze>(DEFAULT_GAZE);
  const targetGazeRef = useRef<Gaze>(DEFAULT_GAZE);
  const currentGazeRef = useRef<Gaze>(DEFAULT_GAZE);
  const animationFrameRef = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const gazeResetTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    let blinkStartTimer: ReturnType<typeof setTimeout> | undefined;
    let blinkEndTimer: ReturnType<typeof setTimeout> | undefined;

    const scheduleBlink = () => {
      blinkStartTimer = setTimeout(() => {
        setIsBlinking(true);
        blinkEndTimer = setTimeout(() => {
          setIsBlinking(false);
        }, 150);
        scheduleBlink();
      }, 3000 + Math.random() * 4000);
    };

    scheduleBlink();

    return () => {
      if (blinkStartTimer) {
        clearTimeout(blinkStartTimer);
      }
      if (blinkEndTimer) {
        clearTimeout(blinkEndTimer);
      }
    };
  }, []);

  useEffect(() => {
    const lerp = (from: number, to: number, amount: number) =>
      from + (to - from) * amount;

    const animateGaze = () => {
      const current = currentGazeRef.current;
      const target = targetGazeRef.current;
      const next: Gaze = {
        lx: lerp(current.lx, target.lx, 0.08),
        ly: lerp(current.ly, target.ly, 0.08),
        rx: lerp(current.rx, target.rx, 0.08),
        ry: lerp(current.ry, target.ry, 0.08),
      };

      currentGazeRef.current = next;
      setGaze({ ...next });
      animationFrameRef.current = requestAnimationFrame(animateGaze);
    };

    animationFrameRef.current = requestAnimationFrame(animateGaze);
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, []);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const root = rootRef.current;
      if (!root) {
        return;
      }

      const bounds = root.getBoundingClientRect();
      const eyeAnchorX = bounds.right - bounds.width * 0.35;
      const eyeAnchorY = bounds.top + bounds.height * 0.42;
      const deltaX = event.clientX - eyeAnchorX;
      const deltaY = event.clientY - eyeAnchorY;

      if (gazeResetTimerRef.current) {
        clearTimeout(gazeResetTimerRef.current);
      }

      if (deltaX > 0) {
        gazeResetTimerRef.current = setTimeout(() => {
          targetGazeRef.current = DEFAULT_GAZE;
        }, 200);
        return;
      }

      const angle = Math.atan2(deltaY, -deltaX);
      const maxAngle = (70 * Math.PI) / 180;
      if (Math.abs(angle) > maxAngle) {
        gazeResetTimerRef.current = setTimeout(() => {
          targetGazeRef.current = DEFAULT_GAZE;
        }, 200);
        return;
      }

      const distance = Math.hypot(deltaX, deltaY);
      const strength = Math.min(distance / 300, 1);
      const safeDistance = distance || 1;
      const directionX = deltaX / safeDistance;
      const directionY = deltaY / safeDistance;
      const leftRange = LEFT_EYE.orbitR - LEFT_EYE.pupilR;
      const rightRange = RIGHT_EYE.orbitR - RIGHT_EYE.pupilR;

      gazeResetTimerRef.current = setTimeout(() => {
        targetGazeRef.current = {
          lx: -directionX * leftRange * strength,
          ly: directionY * leftRange * strength,
          rx: -directionX * rightRange * strength,
          ry: directionY * rightRange * strength,
        };
      }, 200);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (gazeResetTimerRef.current) {
        clearTimeout(gazeResetTimerRef.current);
      }
    };
  }, []);

  const leftPupil = constrainPupil(LEFT_EYE, gaze.lx, gaze.ly);
  const rightPupil = constrainPupil(RIGHT_EYE, gaze.rx, gaze.ry);

  if (desktopOnly && isMobile) {
    return <></>;
  }

  return (
    <div
      ref={rootRef}
      className={className}
      aria-hidden="true"
      style={{
        position: 'absolute',
        right: 'clamp(384px, 28.4vw, 444px)',
        top: '52%',
        transform: 'translateY(-50%) scaleX(-1)',
        zIndex: 1,
        pointerEvents: 'none',
        ...style,
      }}
    >
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <svg
          width="240"
          height="300"
          viewBox="0 0 30 38"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <linearGradient
              id="mascot-login-peek"
              x1="0"
              y1="0"
              x2="1"
              y2="1"
            >
              <stop offset="0%" stopColor="#EC4899" />
              <stop offset="50%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
          </defs>

          <ellipse
            cx="6"
            cy="19"
            rx="24"
            ry="19"
            fill="url(#mascot-login-peek)"
          />
          <circle cx="14" cy="1" r="3" fill="#EC4899" opacity="0.5" />

          {isBlinking ? (
            <>
              <path
                d="M14 14 Q17 11 20 14"
                stroke="white"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d="M22 18 Q25 15 28 18"
                stroke="white"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
              />
            </>
          ) : (
            <>
              <circle
                cx={LEFT_EYE.cx}
                cy={LEFT_EYE.cy}
                r={LEFT_EYE.orbitR}
                fill="white"
              />
              <circle
                cx={leftPupil.cx}
                cy={leftPupil.cy}
                r={LEFT_EYE.pupilR}
                fill="#1a1a2e"
              />
              <circle
                cx={leftPupil.cx - 1.2}
                cy={leftPupil.cy - 1}
                r="0.9"
                fill="rgba(255,255,255,0.85)"
              />
              <circle
                cx={RIGHT_EYE.cx}
                cy={RIGHT_EYE.cy}
                r={RIGHT_EYE.orbitR}
                fill="white"
              />
              <circle
                cx={rightPupil.cx}
                cy={rightPupil.cy}
                r={RIGHT_EYE.pupilR}
                fill="#1a1a2e"
              />
              <circle
                cx={rightPupil.cx - 1}
                cy={rightPupil.cy - 0.8}
                r="0.7"
                fill="rgba(255,255,255,0.85)"
              />
            </>
          )}
        </svg>
      </motion.div>
    </div>
  );
}

export default WufanLoginMascot;
