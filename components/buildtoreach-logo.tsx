import React from "react";

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  variant?: "icon" | "full";
}

export function BuildToReachLogo({ size = 36, variant = "icon", className, ...props }: LogoProps) {
  return (
    <svg
      width={variant === "full" ? size * 3.5 : size}
      height={size}
      viewBox="0 0 140 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id="btr-grad-primary" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" />
          <stop offset="0.5" stopColor="#3B82F6" />
          <stop offset="1" stopColor="#10B981" />
        </linearGradient>
        <linearGradient id="btr-grad-accent" x1="20" y1="8" x2="36" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38BDF8" />
          <stop offset="1" stopColor="#34D399" />
        </linearGradient>
      </defs>

      {/* ICON MARK */}
      <g id="btr-mark">
        {/* Core 'B' / Build Stack */}
        <path
          d="M8 8H20C24.4183 8 28 11.5817 28 16C28 18.5 26.8 20.7 25 22.1C27.3 23.4 29 25.9 29 28.8C29 33.3 25.4 37 20.8 37H8V8Z"
          fill="url(#btr-grad-primary)"
          opacity="0.15"
        />
        <path
          d="M8 8H20C24.4183 8 28 11.5817 28 16C28 20.4183 24.4183 24 20 24H8V8Z"
          stroke="url(#btr-grad-primary)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M8 21H20.8C25.3287 21 29 24.6713 29 29.2C29 33.7287 25.3287 37.4 20.8 37.4H8V21Z"
          stroke="url(#btr-grad-primary)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Radiating Reach Signal Arcs */}
        <path
          d="M32 14C35.3137 17.3137 35.3137 22.6863 32 26"
          stroke="url(#btr-grad-accent)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M36.5 10C41.4706 14.9706 41.4706 23.0294 36.5 28"
          stroke="url(#btr-grad-accent)"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.75"
        />
      </g>

      {/* WORDMARK */}
      {variant === "full" && (
        <g id="btr-wordmark">
          <text x="48" y="24" fill="#0F172A" fontFamily="Inter, system-ui, sans-serif" fontWeight="800" fontSize="16" letterSpacing="-0.5px">
            Build<tspan fill="#3B82F6">To</tspan><tspan fill="#10B981">Reach</tspan>
          </text>
          <text x="48" y="34" fill="#64748B" fontFamily="Inter, system-ui, sans-serif" fontWeight="600" fontSize="8" letterSpacing="0.8px">
            MARKETING AGENT
          </text>
        </g>
      )}
    </svg>
  );
}
