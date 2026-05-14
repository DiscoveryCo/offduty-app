export function WaveIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 16"
      fill="none"
      className={className ?? "w-10 h-4"}
      aria-hidden="true"
    >
      <path
        d="M0 8 C5 3, 10 13, 15 8 S25 3, 30 8 S35 13, 40 8"
        stroke="#A78BFA"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}
