"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartDatum } from "@/lib/api/types";
import { formatMoney } from "@/lib/money";

const colors = [
  "#2f7450",
  "#5f9675",
  "#a9803b",
  "#58729b",
  "#a85a50",
  "#789086",
];

export function CategoryChart({ data }: { data: ChartDatum[] }) {
  return (
    <ChartFrame label="Spending by category">
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          horizontal={false}
          stroke="#e4e8e3"
        />
        <XAxis
          type="number"
          tickFormatter={(value) =>
            formatMoney(Number(value), "NGN", { compact: true })
          }
          tick={{ fontSize: 10 }}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={90}
          tick={{ fontSize: 10 }}
        />
        <Tooltip formatter={(value) => formatMoney(Number(value))} />
        <Bar dataKey="amountMinor" fill="#3f7e5b" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartFrame>
  );
}
export function MonthlyChart({ data }: { data: ChartDatum[] }) {
  return (
    <ChartFrame label="Monthly cash flow">
      <LineChart data={data}>
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="#e4e8e3"
        />
        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
        <YAxis
          tickFormatter={(value) =>
            formatMoney(Number(value), "NGN", { compact: true })
          }
          tick={{ fontSize: 10 }}
        />
        <Tooltip formatter={(value) => formatMoney(Number(value))} />
        <Line
          type="monotone"
          dataKey="incomeMinor"
          stroke="#2f7450"
          strokeWidth={2}
          dot={false}
          name="Income"
        />
        <Line
          type="monotone"
          dataKey="expensesMinor"
          stroke="#a85a50"
          strokeWidth={2}
          dot={false}
          name="Spending"
        />
      </LineChart>
    </ChartFrame>
  );
}
export function PurposeChart({ data }: { data: ChartDatum[] }) {
  return (
    <ChartFrame label="Allocation by bucket">
      <PieChart>
        <Pie
          data={data}
          dataKey="amountMinor"
          nameKey="label"
          innerRadius="54%"
          outerRadius="78%"
          paddingAngle={2}
        >
          {data.map((item, index) => (
            <Cell fill={colors[index % colors.length]} key={item.id || index} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => formatMoney(Number(value))} />
      </PieChart>
    </ChartFrame>
  );
}
function ChartFrame({
  label,
  children,
}: {
  label: string;
  children: React.ReactElement;
}) {
  return (
    <div className="chart-frame" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}
