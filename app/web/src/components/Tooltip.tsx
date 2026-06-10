import { useState, useRef, useCallback } from "react";
import { QuestionMarkIcon } from "./Icons";
import { createPortal } from "react-dom";

type TooltipProps = {
  children: string;
};

export default function Tooltip({ children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [bubbleStyle, setBubbleStyle] = useState<React.CSSProperties>({});
  const iconRef = useRef<HTMLSpanElement>(null);

  const show = useCallback(() => {
    if (!iconRef.current) return;
    const rect = iconRef.current.getBoundingClientRect();
    setBubbleStyle({
      position: "fixed",
      top: rect.top - 6,
      left: rect.left + rect.width / 2,
      transform: "translate(-50%, -100%)",
    });
    setVisible(true);
  }, []);

  const hide = useCallback(() => setVisible(false), []);

  return (
    <>
      <span
        ref={iconRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        className="inline-flex items-center align-middle text-discord-500 hover:text-discord-blurple transition-colors ml-1"
      >
        <QuestionMarkIcon />
      </span>
      {visible &&
        createPortal(
          <>
            <div
              className="z-[9999] w-56 px-3 py-2 rounded-lg border border-white/10 bg-discord-800 text-xs leading-relaxed text-discord-200 shadow-soft text-center"
              style={bubbleStyle}
            >
              {children}
            </div>
          </>,
          document.body
        )}
    </>
  );
}
