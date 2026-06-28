import { useEffect, useRef } from 'react';
// @ts-ignore
import { animate, stagger } from 'animejs';

export function InteractiveNetworkGlobe() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Rotate the globe lines slightly to give a 3D spinning feel
    animate('.globe-rotate', {
      rotate: [0, 360],
      duration: 25000,
      easing: 'linear',
      loop: true
    });

    // 2. Pulse the nodes (scale and opacity)
    animate('.globe-node-glow', {
      scale: [1, 1.4, 1],
      opacity: [0.2, 0.6, 0.2],
      duration: 3000,
      delay: stagger(400),
      easing: 'easeInOutSine',
      loop: true
    });

    // 3. Animate the data packet flow along the connection paths
    animate('.data-connection', {
      strokeDashoffset: [200, 0],
      duration: 4000,
      delay: stagger(600),
      easing: 'linear',
      loop: true
    });

  }, []);

  // Node positions on the 400x400 SVG canvas
  const nodes = [
    { cx: 200, cy: 60, id: 'node-top' },
    { cx: 110, cy: 150, id: 'node-left' },
    { cx: 290, cy: 150, id: 'node-right' },
    { cx: 140, cy: 280, id: 'node-bottom-left' },
    { cx: 260, cy: 280, id: 'node-bottom-right' },
    { cx: 200, cy: 200, id: 'node-center' },
    { cx: 230, cy: 110, id: 'node-mid-top-right' },
    { cx: 170, cy: 240, id: 'node-mid-bot-left' }
  ];

  return (
    <div ref={containerRef} className="relative w-80 h-80 sm:w-96 sm:h-96 flex items-center justify-center">
      {/* Outer ambient glow */}
      <div className="absolute inset-0 rounded-full bg-yellow-500/[0.02] blur-3xl pointer-events-none" />

      <svg
        viewBox="0 0 400 400"
        className="w-full h-full text-[#FFD208] select-none pointer-events-none"
      >
        {/* Definitions for gradients and glows */}
        <defs>
          <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFD208" stopOpacity="1" />
            <stop offset="100%" stopColor="#FFD208" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFD208" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#FFD208" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FFD208" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* 1. Main Outer Sphere Boundary */}
        <circle
          cx="200"
          cy="200"
          r="160"
          fill="none"
          stroke="rgba(255, 210, 8, 0.15)"
          strokeWidth="1"
        />

        {/* 2. Rotating Wireframe Grid Group */}
        <g className="globe-rotate" style={{ transformOrigin: '200px 200px' }}>
          {/* Longitude lines */}
          <ellipse cx="200" cy="200" rx="45" ry="160" fill="none" stroke="rgba(255, 210, 8, 0.08)" strokeWidth="1" />
          <ellipse cx="200" cy="200" rx="90" ry="160" fill="none" stroke="rgba(255, 210, 8, 0.08)" strokeWidth="1" />
          <ellipse cx="200" cy="200" rx="135" ry="160" fill="none" stroke="rgba(255, 210, 8, 0.08)" strokeWidth="1" />

          {/* Latitude lines */}
          <ellipse cx="200" cy="200" rx="160" ry="40" fill="none" stroke="rgba(255, 210, 8, 0.08)" strokeWidth="1" />
          <ellipse cx="200" cy="200" rx="160" ry="80" fill="none" stroke="rgba(255, 210, 8, 0.08)" strokeWidth="1" />
          <ellipse cx="200" cy="200" rx="160" ry="120" fill="none" stroke="rgba(255, 210, 8, 0.08)" strokeWidth="1" />
        </g>

        {/* 3. Outer Orbiting Ring (Fleek Saturn-style) */}
        <ellipse
          cx="200"
          cy="200"
          rx="190"
          ry="55"
          fill="none"
          stroke="rgba(255, 210, 8, 0.25)"
          strokeWidth="1.2"
          strokeDasharray="6,4"
          transform="rotate(-15 200 200)"
        />

        {/* 4. Connection Lines (Edges of the neural network) */}
        <g>
          {/* Top to Center */}
          <path d="M 200 60 L 200 200" fill="none" stroke="rgba(255, 210, 8, 0.2)" strokeWidth="1.5" />
          <path d="M 200 60 L 200 200" fill="none" stroke="url(#edgeGrad)" strokeWidth="1.5" strokeDasharray="30, 170" className="data-connection" />

          {/* Left to Center */}
          <path d="M 110 150 L 200 200" fill="none" stroke="rgba(255, 210, 8, 0.2)" strokeWidth="1.5" />
          <path d="M 110 150 L 200 200" fill="none" stroke="url(#edgeGrad)" strokeWidth="1.5" strokeDasharray="30, 170" className="data-connection" />

          {/* Right to Center */}
          <path d="M 290 150 L 200 200" fill="none" stroke="rgba(255, 210, 8, 0.2)" strokeWidth="1.5" />
          <path d="M 290 150 L 200 200" fill="none" stroke="url(#edgeGrad)" strokeWidth="1.5" strokeDasharray="30, 170" className="data-connection" />

          {/* Center to Bottom Left */}
          <path d="M 200 200 L 140 280" fill="none" stroke="rgba(255, 210, 8, 0.2)" strokeWidth="1.5" />
          <path d="M 200 200 L 140 280" fill="none" stroke="url(#edgeGrad)" strokeWidth="1.5" strokeDasharray="30, 170" className="data-connection" />

          {/* Center to Bottom Right */}
          <path d="M 200 200 L 260 280" fill="none" stroke="rgba(255, 210, 8, 0.2)" strokeWidth="1.5" />
          <path d="M 200 200 L 260 280" fill="none" stroke="url(#edgeGrad)" strokeWidth="1.5" strokeDasharray="30, 170" className="data-connection" />

          {/* Left to Bottom Left */}
          <path d="M 110 150 L 140 280" fill="none" stroke="rgba(255, 210, 8, 0.15)" strokeWidth="1" />
          
          {/* Right to Bottom Right */}
          <path d="M 290 150 L 260 280" fill="none" stroke="rgba(255, 210, 8, 0.15)" strokeWidth="1" />

          {/* Top to Mid Top Right to Right */}
          <path d="M 200 60 L 230 110 L 290 150" fill="none" stroke="rgba(255, 210, 8, 0.15)" strokeWidth="1" />
        </g>

        {/* 5. Glowing Nodes */}
        {nodes.map((node) => (
          <g key={node.id}>
            {/* Outer animated radial glow */}
            <circle
              cx={node.cx}
              cy={node.cy}
              r="18"
              fill="url(#nodeGlow)"
              className="globe-node-glow"
              style={{ transformOrigin: `${node.cx}px ${node.cy}px` }}
            />
            {/* Middle decorative ring */}
            <circle
              cx={node.cx}
              cy={node.cy}
              r="6"
              fill="none"
              stroke="#FFD208"
              strokeWidth="1"
              opacity="0.6"
            />
            {/* Inner solid core */}
            <circle
              cx={node.cx}
              cy={node.cy}
              r="3"
              fill="#FFD208"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
