// pages/transactions-mobile-view.tsx
import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import { CategoryIcon } from '@/components/category-icon'
import { ArrowLeftRight, Plus, Paperclip, Users } from 'lucide-react'
import type { Transaction } from '@/types'
import { cn } from '@/lib/utils'

interface TransactionsMobileViewProps {
  transactions: Transaction[]
  isLoading: boolean
  onTransactionClick: (tx: Transaction) => void
  onAddClick: () => void
  onTransferClick: () => void
  mask?: (value: string) => string
  locale?: string
  userCurrency?: string
  groupNameById?: Map<string, string>
  recurringDescriptions?: Set<string>
  getAccountName?: (account: { name: string; display_name?: string | null; id?: string }) => string
}


function formatCurrency(value: number, currency = 'USD', locale = 'en-US') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value)
}


function formatDateGroup(dateString: string, locale = 'en-US'): string {
  const date = new Date(dateString + 'T00:00:00')
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) {
    return 'Today'
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday'
  }

  return date.toLocaleDateString(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function TransactionsMobileView({
  transactions,
  isLoading,
  onTransactionClick,
  onAddClick,
  onTransferClick,
  mask = (v) => v,
  locale = 'en-US',
  userCurrency = 'USD',  // Default USD
  groupNameById,
  recurringDescriptions,
  accounts = [],
  getAccountName,
}: TransactionsMobileViewProps) {
  const { t } = useTranslation()

  const groupedTransactions = useMemo(() => {
    const groups = new Map<string, Transaction[]>()
    
    transactions.forEach(tx => {
      const existing = groups.get(tx.date) || []
      existing.push(tx)
      groups.set(tx.date, existing)
    })

    // Convert to array and sort by date descending
    return Array.from(groups.entries())
      .map(([date, txs]) => ({ date, transactions: txs }))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [transactions])

  if (isLoading) {
    return (
      <div className="space-y-4 px-4 pb-24">
        {Array.from({ length: 3 }).map((_, groupIndex) => (
          <div key={groupIndex} className="space-y-2">
            <Skeleton className="h-5 w-32 mb-2" />
            {Array.from({ length: 2 }).map((_, txIndex) => (
              <Skeleton key={txIndex} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ))}
        {/* FAB Skeleton */}
        <div className="fixed bottom-6 right-6 flex flex-col gap-3">
          <Skeleton className="h-14 w-14 rounded-full" />
          <Skeleton className="h-14 w-14 rounded-full" />
        </div>
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <div className="text-center space-y-3">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-foreground">
            {t('transactions.noTransactions')}
          </h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            {t('transactions.noTransactionsDesc')}
          </p>
        </div>
        {/* FABs tetap muncul meskipun tidak ada transaksi */}
        <div className="fixed bottom-10 right-6 flex flex-col gap-3">
          <FloatingActionButton
            onClick={onTransferClick}
            icon={<ArrowLeftRight size={24} />}
            label={t('transactions.transfer')}
            variant="secondary"
          />
          <FloatingActionButton
            onClick={onAddClick}
            icon={<Plus size={24} />}
            label={t('transactions.addTransaction')}
            variant="primary"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="pb-24">
      {/* Date Groups */}
      <div className="space-y-6">
        {groupedTransactions.map((group) => (
          <MobileDateGroup
            key={group.date}
            date={group.date}
            transactions={group.transactions}
            onTransactionClick={onTransactionClick}
            mask={mask}
            locale={locale}
            userCurrency={userCurrency}
            groupNameById={groupNameById}
            recurringDescriptions={recurringDescriptions}
            accounts={accounts}
            getAccountName={getAccountName}
            t={t}
          />
        ))}
      </div>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-20 right-6 flex flex-col gap-3 z-50">
        <FloatingActionButton
          onClick={onTransferClick}
          icon={<ArrowLeftRight size={24} />}
          label={t('transactions.transfer')}
          variant="secondary"
        />
        <FloatingActionButton
          onClick={onAddClick}
          icon={<Plus size={24} />}
          label={t('transactions.addTransaction')}
          variant="primary"
        />
      </div>
    </div>
  )
}

// Mobile Date Group Component
function MobileDateGroup({
  date,
  transactions,
  onTransactionClick,
  mask,
  locale,
  userCurrency,
  groupNameById,
  recurringDescriptions,
  accounts,
  getAccountName,
}: {
  date: string
  transactions: Transaction[]
  onTransactionClick: (tx: Transaction) => void
  mask: (value: string) => string
  locale: string
  userCurrency: string
  groupNameById?: Map<string, string>
  recurringDescriptions?: Set<string>
  accounts: Array<{ id: string; name: string; display_name?: string | null }>
  getAccountName?: (account: { name: string; display_name?: string | null; id?: string }) => string
  t: (key: string, options?: Record<string, unknown>) => string
}) {
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <div className="px-4">
      {/* Date Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full mb-3 sticky top-0 bg-background/95 backdrop-blur-sm py-2 z-10"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-foreground">
            {formatDateGroup(date, locale)}
          </h3>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {transactions.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
                {formatCurrency(
                    Math.abs(transactions.reduce((sum, tx) => {
                    const amount = tx.is_shared && tx.viewer_share != null
                        ? Number(tx.viewer_share)
                        : Number(tx.amount)
                    return sum + (tx.type === 'credit' ? amount : -amount)
                    }, 0)),
                    userCurrency,
                    locale
                )}
            </span>
        </div>
      </button>

      {/* Transaction Cards */}
      {isExpanded && (
        <div className="space-y-2">
          {transactions.map((tx) => (
            <MobileTransactionCard
              key={tx.id}
              transaction={tx}
              onClick={() => onTransactionClick(tx)}
              mask={mask}
              locale={locale}
              userCurrency={userCurrency}
              groupNameById={groupNameById}
              isRecurring={recurringDescriptions?.has(
                `${tx.description}_${tx.type}`
              )}
              accounts={accounts}
              getAccountName={getAccountName}
            />
          ))}
        </div>
      )}
      
      {/* Divider */}
      <div className="mt-4 border-b border-border/50" />
    </div>
  )
}

// Mobile Transaction Card Component
function MobileTransactionCard({
  transaction: tx,
  onClick,
  mask,
  locale,
  userCurrency,
  groupNameById,
  isRecurring,
  accounts = [],
  getAccountName,
}: {
  transaction: Transaction
  onClick: () => void
  mask: (value: string) => string
  locale: string
  userCurrency: string
  groupNameById?: Map<string, string>
  isRecurring?: boolean
  accounts: Array<{ id: string; name: string; display_name?: string | null }>
  getAccountName?: (account: { name: string; display_name?: string | null; id?: string }) => string
}) {
  const displayAmount = tx.is_shared && tx.viewer_share != null
    ? Number(tx.viewer_share)
    : Number(tx.amount)

  // Helper untuk mendapatkan nama akun
  const accountName = tx.account_id && getAccountName 
    ? getAccountName(accounts.find(a => a.id === tx.account_id) ?? { name: '', display_name: null })
    : ''

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card rounded-xl border border-border p-4",
        "active:scale-[0.98] transition-transform duration-100",
        "cursor-pointer hover:bg-accent/5",
        tx.is_shared && "opacity-80"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Category Icon */}
        <div className="shrink-0 mt-1">
          <CategoryIcon
            icon={tx.category?.icon}
            color={tx.category?.color}
            size="md"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Description */}
          <h4 className="text-sm font-semibold text-foreground truncate">
            {tx.description}
          </h4>

          {/* Meta Row */}
          <div className="mt-1.5 space-y-1">
            {/* Amount + Category */}
            <div className="flex items-baseline gap-2">
              <span
                className={cn(
                  "text-base font-bold tabular-nums",
                  tx.type === 'credit' ? 'text-emerald-600' : 'text-rose-500'
                )}
              >
                {mask(
                  `${tx.type === 'credit' ? '+' : '−'}${formatCurrency(
                    Math.abs(displayAmount),
                    tx.currency || userCurrency,
                    locale
                  )}`
                )}
              </span>
              {tx.category && (
                <span className="text-xs text-muted-foreground">
                  · {tx.category.name}
                </span>
              )}
            </div>

            {/* Secondary Info */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Account */}
              {accountName && (
                <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                  {accountName}
                </span>
              )}

              {/* Badges */}
              {tx.group_id && groupNameById && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-700 bg-violet-50 dark:bg-violet-950/40 dark:text-violet-300 px-2 py-0.5 rounded-full">
                  <Users size={10} />
                  {groupNameById.get(tx.group_id)}
                </span>
              )}

              {tx.transfer_pair_id && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  <ArrowLeftRight size={10} />
                  Transfer
                </span>
              )}

              {isRecurring && (
                <span className="text-[10px] font-semibold text-primary bg-primary/5 px-2 py-0.5 rounded-full">
                  Recurring
                </span>
              )}

              {(tx.attachment_count ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Paperclip size={12} />
                  {tx.attachment_count}
                </span>
              )}
            </div>

            {/* Multi-currency display */}
            {/* {tx.amount_primary != null && tx.currency !== locale.split('-')[1] && (
              <div className="flex items-center gap-1 mt-1">
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  ≈ {mask(formatCurrency(Math.abs(tx.amount_primary), 'USD', locale))}
                </span>
              </div>
            )}*/}

            {/* Shared transaction info */}
            {tx.is_shared && (
              <p className="text-[10px] text-muted-foreground">
                Total: {formatCurrency(Math.abs(Number(tx.amount)), tx.currency, locale)}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Floating Action Button Component
function FloatingActionButton({
  onClick,
  icon,
  label,
  variant = 'primary',
}: {
  onClick: () => void
  icon: React.ReactNode
  label: string
  variant: 'primary' | 'secondary'
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "h-14 w-14 rounded-full shadow-lg",
        "flex items-center justify-center",
        "transition-all duration-200",
        "active:scale-95",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variant === 'primary' && "bg-primary text-primary-foreground hover:bg-primary/90",
        variant === 'secondary' && "bg-card text-foreground border border-border hover:bg-accent"
      )}
    >
      {icon}
      <span className="sr-only">{label}</span>
    </button>
  )
}