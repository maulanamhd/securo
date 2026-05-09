import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Progress } from '@/components/ui'
import { Plus, Edit2, Trash2, TrendingUp } from 'lucide-react'
import { formatCurrency, formatPercent, formatDate } from '@/lib/utils'

export function Goals() {
  const { t } = useTranslation()

  const mockGoals = [
    { id: 1, name: 'Emergency Fund', target: 10000, current: 5200, dueDate: '2027-12-31', category: 'Savings' },
    { id: 2, name: 'Vacation Fund', target: 5000, current: 3100, dueDate: '2026-12-31', category: 'Travel' },
    { id: 3, name: 'Car Down Payment', target: 15000, current: 8900, dueDate: '2027-06-30', category: 'Purchase' },
    { id: 4, name: 'Home Renovation', target: 8000, current: 2400, dueDate: '2028-01-31', category: 'Home' },
  ]

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('goals.title')}</h1>
          <p className="text-muted-foreground">{t('goals.subtitle')}</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t('goals.add_goal')}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {mockGoals.map((goal) => {
          const percentage = (goal.current / goal.target) * 100
          const daysLeft = Math.ceil((new Date(goal.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))

          return (
            <Card key={goal.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{goal.name}</CardTitle>
                    <CardDescription>{goal.category} • Due {formatDate(goal.dueDate)}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <button className="p-2 hover:bg-muted rounded">
                      <Edit2 className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button className="p-2 hover:bg-muted rounded">
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium">{formatCurrency(goal.current)} of {formatCurrency(goal.target)}</span>
                    <span className="text-sm font-semibold text-primary">{formatPercent(percentage / 100)}</span>
                  </div>
                  <Progress value={percentage} className="h-3" />
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="p-2 bg-accent rounded">
                    <p className="text-xs text-muted-foreground">Remaining</p>
                    <p className="font-semibold text-sm">{formatCurrency(goal.target - goal.current)}</p>
                  </div>
                  <div className="p-2 bg-accent rounded">
                    <p className="text-xs text-muted-foreground">Days Left</p>
                    <p className="font-semibold text-sm">{daysLeft} days</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Overall Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Saved</p>
              <p className="text-2xl font-bold">{formatCurrency(mockGoals.reduce((sum, g) => sum + g.current, 0))}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Goals</p>
              <p className="text-2xl font-bold">{formatCurrency(mockGoals.reduce((sum, g) => sum + g.target, 0))}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Average Progress</p>
              <p className="text-2xl font-bold">
                {formatPercent(mockGoals.reduce((sum, g) => sum + (g.current / g.target), 0) / mockGoals.length / 100)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Goals</p>
              <p className="text-2xl font-bold">{mockGoals.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
