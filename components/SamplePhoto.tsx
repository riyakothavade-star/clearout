// Simple drawn illustrations standing in for the sample clear-out's three photos.
// They are deliberately illustrations, not photographs, so nobody mistakes the sample for real analysis.

const shelf = "#d9d4c6";
const dark = "#2b3a33";
const screen = "#4d6b5d";

function Laptops() {
  return (
    <g>
      {[0, 1, 2].map((row) => (
        <g key={row} transform={`translate(0 ${row * 38})`}>
          <rect x="8" y="38" width="144" height="4" fill={shelf} />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={14 + i * 34} y={22 + (i % 2)} width="28" height="15" rx="2" fill={i % 3 === 0 ? "#3b4a43" : dark} />
          ))}
        </g>
      ))}
    </g>
  );
}

function Monitors() {
  return (
    <g>
      <rect x="8" y="104" width="144" height="4" fill={shelf} />
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${14 + i * 46} ${46 - i * 4})`}>
          <rect width="40" height="28" rx="2" fill={dark} />
          <rect x="3" y="3" width="34" height="20" fill={screen} />
          <rect x="17" y="28" width="6" height="8" fill={dark} />
        </g>
      ))}
      {[0, 1].map((i) => (
        <rect key={i} x={30 + i * 56} y="76" width="40" height="28" rx="2" fill="#56635c" />
      ))}
    </g>
  );
}

function PowerCorner() {
  return (
    <g>
      <rect x="8" y="104" width="144" height="4" fill={shelf} />
      <rect x="14" y="62" width="34" height="42" rx="3" fill={dark} />
      <rect x="52" y="70" width="30" height="34" rx="3" fill="#3b4a43" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={88 + i * 15} y="86" width="12" height="18" rx="1.5" fill="#6f6a55" />
      ))}
      <rect x="20" y="30" width="80" height="12" rx="2" fill={dark} />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect key={i} x={25 + i * 9} y="34" width="5" height="4" fill="#9fb8a8" />
      ))}
      <path d="M110 60c10-18 30-8 24 6s-26 10-14-8" stroke="#56635c" strokeWidth="3" fill="none" />
    </g>
  );
}

export function SamplePhoto({ number, label, className = "" }: { number: 1 | 2 | 3; label: string; className?: string }) {
  return (
    <figure className={`overflow-hidden rounded-[var(--radius-control)] border border-line bg-[#ece8dc] ${className}`}>
      <svg viewBox="0 0 160 120" className="block h-auto w-full" role="img" aria-label={`Illustration for sample photo ${number}: ${label}`}>
        <rect width="160" height="120" fill="#ece8dc" />
        {number === 1 ? <Laptops /> : number === 2 ? <Monitors /> : <PowerCorner />}
      </svg>
      <figcaption className="border-t border-line bg-surface px-2 py-1 text-[11px] leading-tight text-muted">
        <span className="block font-semibold whitespace-nowrap text-ink">Photo {number}</span>
        <span className="block truncate">{label}</span>
      </figcaption>
    </figure>
  );
}
