import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  delay?: number;
}

export default function Tooltip({ content, children, delay = 100, disablePinOnClick = false }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLElement | null>(null);

  const showTooltip = useCallback((target: HTMLElement) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      if (!target) {
        return;
      }
      
      const rect = target.getBoundingClientRect();
      setPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
      });
      setIsVisible(true);
    }, delay);
  }, [delay]);

  const hideTooltip = useCallback(() => {
    if (isPinned) return; // Don't hide if pinned
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  }, [isPinned]);

  const handleTooltipClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent click from bubbling to document
    if (!disablePinOnClick) {
      setIsPinned(true);
    } else {
      // If pinning is disabled, prevent any pinning behavior
      e.preventDefault();
    }
  }, [disablePinOnClick]);

  const handleUnpin = useCallback(() => {
    setIsPinned(false);
    setIsVisible(false);
  }, []);

  // Handle click outside to close pinned tooltip
  useEffect(() => {
    if (!isPinned) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        // Check if click is on another tooltip (nested tooltip)
        const target = e.target as HTMLElement;
        const isAnotherTooltip = target.closest('[data-tooltip-container]');
        if (!isAnotherTooltip) {
          handleUnpin();
        }
      }
    };

    // Use capture phase to catch clicks before they bubble
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [isPinned, handleUnpin]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isVisible || !tooltipRef.current) return;
    
    // Use requestAnimationFrame to ensure DOM is updated
    const adjustPosition = () => {
      const tooltip = tooltipRef.current;
      if (!tooltip) return;
      
      const rect = tooltip.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let x = position.x;
      let y = position.y;
      let needsUpdate = false;

      // Adjust horizontal position if tooltip goes off screen
      if (x + rect.width / 2 > viewportWidth) {
        x = viewportWidth - rect.width / 2 - 10;
        needsUpdate = true;
      } else if (x - rect.width / 2 < 0) {
        x = rect.width / 2 + 10;
        needsUpdate = true;
      }

      // Adjust vertical position if tooltip goes off screen
      if (y - rect.height < 0) {
        y = position.y + 30; // Show below instead
        needsUpdate = true;
      } else if (y + rect.height > viewportHeight) {
        y = position.y - rect.height - 10; // Show above instead
        needsUpdate = true;
      }

      // Only update if position actually changed
      if (needsUpdate) {
        setPosition({ x, y });
      }
    };

    // Delay adjustment to avoid infinite loop
    const timeoutId = setTimeout(adjustPosition, 0);
    return () => clearTimeout(timeoutId);
  }, [isVisible]); // Only depend on isVisible, not position

  const childWithHandlers = React.cloneElement(children as React.ReactElement<any>, {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      const originalProps = (children as React.ReactElement<any>).props;
      originalProps.onMouseEnter?.(e);
      // Store reference to target element before setTimeout
      const target = e.currentTarget as HTMLElement;
      targetRef.current = target;
      showTooltip(target);
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      const originalProps = (children as React.ReactElement<any>).props;
      originalProps.onMouseLeave?.(e);
      if (!isPinned) {
        targetRef.current = null;
        hideTooltip();
      }
    },
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      const originalProps = (children as React.ReactElement<any>).props;
      originalProps.onClick?.(e);
      // Pin tooltip on click (only if pinning is not disabled)
      if (!disablePinOnClick && !isPinned && isVisible) {
        setIsPinned(true);
      }
    },
    onMouseMove: (e: React.MouseEvent<HTMLElement>) => {
      const originalProps = (children as React.ReactElement<any>).props;
      originalProps.onMouseMove?.(e);
      // Update position on mouse move
      if (isVisible) {
        const target = e.currentTarget as HTMLElement | null;
        if (!target) return;
        
        const rect = target.getBoundingClientRect();
        setPosition({
          x: rect.left + rect.width / 2,
          y: rect.top - 10,
        });
      }
    },
  });

  return (
    <>
      {childWithHandlers}
      {isVisible && content &&
        createPortal(
          <div
            ref={tooltipRef}
            data-tooltip-container
            className="fixed z-[9999]"
            style={{
              left: `${position.x}px`,
              top: `${position.y}px`,
              transform: "translate(-50%, -100%)",
              willChange: "transform",
            }}
            onClick={disablePinOnClick ? undefined : handleTooltipClick}
            onMouseEnter={() => {
              // Keep tooltip visible when hovering over it
              if (!isPinned) {
                setIsVisible(true);
              }
            }}
            onMouseLeave={() => {
              // Only hide if not pinned
              if (!isPinned) {
                hideTooltip();
              }
            }}
          >
            <div className="bg-slate-800 text-white text-sm rounded-lg shadow-2xl border border-slate-600 min-w-[200px] max-w-md pointer-events-auto">
              {isPinned && (
                <div className="flex justify-end p-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUnpin();
                    }}
                    className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded"
                    title="Đóng"
                  >
                    ✕
                  </button>
                </div>
              )}
              <div className={isPinned ? "px-3 pb-3" : "p-3"}>
                {content}
              </div>
              {!isPinned && (
                <div className="absolute left-1/2 bottom-0 transform -translate-x-1/2 translate-y-full">
                  <div className="border-4 border-transparent border-t-slate-800"></div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}


