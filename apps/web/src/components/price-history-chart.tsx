import { useId, useMemo, useRef, useState } from 'react';
import { formatDate, formatPrice } from '@/lib/format';
import type { PriceHistoryEntry } from '@/lib/types';

const WIDTH = 560;
const HEIGHT = 200;
const PAD = { top: 28, right: 16, bottom: 24, left: 16 };

interface Point {
  x: number;
  y: number;
  entry: PriceHistoryEntry;
}

/**
 * Plain SVG line chart - no charting library. One series (price over time),
 * so no legend; the dialog title already says what is plotted. Direct end
 * label carries the current price, a crosshair + tooltip carries the rest.
 */
export function PriceHistoryChart({ entries }: { entries: PriceHistoryEntry[] }) {
  const gradientId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { points, path, areaPath, minPoint, maxPoint, currency } = useMemo(
    () => buildGeometry(entries),
    [entries],
  );

  if (points.length < 2) {
    const only = entries[0];
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        {only
          ? `Śledzimy tę ofertę od ${formatDate(only.recordedAt)} - cena się nie zmieniła (${formatPrice(only.price, only.currency)}).`
          : 'Brak danych o historii ceny.'}
      </p>
    );
  }

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;
  const last = points[points.length - 1]!;

  function handleMove(event: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    // Snap to the nearest data point - readers aim at a date, not a 2px line.
    let nearest = 0;
    let best = Infinity;
    for (const [i, p] of points.entries()) {
      const d = Math.abs(p.x - x);
      if (d < best) {
        best = d;
        nearest = i;
      }
    }
    setHoverIndex(nearest);
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full touch-none"
          role="img"
          aria-label="Wykres historii ceny"
          onPointerMove={handleMove}
          onPointerLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.1" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Baseline only - direct labels carry the values, so a full axis is not needed. */}
          <line
            x1={PAD.left}
            y1={HEIGHT - PAD.bottom}
            x2={WIDTH - PAD.right}
            y2={HEIGHT - PAD.bottom}
            stroke="var(--border)"
            strokeWidth={1}
          />

          <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
          <path
            d={path}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Extreme callouts - "the one series the story is about" per point, not every point. */}
          {maxPoint !== last && (
            <PointCallout point={maxPoint} label={formatPrice(maxPoint.entry.price, currency)} />
          )}
          {minPoint !== last && minPoint !== maxPoint && (
            <PointCallout point={minPoint} label={formatPrice(minPoint.entry.price, currency)} />
          )}

          {/* Direct end label - "lines carry the value at the end". Last point is
              always the rightmost, so anchoring "end" (growing leftward) never clips. */}
          <circle cx={last.x} cy={last.y} r={5} fill="var(--primary)" stroke="var(--card)" strokeWidth={2} />
          <text
            x={last.x - 8}
            y={last.y - 12}
            textAnchor="end"
            className="data-figure fill-foreground text-[13px] font-semibold"
          >
            {formatPrice(last.entry.price, currency)}
          </text>

          {hovered ? (
            <>
              <line
                x1={hovered.x}
                y1={PAD.top}
                x2={hovered.x}
                y2={HEIGHT - PAD.bottom}
                stroke="var(--muted-foreground)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <circle
                cx={hovered.x}
                cy={hovered.y}
                r={5}
                fill="var(--primary)"
                stroke="var(--card)"
                strokeWidth={2}
              />
            </>
          ) : null}
        </svg>

        {hovered ? (
          <div
            className="bg-popover text-popover-foreground pointer-events-none absolute top-0 z-10 -translate-y-1 rounded-md border px-2.5 py-1.5 text-xs shadow-md"
            style={{
              left: `${(hovered.x / WIDTH) * 100}%`,
              transform: `translate(${hovered.x > WIDTH * 0.7 ? '-100%' : '0'}, 0)`,
            }}
          >
            <p className="data-figure text-muted-foreground">{formatDate(hovered.entry.recordedAt)}</p>
            <p className="data-figure font-semibold">{formatPrice(hovered.entry.price, currency)}</p>
          </div>
        ) : null}
      </div>

      {/* Table view - same values as the chart, for precision and accessibility. */}
      <div className="max-h-32 overflow-y-auto rounded-md border">
        <table className="w-full text-sm">
          <tbody>
            {[...entries].reverse().map((entry, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="data-figure text-muted-foreground px-3 py-1.5">
                  {formatDate(entry.recordedAt)}
                </td>
                <td className="data-figure px-3 py-1.5 text-right font-medium">
                  {formatPrice(entry.price, entry.currency)}
                </td>
                <td className="data-figure w-20 px-3 py-1.5 text-right">
                  {entry.deltaPct === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    // Ticker semantics, buyer's side: down is good (cheaper),
                    // up is bad - matches the card's inline price arrow.
                    <span className={entry.deltaPct < 0 ? 'text-success' : 'text-destructive'}>
                      {entry.deltaPct > 0 ? '+' : ''}
                      {entry.deltaPct.toFixed(1)}%
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Anchors near the frame edge outward so the label never clips off-canvas. */
function labelAnchor(x: number): { anchor: 'start' | 'middle' | 'end'; dx: number } {
  const EDGE = 36;
  if (x < PAD.left + EDGE) return { anchor: 'start', dx: 6 };
  if (x > WIDTH - PAD.right - EDGE) return { anchor: 'end', dx: -6 };
  return { anchor: 'middle', dx: 0 };
}

function PointCallout({ point, label }: { point: Point; label: string }) {
  const { anchor, dx } = labelAnchor(point.x);
  return (
    <>
      <circle cx={point.x} cy={point.y} r={4} fill="var(--primary)" stroke="var(--card)" strokeWidth={2} />
      <text
        x={point.x + dx}
        y={point.y - 10}
        textAnchor={anchor}
        className="data-figure fill-muted-foreground text-[11px]"
      >
        {label}
      </text>
    </>
  );
}

function buildGeometry(entries: PriceHistoryEntry[]) {
  const withPrice = entries.filter(
    (e): e is PriceHistoryEntry & { price: number } => e.price !== null,
  );
  const currency = entries[0]?.currency ?? 'PLN';

  if (withPrice.length < 2) {
    return { points: [] as Point[], path: '', areaPath: '', minPoint: null as never, maxPoint: null as never, currency };
  }

  const times = withPrice.map((e) => new Date(e.recordedAt).getTime());
  const prices = withPrice.map((e) => e.price);
  const [tMin, tMax] = [Math.min(...times), Math.max(...times)];
  const [pMin, pMax] = [Math.min(...prices), Math.max(...prices)];
  // A little vertical breathing room so the line never touches the frame.
  const pad = (pMax - pMin) * 0.15 || pMax * 0.05 || 1;

  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;

  const points: Point[] = withPrice.map((entry, i) => {
    const t = times[i]!;
    const x = tMax === tMin ? PAD.left + innerW / 2 : PAD.left + ((t - tMin) / (tMax - tMin)) * innerW;
    const y =
      PAD.top +
      innerH -
      ((entry.price - (pMin - pad)) / (pMax + pad - (pMin - pad))) * innerH;
    return { x, y, entry };
  });

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${path} L${points[points.length - 1]!.x.toFixed(1)},${HEIGHT - PAD.bottom} L${points[0]!.x.toFixed(1)},${HEIGHT - PAD.bottom} Z`;

  const minPoint = points.reduce((a, b) => (b.entry.price! < a.entry.price! ? b : a));
  const maxPoint = points.reduce((a, b) => (b.entry.price! > a.entry.price! ? b : a));

  return { points, path, areaPath, minPoint, maxPoint, currency };
}
