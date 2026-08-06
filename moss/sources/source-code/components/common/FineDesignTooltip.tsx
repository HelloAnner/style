import React from 'react';
import { createPortal } from 'react-dom';

type FineDesignTooltipPlacement = 'top' | 'right' | 'bottom' | 'left';
type FineDesignTooltipAlign = 'center' | 'start' | 'end';

type TooltipPosition = {
  left: number;
  top: number;
  transform: string;
};

interface FineDesignTooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  placement?: FineDesignTooltipPlacement;
  align?: FineDesignTooltipAlign;
  offset?: number;
  disabled?: boolean;
  tooltipId?: string;
  testId?: string;
  wrapperStyle?: React.CSSProperties;
  onOpenChange?: (open: boolean) => void;
}

function getTooltipPosition(
  rect: DOMRect,
  placement: FineDesignTooltipPlacement,
  align: FineDesignTooltipAlign,
  offset: number,
): TooltipPosition {
  if (placement === 'right') {
    return {
      left: rect.right + offset,
      top: rect.top + rect.height / 2,
      transform: 'translateY(-50%)',
    };
  }

  if (placement === 'left') {
    return {
      left: rect.left - offset,
      top: rect.top + rect.height / 2,
      transform: 'translate(-100%, -50%)',
    };
  }

  if (placement === 'top') {
    if (align === 'start') {
      return {
        left: rect.left,
        top: rect.top - offset,
        transform: 'translateY(-100%)',
      };
    }
    if (align === 'end') {
      return {
        left: rect.right,
        top: rect.top - offset,
        transform: 'translate(-100%, -100%)',
      };
    }
    return {
      left: rect.left + rect.width / 2,
      top: rect.top - offset,
      transform: 'translate(-50%, -100%)',
    };
  }

  if (align === 'start') {
    return {
      left: rect.left,
      top: rect.bottom + offset,
      transform: 'none',
    };
  }
  if (align === 'end') {
    return {
      left: rect.right,
      top: rect.bottom + offset,
      transform: 'translateX(-100%)',
    };
  }
  return {
    left: rect.left + rect.width / 2,
    top: rect.bottom + offset,
    transform: 'translateX(-50%)',
  };
}

export const FineDesignTooltip: React.FC<FineDesignTooltipProps> = ({
  content,
  children,
  placement = 'bottom',
  align = 'center',
  offset = 8,
  disabled = false,
  tooltipId,
  testId,
  wrapperStyle,
  onOpenChange,
}) => {
  const wrapperRef = React.useRef<HTMLSpanElement | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);
  const [position, setPosition] = React.useState<TooltipPosition | null>(null);

  const updatePosition = React.useCallback(() => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition(getTooltipPosition(rect, placement, align, offset));
  }, [align, offset, placement]);

  const setOpen = React.useCallback((nextOpen: boolean) => {
    if (disabled && nextOpen) return;
    setIsOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }, [disabled, onOpenChange]);

  React.useEffect(() => {
    if (!isOpen) return undefined;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  const tooltip = isOpen && position && typeof document !== 'undefined'
    ? createPortal(
      <span
        id={tooltipId}
        role="tooltip"
        data-finedesign-tooltip={testId}
        style={{
          position: 'fixed',
          left: position.left,
          top: position.top,
          transform: position.transform,
          zIndex: 1000,
          padding: '4px 8px',
          borderRadius: 6,
          background: 'var(--moss-sidebar-tooltip-bg)',
          color: 'var(--moss-sidebar-tooltip-fg)',
          boxShadow: 'var(--moss-sidebar-tooltip-shadow)',
          fontSize: 12,
          fontWeight: 500,
          lineHeight: '18px',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}
      >
        {content}
      </span>,
      document.body,
    )
    : null;

  const child = tooltipId
    ? React.cloneElement(children, {
      'aria-describedby': isOpen ? tooltipId : children.props['aria-describedby'],
    })
    : children;

  return (
    <span
      ref={wrapperRef}
      data-finedesign-tooltip-wrapper={testId}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
      onClickCapture={() => setOpen(false)}
      style={{
        position: 'relative',
        display: 'inline-flex',
        ...wrapperStyle,
      }}
    >
      {child}
      {tooltip}
    </span>
  );
};

export default FineDesignTooltip;
