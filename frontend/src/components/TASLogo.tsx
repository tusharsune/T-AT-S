import React, { useState, useEffect, useRef } from 'react';

export interface TASLogoMarkProps {
  size?: number; // pixel height/width (1:1 aspect ratio)
  className?: string;
  useDetailed?: boolean; // only for size >= 64px
  animated?: boolean; // default false
}

/**
 * Renders the standalone mark without background tiles or borders.
 * When animated=false: uses tas_final_logo_mark_small.svg (<64px) or tas_final_logo_mark.svg (>=64px) via <img>.
 * When animated=true: renders INLINE SVG with Half-Facet Shift color animation running only when visible.
 */
export const TASLogoMark: React.FC<TASLogoMarkProps> = ({
  size = 44,
  className = '',
  useDetailed,
  animated = false
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!animated || !svgRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsRunning(entry.isIntersecting);
        });
      },
      { threshold: 0.2 }
    );
    observer.observe(svgRef.current);
    return () => observer.disconnect();
  }, [animated]);

  if (animated) {
    const clampedSize = Math.max(20, size);
    return (
      <svg
        ref={svgRef}
        viewBox="12 12 96 96"
        role="img"
        aria-label="T@S logo"
        width={clampedSize}
        height={clampedSize}
        style={{ width: `${clampedSize}px`, height: `${clampedSize}px` }}
        className={`tas-mark tas-mark--animated aspect-square shrink-0 select-none object-contain ${
          isRunning ? 'is-running' : ''
        } ${className}`}
      >
        <defs>
          <clipPath id="tas-tips-footer">
            <path d="M56.38,21.45 Q60,18 63.62,21.45 L100.38,56.55 Q104,60 100.38,63.45 L63.62,98.55 Q60,102 56.38,98.55 L19.62,63.45 Q16,60 19.62,56.55 Z" />
          </clipPath>
        </defs>
        <g clipPath="url(#tas-tips-footer)">
          <polygon className="f f-tl" points="60,18 38,42 60,60" fill="#ffd9b8" />
          <polygon className="f f-tr" points="60,18 82,42 60,60" fill="#ff9a3d" />
          <polygon className="f f-rt" points="82,42 104,60 60,60" fill="#ff7a29" />
          <polygon className="f f-rb" points="104,60 82,78 60,60" fill="#c93a1c" />
          <polygon className="f f-br" points="82,78 60,102 60,60" fill="#e0482a" />
          <polygon className="f f-bl" points="60,102 38,78 60,60" fill="#ffc99a" />
          <polygon className="f f-lb" points="38,78 16,60 60,60" fill="#e8542f" />
          <polygon className="f f-lt" points="16,60 38,42 60,60" fill="#ff8a30" />
        </g>
        <circle cx="60" cy="60" r="12.5" fill="#fff7ed" />
        <polygon points="60,51.5 68.5,60 60,68.5 51.5,60" fill="#1a1520" />
      </svg>
    );
  }

  // Static mark behavior (rule: minimum size small mark 20px, detailed mark 64px)
  const isDetailed = useDetailed !== undefined ? (useDetailed && size >= 64) : size >= 64;
  const clampedSize = Math.max(20, size);
  const src = isDetailed ? '/tas_final_logo_mark.svg' : '/tas_final_logo_mark_small.svg';

  return (
    <img
      src={src}
      alt=""
      width={clampedSize}
      height={clampedSize}
      style={{ width: `${clampedSize}px`, height: `${clampedSize}px` }}
      className={`aspect-square shrink-0 select-none object-contain ${className}`}
    />
  );
};

// Backwards compatibility alias
export const TASLogoIcon = TASLogoMark;

export interface TASHeaderLogoProps {
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  animated?: boolean;
  markSize?: number;
}

/**
 * Standard Header/Nav Brand Lockup (Always Static):
 * - 44px mark on desktop, 36px on mobile (1:1 aspect ratio)
 * - 12px gap
 * - Live HTML text wordmark: "T@S" (#1a1520 with @ in #ff6b4a)
 * - Live HTML tagline: "TALK · DECIDE · SOLVE" (#6b6470)
 * - Links to "/" with aria-label="T@S home"
 * - Hover scale 1.04 over 200ms ease, respecting prefers-reduced-motion
 */
