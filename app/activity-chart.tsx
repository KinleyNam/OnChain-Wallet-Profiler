import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type ActivityPoint = {
  day: string;
  transactions: number;
};

export default function ActivityChart({ data }: { data: ActivityPoint[] }) {
  return (
    <section className="panel activity-panel">
      <div className="panel-heading">
        <div>
          <h2>Transaction activity</h2>
          <p>Transactions per interval</p>
        </div>
        <span className="legend">
          <i /> Transactions
        </span>
      </div>
      <div className="chart">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 12, right: 12, left: -22, bottom: 0 }}
          >
            <defs>
              <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--chart-line)"
                  stopOpacity={0.26}
                />
                <stop
                  offset="100%"
                  stopColor="var(--chart-line)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
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
            />
            <YAxis
              stroke="var(--text-muted)"
              axisLine={false}
              tickLine={false}
              fontSize={12}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--foreground)',
                borderRadius: 8,
              }}
            />
            <Area
              type="monotone"
              dataKey="transactions"
              stroke="var(--chart-line)"
              strokeWidth={2.5}
              fill="url(#activityFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
