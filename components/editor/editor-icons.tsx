// 編輯器用的小圖示組:手繪 inline SVG,圓胖風格——
// 粗線(2.4)、圓線帽圓轉角、矮胖造型,顏色走 currentColor 跟著主題變。

type IconProps = {
  size?: number;
  className?: string;
};

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

export function IconUndo({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M8.5 6.5 5 10l3.5 3.5" />
      <path d="M5 10h8a5 5 0 0 1 5 5c0 1.2-.4 2.2-1.1 3" />
    </svg>
  );
}

export function IconRedo({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M15.5 6.5 19 10l-3.5 3.5" />
      <path d="M19 10h-8a5 5 0 0 0-5 5c0 1.2.4 2.2 1.1 3" />
    </svg>
  );
}

export function IconSearch({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15.5 15.5 4 4" />
    </svg>
  );
}

export function IconChevronUp({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="m6.5 14 5.5-5 5.5 5" />
    </svg>
  );
}

export function IconChevronDown({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="m6.5 10 5.5 5 5.5-5" />
    </svg>
  );
}

export function IconClose({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="m7 7 10 10" />
      <path d="M17 7 7 17" />
    </svg>
  );
}

// 取代:兩顆圓圓的方塊交換位置
export function IconReplace({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="3.5" y="3.5" width="8" height="8" rx="3" />
      <rect x="12.5" y="12.5" width="8" height="8" rx="3" />
      <path d="M16 8.5c1.8 0 2.5-.7 2.5-2.5" />
      <path d="M8 15.5c-1.8 0-2.5.7-2.5 2.5" />
    </svg>
  );
}
