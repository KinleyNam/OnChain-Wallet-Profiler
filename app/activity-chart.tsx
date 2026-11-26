import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type ActivityPoint = {
  day: string;
  range: string;
  transactions: number;
};

export default function ActivityChart({ data, timeframe }: { data: ActivityPoint[]; timeframe: string }) {
  return (
    <section className="panel activity-panel">
      <div className="panel-heading">
        <div>
          <h2>Weekly transaction volume</h2>
          <p>{timeframe} (UTC)</p>
        </div>
        <span className="legend">
          <i /> Transactions
        </span>
      </div>
      <div className="chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 12, right: 16, left: 8, bottom: 24 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--border)"
              strokeDasharray="3 5"
            />
            <XAxis
              dataKey="day"
              stroke="var(--text-muted)"
              axisLine={false}
              tickLine={false}
              minTickGap={45}
              fontSize={12}
              label={{ value: 'Week starting (UTC)', position: 'insideBottom', offset: -16, fill: 'var(--text-secondary)' }}
            />
            <YAxis
              width={64}
              allowDecimals={false}
              label={{ value: 'Transactions', angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)' }}
              stroke="var(--text-muted)"
              axisLine={false}
              tickLine={false}
              fontSize={12}
            />
            <Tooltip
              labelFormatter={(label) => data.find((point) => point.day === label)?.range ?? label}
              formatter={(value) => [Number(value).toLocaleString('en-US'), 'Transactions']}
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--foreground)',
                borderRadius: 8,
              }}
            />
            <Bar
              dataKey="transactions"
              fill="#a979ff"
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
