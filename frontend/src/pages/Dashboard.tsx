import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Progress } from '@/components/ui'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatCurrency, generateChartData } from '@/lib/utils'
import { TrendingUp, Wallet, TrendingDown, Target } from 'lucide-react'

export function Dashboard() {
  const { t } = useTranslation()
  const chartData = generateChartData()

  const stats = [
    {
      title: t('dashboard.total_balance'),
      value: formatCurrency(12450.50),
      icon: Wallet,
      color: 'text-blue-500',
    },
    {
      title: t('dashboard.monthly_income'),
      value: formatCurrency(4200),
      icon: TrendingUp,
      color: 'text-green-500',
    },
    {
      title: t('dashboard.monthly_expense'),
      value: formatCurrency(2800),
      icon: TrendingDown,
      color: 'text-red-500',
    },
    {
      title: t('dashboard.savings_rate'),
      value: '33.3%',
      icon: Target,
      color: 'text-purple-500',
    },
  ]

  const pieData = [
    { name: 'Food', value: 600 },
    { name: 'Transport', value: 400 },
    { name: 'Utilities', value: 300 },
    { name: 'Entertainment', value: 250 },
    { name: 'Other', value: 250 },
  ]

  const COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e']

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">{t('dashboard.title')}</h1>
        <p className="text-muted-foreground">{t('dashboard.subtitle')}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Income vs Expense */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{t('dashboard.monthly_expense')}</CardTitle>
            <CardDescription>Last 7 months overview</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="income" fill="#22c55e" />
                <Bar dataKey="expense" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Spending by Category */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.top_categories')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Net Worth Trend */}
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.net_worth')}</CardTitle>
          <CardDescription>Your net worth over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="income" stroke="#22c55e" dot={{ r: 4 }} />
              <Line type="monotone" dataKey="expense" stroke="#ef4444" dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.recent_transactions')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { description: 'Grocery Store', amount: -85.50, category: 'Food' },
              { description: 'Salary', amount: 3200, category: 'Income' },
              { description: 'Gas Station', amount: -45.00, category: 'Transport' },
              { description: 'Restaurant', amount: -62.30, category: 'Food' },
              { description: 'Freelance Work', amount: 500, category: 'Income' },
            ].map((tx, idx) => (
              <div key={idx} className="flex items-center justify-between border-b pb-3 last:border-0">
                <div>
                  <p className="font-medium">{tx.description}</p>
                  <p className="text-sm text-muted-foreground">{tx.category}</p>
                </div>
                <p className={`font-semibold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
