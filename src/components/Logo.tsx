/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export default function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center relative ${className}`}>
      {/* Outer Emerald Hexagon/Shield */}
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-md"
      >
        <polygon
          points="50,5 90,25 90,75 50,95 10,75 10,25"
          fill="url(#emerald-gradient)"
          stroke="url(#gold-gradient)"
          strokeWidth="4"
        />
        {/* Core S-shaped lightning sync emblem */}
        <path
          d="M35,30 C35,22 65,18 65,30 C65,42 35,42 35,54 C35,66 65,66 65,58 M50,15 L50,85"
          stroke="url(#gold-gradient)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="opacity-90"
        />
        {/* Futuristic Dot for AI */}
        <circle cx="50" cy="50" r="7" fill="#EAB308" className="animate-pulse" />

        <defs>
          <linearGradient id="emerald-gradient" x1="0" y1="0" x2="100" y2="100">
            <stop offset="0%" stopColor="#047857" /> {/* Emerald 700 */}
            <stop offset="100%" stopColor="#064e3b" /> {/* Emerald 900 */}
          </linearGradient>
          <linearGradient id="gold-gradient" x1="0" y1="0" x2="100" y2="100">
            <stop offset="0%" stopColor="#FBBF24" /> {/* Gold / Amber 400 */}
            <stop offset="50%" stopColor="#F59E0B" /> {/* Amber 500 */}
            <stop offset="100%" stopColor="#D97706" /> {/* Amber 600 */}
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