export const TASHeaderLogo: React.FC<TASHeaderLogoProps> = ({
  onClick,
  className = '',
  animated = false,
  markSize
}) => {
  return (
    <a
      href="/"
      onClick={onClick}
      aria-label="T@S home"
      className={`group flex items-center gap-[12px] text-left focus:outline-none transition-transform duration-200 ease-out hover:scale-[1.04] motion-reduce:hover:scale-100 ${className}`}
    >
      <TASLogoMark
        animated={animated}
        size={markSize || 44}
        className="h-[36px] md:h-[44px] w-[36px] md:w-[44px]"
      />
      <div className="flex flex-col justify-center leading-none select-none">
        <span
          className="font-['Plus_Jakarta_Sans',Outfit,sans-serif] font-extrabold text-[20px] md:text-[22px] tracking-[0.12em] text-[#1a1520] leading-none"
        >
          T<span className="text-[#ff6b4a]">@</span>S
        </span>
        <span
          className="font-['Plus_Jakarta_Sans',Outfit,sans-serif] text-[9px] md:text-[9.5px] uppercase font-semibold tracking-[0.2em] text-[#6b6470] leading-none mt-1"
        >
          TALK · DECIDE · SOLVE
        </span>
      </div>
    </a>
  );
};

export interface TASDarkLockupProps {
  height?: number;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

/**
 * Static SVG lockup image for dark backgrounds
 */
export const TASDarkLockup: React.FC<TASDarkLockupProps> = ({
  height = 44,
  className = '',
  onClick
}) => {
  return (
    <a
      href="/"
      onClick={onClick}
      aria-label="T@S home"
      className={`inline-block transition-transform duration-200 ease-out hover:scale-[1.04] motion-reduce:hover:scale-100 ${className}`}
    >
      <img
        src="/tas_final_lockup_dark.svg"
        alt="T@S: Talk, Decide, Solve"
        style={{ height: `${height}px`, width: 'auto' }}
        className="shrink-0 select-none object-contain"
      />
    </a>
  );
};

export interface TASLogoProps {
  theme?: 'light' | 'dark';
  markSize?: number;
  animated?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

/**
 * General purpose brand lockup component.
 * When theme="dark": renders light text wordmark & tagline.
 * When animated=true: renders the Half-Facet Shift animated mark at 56px desktop / 44px mobile.
 */
export const TASLogo: React.FC<TASLogoProps> = ({
  theme = 'light',
  markSize,
  animated = false,
  className = '',
  onClick
}) => {
  const isDark = theme === 'dark';

  return (
    <a
      href="/"
      onClick={onClick}
      aria-label="T@S home"
      className={`group flex items-center gap-[12px] text-left focus:outline-none transition-transform duration-200 ease-out hover:scale-[1.04] motion-reduce:hover:scale-100 ${className}`}
    >
      <TASLogoMark
        animated={animated}
        size={markSize || (isDark ? 56 : 44)}
        className={isDark ? 'h-[44px] md:h-[56px] w-[44px] md:w-[56px]' : 'h-[36px] md:h-[44px] w-[36px] md:w-[44px]'}
      />
      <div className="flex flex-col justify-center leading-none select-none">
        <span
          className={`font-['Plus_Jakarta_Sans',Outfit,sans-serif] font-extrabold text-[20px] md:text-[24px] tracking-[0.12em] leading-none ${
            isDark ? 'text-[#fff7ed]' : 'text-[#1a1520]'
          }`}
        >
          T<span className="text-[#ff6b4a]">@</span>S
        </span>
        <span
          className={`font-['Plus_Jakarta_Sans',Outfit,sans-serif] text-[9px] md:text-[10px] uppercase font-semibold tracking-[0.2em] leading-none mt-1 ${
            isDark ? 'text-[#d9b8a0]' : 'text-[#6b6470]'
          }`}
        >
          TALK · DECIDE · SOLVE
        </span>
      </div>
    </a>
  );
};

export default TASLogo;
