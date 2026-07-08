/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';

export default function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  const [imgSrc, setImgSrc] = useState<string | null>('/logo-AksaraSyncAI.png');
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    if (imgSrc === '/logo-AksaraSyncAI.png') {
      setImgSrc('/logo.png');
    } else if (imgSrc === '/logo.png') {
      setImgSrc('/Logo.png');
    } else if (imgSrc === '/Logo.png') {
      setImgSrc('/logo.svg');
    } else if (imgSrc === '/logo.svg') {
      setImgSrc('/Logo.svg');
    } else {
      setHasError(true);
    }
  };

  if (!hasError && imgSrc) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <img 
          src={imgSrc} 
          alt="AksaraSync AI Logo" 
          className="w-full h-full object-contain select-none max-h-full" 
          onError={handleError}
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center relative ${className}`}>
      {/* 
        AksaraSyncAI High-Fidelity Brand Logo SVG 
        Featuring the K3 Safety Gear (Green/Cross), 3D Geometric A & P Pillars, 
        and Golden Foundation Arch.
      */}
      <svg
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-md select-none"
      >
        <defs>
          {/* Gold Gradient */}
          <linearGradient id="gold-grad" x1="20" y1="20" x2="100" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#DFB23E" />
            <stop offset="50%" stopColor="#B48A25" />
            <stop offset="100%" stopColor="#8C6615" />
          </linearGradient>

          {/* Gold Base Gradient */}
          <linearGradient id="gold-base-grad" x1="30" y1="80" x2="90" y2="110" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#E6BA46" />
            <stop offset="100%" stopColor="#A0791B" />
          </linearGradient>

          {/* Green Emerald Gradient */}
          <linearGradient id="green-grad" x1="20" y1="40" x2="100" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="50%" stopColor="#059669" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>

          {/* Dark Green Shadow Gradient */}
          <linearGradient id="dark-green-grad" x1="20" y1="40" x2="100" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#065F46" />
            <stop offset="100%" stopColor="#022C22" />
          </linearGradient>
        </defs>

        {/* 1. Golden Foundation Base (3D Isometric Platform) */}
        {/* Under-shadow layer */}
        <polygon points="60,111 110,83 110,88 60,116 10,88 10,83" fill="#6B4F10" />
        
        {/* Left base edge */}
        <polygon points="10,83 60,111 60,105 10,77" fill="#A0791B" />
        
        {/* Right base edge */}
        <polygon points="60,111 110,83 110,77 60,105" fill="#DFA928" />
        
        {/* Top platform face */}
        <polygon points="60,105 110,77 60,49 10,77" fill="url(#gold-base-grad)" opacity="0.15" />


        {/* 2. Golden Tower Arch at the back */}
        {/* Columns & Roof Frame */}
        <path 
          d="M 48,15 L 60,3 L 72,15 L 72,60 L 67,60 L 67,23 L 60,15 L 53,23 L 53,60 L 48,60 Z" 
          fill="url(#gold-grad)" 
        />
        {/* Arch Shadow depth */}
        <path 
          d="M 60,3 L 72,15 L 72,18 L 60,6 Z" 
          fill="#8C6615" 
          opacity="0.5"
        />


        {/* 3. K3 Safety Logo (Green Gear and White Cross) */}
        <g transform="translate(60, 29)">
          {/* Gear outer teeth (8 teeth) */}
          <path
            d="M-15,-6 L-15,6 L-11,8 L-11,11 L-8,11 L-6,15 L6,15 L8,11 L11,11 L11,8 L15,6 L15,-6 L11,-8 L11,-11 L8,-11 L6,-15 L-6,-15 L-8,-11 L-11,-11 L-11,-8 Z"
            fill="#047857"
          />
          {/* Gear inner circle */}
          <circle cx="0" cy="0" r="11" fill="#047857" stroke="#10B981" strokeWidth="1" />
          {/* Central hole/gear details */}
          <circle cx="0" cy="0" r="8" fill="#047857" />
          {/* White Safety Cross (Lambang K3) */}
          <path
            d="M -2.5,-6 L 2.5,-6 L 2.5,-2.5 L 6,-2.5 L 6,2.5 L 2.5,2.5 L 2.5,6 L -2.5,6 L -2.5,2.5 L -6,2.5 L -6,-2.5 L -2.5,-2.5 Z"
            fill="white"
          />
        </g>


        {/* 4. Left Isometric Letter 'A' Structure */}
        {/* Left Side column of A */}
        <polygon points="32,49 43,43 43,85 32,91" fill="url(#green-grad)" />
        {/* Right Inner Depth of A left column */}
        <polygon points="43,43 47,45 47,82 43,85" fill="url(#dark-green-grad)" />
        {/* Ribbon diagonal crossbar of A */}
        <polygon points="32,73 43,67 55,73 44,79" fill="url(#green-grad)" />
        {/* Inside arch column right of A */}
        <polygon points="51,60 55,58 55,83 51,85" fill="url(#green-grad)" opacity="0.85" />
        <polygon points="43,63 51,60 51,85 43,88" fill="url(#dark-green-grad)" />
        {/* Highlight top of A columns */}
        <polygon points="32,49 43,43 47,45 36,51" fill="#34D399" />


        {/* 5. Right Isometric Letter 'P' Structure */}
        {/* Main stem of P */}
        <polygon points="69,49 73,47 73,89 69,91" fill="url(#dark-green-grad)" />
        <polygon points="73,47 84,41 84,83 73,89" fill="url(#green-grad)" />
        {/* Top Loop of P (Isometric Ribbon wrapping around) */}
        <polygon points="84,41 103,52 103,58 84,47" fill="url(#green-grad)" />
        <polygon points="103,52 103,58 92,64 92,58" fill="url(#dark-green-grad)" />
        <polygon points="84,63 92,58 92,64 84,69" fill="url(#green-grad)" />
        {/* Inner shadow/depth of stem */}
        <polygon points="69,49 73,47 73,53 69,55" fill="#34D399" />
        <polygon points="84,41 84,47 73,53 73,47" fill="#6EE7B7" />


        {/* 6. Gold base connector borders */}
        <polygon points="10,77 15,74 60,99 55,102" fill="url(#gold-grad)" />
        <polygon points="110,77 105,74 60,99 65,102" fill="url(#gold-grad)" />
      </svg>
    </div>
  );
}
