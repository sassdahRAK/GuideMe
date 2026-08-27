import React from 'react';

/**
 * GuideMeLogo — Black rounded-square + white pointing-hand icon.
 */
export function GuideMeLogo({ size = 28, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="GuideMe Logo"
      className={`shrink-0 ${className}`}
    >
      <rect width="40" height="40" rx="10" fill="#1d1e22" />
      <path
        d="M26.5 17.5c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v1.5
           c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.5
           c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5
           V11c0-.83-.67-1.5-1.5-1.5S14 10.17 14 11v12
           l-1.29-1.29a1.5 1.5 0 00-2.12 2.12l3.29 3.29
           A5 5 0 0017.41 29H24a5 5 0 005-5v-6.5
           c0-.83-.67-1.5-1.5-1.5z"
        fill="white"
      />
    </svg>
  );
}
