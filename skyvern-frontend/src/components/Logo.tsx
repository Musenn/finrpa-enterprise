function Logo() {
  return (
    <svg
      width="168"
      height="40"
      viewBox="0 0 168 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="FinRPA"
    >
      <defs>
        <linearGradient id="logo-stroke-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1A3A5C" />
          <stop offset="45%" stopColor="#2A5A8C" />
          <stop offset="70%" stopColor="#C8963E" />
          <stop offset="100%" stopColor="#DFC474" />
        </linearGradient>
        <linearGradient id="logo-fill-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1A3A5C" stopOpacity="0.15" />
          <stop offset="50%" stopColor="#C8963E" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#1A3A5C" stopOpacity="0.12" />
        </linearGradient>
      </defs>
      {/* Bank building icon */}
      <g transform="translate(2, 4)">
        <path d="M16 0 L32 10 L0 10 Z" fill="#C8963E" />
        <rect x="0" y="10" width="32" height="2.5" rx="0.5" fill="#B8862D" />
        <rect x="3" y="13" width="3.5" height="14" rx="0.8" fill="#C8963E" />
        <rect x="10.5" y="13" width="3.5" height="14" rx="0.8" fill="#C8963E" />
        <rect x="18" y="13" width="3.5" height="14" rx="0.8" fill="#C8963E" />
        <rect x="25.5" y="13" width="3.5" height="14" rx="0.8" fill="#C8963E" />
        <rect x="-1" y="27" width="34" height="2.5" rx="0.5" fill="#B8862D" />
        <rect x="-2" y="29.5" width="36" height="2" rx="0.5" fill="#C8963E" />
      </g>
      {/* Brand text — italic hollow blue-gold gradient stroke */}
      <text
        x="42"
        y="30"
        fontFamily="'Georgia', 'Times New Roman', serif"
        fontSize="28"
        fontWeight="700"
        fontStyle="italic"
        letterSpacing="-0.5"
        fill="url(#logo-fill-grad)"
        stroke="url(#logo-stroke-grad)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      >
        FinRPA
      </text>
    </svg>
  );
}

export { Logo };
