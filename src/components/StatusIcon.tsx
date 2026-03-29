// Animated SVG status icons for Claude session states.
// Uses SMIL animations (zero JS cost, native browser support).
// Detached sessions get dashed strokes + reduced opacity.

interface StatusIconProps {
  state: 'busy' | 'permission' | 'waiting' | 'idle' | 'error' | null;
  attached: boolean;
  size?: number;
}

export function StatusIcon({ state, attached, size = 14 }: StatusIconProps) {
  const detachedStyle = !attached ? { opacity: 0.4 } : undefined;
  const dash = !attached ? '2 2' : undefined;

  return (
    <span
      className="inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size, ...detachedStyle }}
      title={stateTitle(state)}
    >
      {renderIcon(state, size, dash)}
    </span>
  );
}

function stateTitle(state: StatusIconProps['state']): string {
  switch (state) {
    case 'busy':       return 'Working';
    case 'permission': return 'Needs permission';
    case 'waiting':    return 'Waiting for input';
    case 'idle':       return 'Idle';
    case 'error':      return 'Error';
    default:           return 'Unknown';
  }
}

function renderIcon(state: StatusIconProps['state'], size: number, dash?: string) {
  switch (state) {
    case 'busy':
      return <SpinnerIcon size={size} dash={dash} />;
    case 'permission':
      return <TriangleIcon size={size} dash={dash} />;
    case 'waiting':
      return <PromptIcon size={size} dash={dash} />;
    case 'idle':
      return <CheckIcon size={size} dash={dash} />;
    case 'error':
      return <ErrorIcon size={size} dash={dash} />;
    default:
      return <UnknownIcon size={size} dash={dash} />;
  }
}

// Busy: spinning arc — partial circle rotates continuously.
// The arc is created by strokeDasharray="28 10" (28px visible, 10px gap on a ~37.7px circumference).
// For detached sessions, we layer dashed strokes on top of the arc by combining both patterns.
function SpinnerIcon({ size, dash }: { size: number; dash?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle
        cx="8" cy="8" r="6"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="28 10"
        strokeLinecap="round"
        className="text-blue-400"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 8 8"
          to="360 8 8"
          dur="0.8s"
          repeatCount="indefinite"
        />
      </circle>
      {/* Detached overlay: dashed ring on top to show disconnected state */}
      {dash && (
        <circle
          cx="8" cy="8" r="6"
          stroke="currentColor"
          strokeWidth="0.5"
          strokeDasharray={dash}
          className="text-blue-400"
          opacity="0.6"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 8 8"
            to="360 8 8"
            dur="0.8s"
            repeatCount="indefinite"
          />
        </circle>
      )}
    </svg>
  );
}

// Permission: warning triangle with gentle pulse
function TriangleIcon({ size, dash }: { size: number; dash?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className="text-yellow-400">
      <path
        d="M8 2L14.5 13H1.5L8 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeDasharray={dash}
        fill="none"
      >
        <animate
          attributeName="opacity"
          values="1;0.4;1"
          dur="1.2s"
          repeatCount="indefinite"
        />
      </path>
      {/* Exclamation dot */}
      <line x1="8" y1="6" x2="8" y2="9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <animate attributeName="opacity" values="1;0.4;1" dur="1.2s" repeatCount="indefinite" />
      </line>
      <circle cx="8" cy="11.5" r="0.75" fill="currentColor">
        <animate attributeName="opacity" values="1;0.4;1" dur="1.2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

// Waiting: prompt cursor > with slow blink
function PromptIcon({ size, dash }: { size: number; dash?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className="text-amber-400">
      <path
        d="M4 3L11 8L4 13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dash}
      >
        <animate
          attributeName="opacity"
          values="1;0.3;1"
          dur="1.5s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  );
}

// Idle/Done: static checkmark
function CheckIcon({ size, dash }: { size: number; dash?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className="text-green-400">
      <path
        d="M3 8.5L6.5 12L13 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dash}
      />
    </svg>
  );
}

// Error: static X
function ErrorIcon({ size, dash }: { size: number; dash?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className="text-red-400">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray={dash} />
      <path
        d="M5.5 5.5L10.5 10.5M10.5 5.5L5.5 10.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray={dash}
      />
    </svg>
  );
}

// Unknown: hollow circle
function UnknownIcon({ size, dash }: { size: number; dash?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className="text-muted">
      <circle
        cx="8" cy="8" r="5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray={dash ?? undefined}
      />
    </svg>
  );
}
