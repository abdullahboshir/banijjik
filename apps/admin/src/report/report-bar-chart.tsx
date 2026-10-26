import type { ReactElement } from "react";

export interface ReportBar {
  /** The business date (`YYYY-MM-DD`); the axis shows its day of the month. */
  readonly label: string;
  readonly value: number;
  /** The figure as text, for the hover title and the screen reader. */
  readonly valueText: string;
}

const SLOT_WIDTH = 16;
const BAR_WIDTH = 10;
const PLOT_HEIGHT = 120;
const TOP_MARGIN = 8;
const AXIS_HEIGHT = 20;
/** With more days than this, only every Nth day is named on the axis, so the labels do not overlap. */
const MAX_NAMED_DAYS = 31;
const NAMED_EVERY_DAYS = 7;

function barHeightOf(value: number, maxValue: number): number {
  if (maxValue <= 0 || value <= 0) return 0;
  return (value / maxValue) * PLOT_HEIGHT;
}

function isNamedOnAxis(index: number, count: number): boolean {
  return count <= MAX_NAMED_DAYS || index % NAMED_EVERY_DAYS === 0;
}

function dayOfMonthOf(businessDate: string): string {
  return businessDate.slice(-2);
}

function BarNode(props: { bar: ReportBar; index: number; maxValue: number }): ReactElement {
  const { bar, index, maxValue } = props;
  const height = barHeightOf(bar.value, maxValue);
  const x = index * SLOT_WIDTH + (SLOT_WIDTH - BAR_WIDTH) / 2;
  const y = TOP_MARGIN + PLOT_HEIGHT - height;
  return (
    <g>
      <title>{`${bar.label}: ${bar.valueText}`}</title>
      <rect x={x} y={y} width={BAR_WIDTH} height={height} rx={2} className="fill-primary" />
    </g>
  );
}

/**
 * One bar per day, drawn by hand in SVG (plan 3.10 decision 11: no chart library, the route budget).
 * Negative values are drawn as no bar; the table beside the chart shows their figure.
 */
export function ReportBarChart(props: { bars: readonly ReportBar[]; title: string }): ReactElement {
  const { bars, title } = props;
  const width = Math.max(bars.length, 1) * SLOT_WIDTH;
  const height = TOP_MARGIN + PLOT_HEIGHT + AXIS_HEIGHT;
  const maxValue = Math.max(0, ...bars.map((bar) => bar.value));
  return (
    <svg role="img" aria-label={title} viewBox={`0 0 ${width} ${height}`} className="h-auto w-full">
      <title>{title}</title>
      {bars.map((bar, index) => (
        <BarNode key={bar.label} bar={bar} index={index} maxValue={maxValue} />
      ))}
      {bars.map((bar, index) =>
        isNamedOnAxis(index, bars.length) ? (
          <text
            key={`axis-${bar.label}`}
            x={index * SLOT_WIDTH + SLOT_WIDTH / 2}
            y={height - 4}
            textAnchor="middle"
            fontSize={10}
            className="fill-secondary"
          >
            {dayOfMonthOf(bar.label)}
          </text>
        ) : null,
      )}
    </svg>
  );
}
