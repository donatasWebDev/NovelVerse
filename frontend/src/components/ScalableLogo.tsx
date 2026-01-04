import React from 'react'
export type LogoVariant = 'icon' | 'lockup'
interface NovelVerseLogoProps {
  /**
   * The variant of the logo to display
   * @default 'icon'
   */
  variant?: LogoVariant
  /**
   * The height of the logo in pixels
   * @default 64
   */
  size?: number
  /**
   * Optional class name for the SVG element
   */
  className?: string
  /**
   * Primary color for the book and text (default: Dark Slate #1e293b)
   * Useful for dark mode adaptation (e.g., passing 'white')
   */
  color?: string
}
export function NovelVerseLogo({
  variant = 'icon',
  size = 64,
  className = '',
  color = '#1e293b', // Dark Slate
}: NovelVerseLogoProps) {
  // Cosmic Purple Accent
  const accentColor = '#a855f7'
  // Aspect ratios
  // Icon is 1:1 (viewBox 0 0 64 64)
  // Lockup is roughly 3.5:1 (viewBox 0 0 240 64)
  const width = variant === 'lockup' ? size * 3.75 : size
  const height = size
  const viewBox = variant === 'lockup' ? '0 0 240 64' : '0 0 64 64'
  return (
    <svg
      width={width}
      height={height}
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={variant === 'lockup' ? 'NovelVerse Logo' : 'NovelVerse Icon'}
    >
      <defs>
        {/* Nebula Glow Gradient */}
        <radialGradient
          id="nebula-glow"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(32 32) rotate(90) scale(24)"
        >
          <stop stopColor={accentColor} stopOpacity="0.4" />
          <stop offset="0.7" stopColor={accentColor} stopOpacity="0.1" />
          <stop offset="1" stopColor={accentColor} stopOpacity="0" />
        </radialGradient>

        {/* Star Sparkle Shape */}
        <path
          id="star-shape"
          d="M2 0L2.5 1.5L4 2L2.5 2.5L2 4L1.5 2.5L0 2L1.5 1.5L2 0Z"
          fill={accentColor}
        />
      </defs>

      {/* --- ICON PART --- */}
      <g id="icon-group">
        {/* Nebula Glow Background */}
        <circle cx="32" cy="28" r="24" fill="url(#nebula-glow)" />

        {/* Cosmic Elements (Stars rising from book) */}
        <g className="stars">
          {/* Main Sparkle */}
          <use
            href="#star-shape"
            x="30"
            y="14"
            transform="scale(1.5)"
            style={{
              transformBox: 'fill-box',
              transformOrigin: 'center',
            }}
          />

          {/* Secondary Sparkles */}
          <use
            href="#star-shape"
            x="22"
            y="20"
            transform="scale(0.8)"
            style={{
              transformBox: 'fill-box',
              transformOrigin: 'center',
            }}
          />
          <use
            href="#star-shape"
            x="40"
            y="18"
            transform="scale(1)"
            style={{
              transformBox: 'fill-box',
              transformOrigin: 'center',
            }}
          />

          {/* Tiny Dots/Stars */}
          <circle cx="28" cy="10" r="1" fill={accentColor} fillOpacity="0.8" />
          <circle
            cx="36"
            cy="12"
            r="0.8"
            fill={accentColor}
            fillOpacity="0.6"
          />
          <circle
            cx="18"
            cy="26"
            r="1.2"
            fill={accentColor}
            fillOpacity="0.7"
          />
          <circle cx="46" cy="24" r="1" fill={accentColor} fillOpacity="0.7" />
        </g>

        {/* Open Book Silhouette */}
        <path
          fill={color}
          fillRule="evenodd"
          clipRule="evenodd"
          d="M32 36C25 36 19 33 12 36V54C19 51 25 53 32 56C39 53 45 51 52 54V36C45 33 39 36 32 36ZM32 56V36C32 36 32 36 32 36V56Z"
        />
        {/* Book Spine/Center Line Detail */}
        <path
          d="M32 38V54"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.3"
        />
      </g>

      {/* --- TEXT PART (Lockup only) --- */}
      {variant === 'lockup' && (
        <text
          x="72"
          y="44"
          fill={color}
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontWeight="700"
          fontSize="36"
          letterSpacing="-0.02em"
        >
          NovelVerse
        </text>
      )}
    </svg>
  )
}
