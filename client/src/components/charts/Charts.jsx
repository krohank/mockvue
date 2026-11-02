import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  LabelList,
} from 'recharts';
import { Table2, LineChart as LineIcon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { CHART_THEME, bandColor } from '../../lib/chartTheme';
import { formatDate, scoreBand } from '../../lib/format';
import { TOPIC_SHORT } from '../../lib/constants';

const useChartColors = () => {
  const { theme } = useTheme();
  return CHART_THEME[theme] || CHART_THEME.light;
};

const TooltipCard = ({ title, rows }) => (
  <div className="min-w-[160px] rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-raised">
    {title && <p className="mb-1 font-semibold text-ink">{title}</p>}
    {rows.map(([k, v]) => (
      <p key={k} className="flex justify-between gap-4 text-ink-2">
        <span>{k}</span>
        <span className="num font-semibold text-ink">{v}</span>
      </p>
    ))}
  </div>
);

/** Toggle between the chart and an accessible data table. */
export const ChartFrame = ({ title, description, table, children, height = 240, actions }) => {
  const [showTable, setShowTable] = useState(false);
  return (
    <figure className="card flex flex-col p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <figcaption>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-ink-3">{description}</p>}
        </figcaption>
        <div className="flex items-center gap-2">
          {actions}
          {table && (
            <button
              type="button"
              onClick={() => setShowTable((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-ink-3 hover:bg-surface-2 hover:text-ink"
              aria-pressed={showTable}
            >
              {showTable ? <LineIcon className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
              {showTable ? 'Chart' : 'Table'}
            </button>
          )}
        </div>
      </div>
      {showTable && table ? (
        <div className="max-h-[320px] overflow-auto rounded-lg border border-line">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-surface-2 text-xs text-ink-3">
              <tr>
                {table.columns.map((c) => (
                  <th key={c} scope="col" className="px-3 py-2 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {table.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className={`px-3 py-2 ${j === row.length - 1 ? 'num text-ink' : 'text-ink-2'}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ minHeight: height }} className="w-full flex-1">
          {children}
        </div>
      )}
    </figure>
  );
};

/** Overall score per completed session, oldest → newest. Single series: no legend; the title names it. */
export const ScoreTrendChart = ({ data, compact = false }) => {
  const c = useChartColors();
  const points = useMemo(
    () =>
      data.map((d, i) => ({
        ...d,
        x: i + 1,
        label: formatDate(d.date, { month: 'short', day: 'numeric' }),
      })),
    [data]
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={points} margin={{ top: 8, right: compact ? 8 : 16, left: compact ? -28 : -12, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={c.grid} strokeWidth={1} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: c.axis }}
          tickLine={false}
          axisLine={{ stroke: c.grid }}
          interval="preserveStartEnd"
          minTickGap={24}
          hide={compact}
        />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          tick={{ fontSize: 11, fill: c.axis }}
          tickLine={false}
          axisLine={false}
          width={40}
          hide={compact}
        />
        <Tooltip
          cursor={{ stroke: c.axis, strokeWidth: 1 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload;
            return (
              <TooltipCard
                title={p.title}
                rows={[
                  ['Date', formatDate(p.date)],
                  ['Score', `${p.score} · ${scoreBand(p.score).label}`],
                  ...(p.difficulty ? [['Difficulty', p.difficulty]] : []),
                ]}
              />
            );
          }}
        />
        <Area type="monotone" dataKey="score" stroke="none" fill={c.series} fillOpacity={0.1} isAnimationActive={false} />
        <Line
          type="monotone"
          dataKey="score"
          stroke={c.series}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          dot={{ r: 4, fill: c.series, stroke: c.surface, strokeWidth: 2 }}
          activeDot={{ r: 6, fill: c.series, stroke: c.surface, strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
};

/** Average score per topic, ranked. Bars colored by status band — every bar carries its value label. */
export const TopicBarChart = ({ data }) => {
  const c = useChartColors();
  const rows = data.map((d) => ({ ...d, name: TOPIC_SHORT[d.topic] || d.topic }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }} barCategoryGap={8}>
        <CartesianGrid horizontal={false} stroke={c.grid} />
        <XAxis type="number" domain={[0, 100]} ticks={[0, 50, 100]} tick={{ fontSize: 11, fill: c.axis }} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" width={118} tick={{ fontSize: 12, fill: c.ink }} tickLine={false} axisLine={false} interval={0} />
        <Tooltip
          cursor={{ fill: c.grid, opacity: 0.5 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload;
            return (
              <TooltipCard
                title={p.topic}
                rows={[
                  ['Average', `${p.averageScore} · ${scoreBand(p.averageScore).label}`],
                  ['Answers', p.attempts],
                ]}
              />
            );
          }}
        />
        <Bar dataKey="averageScore" maxBarSize={20} radius={[0, 4, 4, 0]} isAnimationActive={false}>
          {rows.map((r) => (
            <Cell key={r.topic} fill={bandColor(c, r.averageScore)} />
          ))}
          <LabelList dataKey="averageScore" position="right" style={{ fontSize: 12, fill: c.ink, fontVariantNumeric: 'tabular-nums' }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

/** Tiny inline trend for dashboard tiles. */
export const Sparkline = ({ values }) => {
  const c = useChartColors();
  const data = values.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <YAxis hide domain={[0, 100]} />
        <Line type="monotone" dataKey="v" stroke={c.series} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
};
