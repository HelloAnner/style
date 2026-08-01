import type { CSSProperties, ReactNode } from 'react';
import styles from './AgentHome.module.css';
import { useCursorSpotlight } from './useCursorSpotlight';

type AgentHomeBackgroundProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function AgentHomeBackground({ children, className, style }: AgentHomeBackgroundProps) {
  const spotlight = useCursorSpotlight<HTMLDivElement>();
  const rootClassName = [styles.background, className].filter(Boolean).join(' ');

  return (
    <div
      ref={spotlight.ref}
      className={rootClassName}
      style={style}
      onPointerMove={spotlight.onPointerMove}
      onPointerEnter={spotlight.onPointerEnter}
      onPointerLeave={spotlight.onPointerLeave}
    >
      <div className={styles.dotLayer} aria-hidden="true" />
      <div className={styles.highlightDotLayer} aria-hidden="true" />
      <div className={styles.spotlightLayer} aria-hidden="true" />
      <div className={styles.contentLayer}>{children}</div>
    </div>
  );
}
