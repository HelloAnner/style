import React, { useState } from 'react';
import styles from './ResizeHandle.module.css';

type Props = {
  onMouseDown: (e: React.MouseEvent) => void;
  ariaLabel?: string;
  testId?: string;
};

export const ResizeHandle: React.FC<Props> = ({ onMouseDown, ariaLabel, testId }) => {
  const [active, setActive] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    setActive(true);
    const release = () => {
      setActive(false);
      document.removeEventListener('mouseup', release);
    };
    document.addEventListener('mouseup', release);
    onMouseDown(e);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      className={styles.handle}
      data-testid={testId}
      data-active={active ? 'true' : 'false'}
      onMouseDown={handleMouseDown}
    >
      <div className={styles.line} />
    </div>
  );
};
