import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ArrowRight,
  Link2,
  Receipt,
  TrendingDown,
  TrendingUp,
  Trash2,
  UserPlus,
  Wallet,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts'

import {
  groups as groupsApi,
  users as usersApi,
  accounts as accountsApi,
  type GroupMemberPayload,
  type GroupSettlementPayload,
} from '@/lib/api'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PageHeader } from '@/components/page-header'
import type { GroupMember, GroupSettlement } from '@/types'

function formatCurrency(value: number, currency = 'USD', locale = 'en-US') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value)
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      {children}
    </div>
  )
}

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="px-4 sm:px-5 py-4 border-b border-border flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  tone?: 'positive' | 'negative' | 'neutral'
}) {
  const toneClass =
    tone === 'positive'
      ? 'text-emerald-600'
      : tone === 'negative'
        ? 'text-rose-500'
        : 'text-foreground'
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-3 sm:p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
        <Icon size={14} className="text-muted-foreground" />
      </div>
      <p className={`text-base sm:text-2xl font-bold tabular-nums mt-1 ${toneClass}`}>
        {value}
      </p>
    </div>
  )
}

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>()
  const groupId = id ?? ''
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-US' : i18n.language
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const { data: group, isLoading: loadingGroup } = useQuery({
    queryKey: ['groups', groupId],
    queryFn: () => groupsApi.get(groupId),
    enabled: !!groupId,
  })

  // Linked members get a read-only view of the group.
  const isOwner = group?.is_owner ?? false
  // The member that represents the current viewer (when linked).
  const viewerMember = useMemo(
    () => group?.members.find((m) => user && m.linked_user_id === user.id),
    [group?.members, user],
  )
  // The "self" member is the owner-payer of the group's transactions.
  const ownerMember = useMemo(
    () => group?.members.find((m) => m.is_self),
    [group?.members],
  )

  const { data: balances } = useQuery({
    queryKey: ['groups', groupId, 'balances'],
    queryFn: () => groupsApi.balances(groupId),
    enabled: !!groupId,
  })

  const { data: settlements } = useQuery({
    queryKey: ['groups', groupId, 'settlements'],
    queryFn: () => groupsApi.settlements.list(groupId),
    enabled: !!groupId,
  })

  const { data: groupTxs } = useQuery({
    queryKey: ['groups', groupId, 'transactions'],
    queryFn: () => groupsApi.transactions(groupId, 20),
    enabled: !!groupId,
  })

  // ── Member management ────────────────────────────────────────
  const [memberDialogOpen, setMemberDialogOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<GroupMember | null>(null)
  const [memberName, setMemberName] = useState('')
  const [memberEmail, setMemberEmail] = useState('')
  const [memberIsSelf, setMemberIsSelf] = useState(false)

  const memberMutation = useMutation({
    mutationFn: (payload: GroupMemberPayload) =>
      editingMember
        ? groupsApi.members.update(groupId, editingMember.id, payload)
        : groupsApi.members.create(groupId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', groupId] })
      queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'balances'] })
      setMemberDialogOpen(false)
      setEditingMember(null)
      toast.success(editingMember ? t('splitGroups.memberUpdated') : t('splitGroups.memberAdded'))
    },
    onError: (err: unknown) => {
      const detail =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined
      toast.error(detail ?? t('common.error'))
    },
  })

  const deleteMemberMutation = useMutation({
    mutationFn: (memberId: string) => groupsApi.members.delete(groupId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', groupId] })
      queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'balances'] })
      setMemberDialogOpen(false)
      setEditingMember(null)
      toast.success(t('splitGroups.memberDeleted'))
    },
    onError: (err: unknown) => {
      const detail =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined
      toast.error(detail ?? t('common.error'))
    },
  })

  const openCreateMember = () => {
    setEditingMember(null)
    setMemberName('')
    setMemberEmail('')
    setMemberIsSelf(false)
    setMemberDialogOpen(true)
  }

  const openEditMember = (member: GroupMember) => {
    setEditingMember(member)
    setMemberName(member.name)
    setMemberEmail(member.email ?? '')
    setMemberIsSelf(member.is_self)
    setMemberDialogOpen(true)
  }

  const saveMember = () => {
    memberMutation.mutate({
      name: memberName.trim(),
      email: memberEmail.trim() || null,
      is_self: memberIsSelf,
    })
  }

  // Resolve an email to an existing Securo user. The lookup is exact-
  // match by design (no listing) — typing the wrong address simply
  // creates a shadow member that the backend can auto-link later.
  const trimmedEmail = memberEmail.trim()
  const { data: lookupResult } = useQuery({
    queryKey: ['users', 'lookup', trimmedEmail.toLowerCase()],
    queryFn: () => usersApi.lookupByEmail(trimmedEmail),
    enabled: trimmedEmail.length >= 3 && trimmedEmail.includes('@'),
    staleTime: 60_000,
    retry: false,
  })

  // ── Settle-up ────────────────────────────────────────────────
  const [settleOpen, setSettleOpen] = useState(false)
  const [settleFrom, setSettleFrom] = useState('')
  const [settleTo, setSettleTo] = useState('')
  const [settleAmount, setSettleAmount] = useState('')
  const [settleDate, setSettleDate] = useState(new Date().toISOString().split('T')[0])
  const [settleNotes, setSettleNotes] = useState('')
  const [settleAffectAccount, setSettleAffectAccount] = useState(false)
  const [settleAccountId, setSettleAccountId] = useState('')

  // Accounts of the requesting user — needed only when the optional
  // "create transaction" toggle is enabled.
  const { data: accountsList } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.list(),
    enabled: settleOpen,
  })

  const settlementMutation = useMutation({
    mutationFn: (payload: GroupSettlementPayload) =>
      groupsApi.settlements.create(groupId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'settlements'] })
      queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'balances'] })
      setSettleOpen(false)
      toast.success(t('splitGroups.settled'))
    },
    onError: (err: unknown) => {
      const detail =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined
      toast.error(detail ?? t('common.error'))
    },
  })

  const deleteSettlementMutation = useMutation({
    mutationFn: (settlementId: string) =>
      groupsApi.settlements.delete(groupId, settlementId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'settlements'] })
      queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'balances'] })
    },
  })

  const openSettleUp = (from?: string, to?: string, amount?: number) => {
    setSettleFrom(from ?? '')
    setSettleTo(to ?? '')
    setSettleAmount(amount != null ? amount.toFixed(2) : '')
    setSettleDate(new Date().toISOString().split('T')[0])
    setSettleNotes('')
    setSettleAffectAccount(false)
    setSettleAccountId('')
    setSettleOpen(true)
  }

  const saveSettlement = () => {
    if (!settleFrom || !settleTo || !settleAmount) return
    const payload: GroupSettlementPayload = {
      from_member_id: settleFrom,
      to_member_id: settleTo,
      amount: parseFloat(settleAmount),
      currency: group?.default_currency ?? 'USD',
      date: settleDate,
      notes: settleNotes.trim() || null,
    }
    if (settleAffectAccount && settleAccountId) {
      payload.account_id = settleAccountId
    }
    settlementMutation.mutate(payload)
  }

  // Lookup helpers
  const memberById = useMemo(() => {
    const map = new Map<string, GroupMember>()
    for (const m of group?.members ?? []) map.set(m.id, m)
    return map
  }, [group?.members])

  const memberName_ = (memberId: string) => memberById.get(memberId)?.name ?? '—'

  // ── KPIs ─────────────────────────────────────────────────────
  const groupCurrency = group?.default_currency ?? 'USD'

  const totalMoved = useMemo(() => {
    if (!groupTxs) return 0
    return groupTxs.reduce((sum, tx) => sum + Number(tx.amount), 0)
  }, [groupTxs])

  const owedToViewer = useMemo(() => {
    if (!balances) return 0
    if (isOwner) {
      return balances.lines
        .filter((l) => l.amount > 0 && l.currency === groupCurrency)
        .reduce((s, l) => s + Number(l.amount), 0)
    }
    // Linked member: any negative line about them = the owner owes them
    if (!viewerMember) return 0
    const myLine = balances.lines.find(
      (l) => l.member_id === viewerMember.id && l.currency === groupCurrency,
    )
    return myLine && myLine.amount < 0 ? Math.abs(Number(myLine.amount)) : 0
  }, [balances, isOwner, viewerMember, groupCurrency])

  const viewerOwes = useMemo(() => {
    if (!balances) return 0
    if (isOwner) {
      return Math.abs(
        balances.lines
          .filter((l) => l.amount < 0 && l.currency === groupCurrency)
          .reduce((s, l) => s + Number(l.amount), 0),
      )
    }
    if (!viewerMember) return 0
    const myLine = balances.lines.find(
      (l) => l.member_id === viewerMember.id && l.currency === groupCurrency,
    )
    return myLine && myLine.amount > 0 ? Number(myLine.amount) : 0
  }, [balances, isOwner, viewerMember, groupCurrency])

  const monthlyData = useMemo(() => {
    if (!groupTxs || groupTxs.length === 0) return []
    const byMonth = new Map<string, number>()
    for (const tx of groupTxs) {
      const m = tx.date.slice(0, 7)
      byMonth.set(m, (byMonth.get(m) ?? 0) + Number(tx.amount))
    }
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({
        month: new Date(month + '-01').toLocaleString(locale, { month: 'short' }),
        total: Number(total.toFixed(2)),
      }))
  }, [groupTxs, locale])

  if (loadingGroup) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }
  if (!group) {
    return <div className="text-muted-foreground">{t('splitGroups.notFound')}</div>
  }

  return (
    <div className="space-y-4">
      <PageHeader
        section={t('splitGroups.section')}
        title={group.name}
        action={
          <div className="flex items-center gap-2">
            {!isOwner && (
              <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
                {t('splitGroups.sharedWithYou')}
              </span>
            )}
            <Button variant="outline" onClick={() => navigate('/groups')}>
              <ArrowLeft size={14} className="mr-1" />
              {t('common.back')}
            </Button>
          </div>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <KpiCard
          label={t('splitGroups.kpiTotalMoved')}
          value={formatCurrency(totalMoved, groupCurrency, locale)}
          icon={Wallet}
        />
        <KpiCard
          label={t(isOwner ? 'splitGroups.kpiOwedToYou' : 'splitGroups.kpiOwedToYouAsMember')}
          value={formatCurrency(owedToViewer, groupCurrency, locale)}
          icon={TrendingUp}
          tone={owedToViewer > 0 ? 'positive' : 'neutral'}
        />
        <KpiCard
          label={t('splitGroups.kpiYouOwe')}
          value={formatCurrency(viewerOwes, groupCurrency, locale)}
          icon={TrendingDown}
          tone={viewerOwes > 0 ? 'negative' : 'neutral'}
        />
      </div>

      {/* Spending trend (compact) */}
      {monthlyData.length > 1 && (
        <SectionCard>
          <SectionHeader
            title={t('splitGroups.spendingTrend')}
            description={t('splitGroups.spendingTrendHint')}
          />
          <div className="px-2 py-3">
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={monthlyData}>
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'var(--muted)' }}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--card)',
                  }}
                  formatter={(v) => formatCurrency(Number(v ?? 0), groupCurrency, locale)}
                />
                <Bar dataKey="total" fill={group.color} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      )}

      {/* Members */}
      <SectionCard>
        <SectionHeader
          title={t('splitGroups.members')}
          action={
            isOwner ? (
              <Button size="sm" className="gap-1.5 h-8" onClick={openCreateMember}>
                <UserPlus size={13} />
                {t('splitGroups.addMember')}
              </Button>
            ) : undefined
          }
        />
        {group.members.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {t('splitGroups.noMembers')}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {group.members.map((member) => (
              <li key={member.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{member.name}</span>
                    {/* "(you)" only marks the actual viewer. is_self
                        identifies the group owner/payer; for non-owner
                        viewers we show that as "(owner)" instead so
                        the badge isn't misleading. */}
                    {viewerMember?.id === member.id ? (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {t('splitGroups.you')}
                      </span>
                    ) : member.is_self && isOwner ? (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {t('splitGroups.you')}
                      </span>
                    ) : member.is_self ? (
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                        {t('splitGroups.ownerBadge')}
                      </span>
                    ) : null}
                  </div>
                  {member.email && (
                    <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      {member.linked_user_id && <Link2 size={10} />}
                      {member.email}
                    </p>
                  )}
                </div>
                {isOwner && (
                  <Button variant="ghost" size="sm" onClick={() => openEditMember(member)}>
                    {t('common.edit')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Balances */}
      <SectionCard>
        <SectionHeader
          title={t('splitGroups.balances')}
          description={t('splitGroups.balancesHint')}
        />
        {balances && balances.lines.length > 0 ? (
          <ul className="divide-y divide-border">
            {balances.lines.map((line, idx) => {
              const positive = line.amount > 0
              // Reframe the line per viewer:
              //   - Owner sees "X owes you" / "you owe X" (their direct relationship).
              //   - A linked member sees their own line as "you owe / owes you {owner}",
              //     and other lines as "{name} owes / is owed by {owner}".
              const ownerName = ownerMember?.name ?? '—'
              const otherName = memberName_(line.member_id)
              const isViewerLine = viewerMember?.id === line.member_id
              const label = isOwner
                ? positive
                  ? t('splitGroups.owesYou', { name: otherName })
                  : t('splitGroups.youOwe', { name: otherName })
                : isViewerLine
                  ? positive
                    ? t('splitGroups.youOwe', { name: ownerName })
                    : t('splitGroups.ownerOwesYou', { name: ownerName })
                  : positive
                    ? t('splitGroups.thirdPartyOwes', { name: otherName, owner: ownerName })
                    : t('splitGroups.thirdPartyOwed', { name: otherName, owner: ownerName })
              return (
                <li
                  key={`${line.member_id}-${line.currency}-${idx}`}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div className="text-sm">{label}</div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        positive ? 'text-emerald-600' : 'text-rose-500'
                      }`}
                    >
                      {formatCurrency(Math.abs(line.amount), line.currency, locale)}
                    </span>
                    {(() => {
                      // Show "Acertar" if the viewer can act on this line:
                      // - Owner can act on any line
                      // - Linked member can only act on their own debt line
                      //   (positive amount = they owe the owner)
                      const canActLinked = !isOwner && isViewerLine && positive
                      if (!isOwner && !canActLinked) return null
                      return (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (!balances.self_member_id) return
                            if (positive) {
                              // Member owes the owner → from = member, to = owner
                              openSettleUp(line.member_id, balances.self_member_id, Math.abs(line.amount))
                            } else {
                              // Owner owes the member → from = owner, to = member
                              openSettleUp(balances.self_member_id, line.member_id, Math.abs(line.amount))
                            }
                          }}
                        >
                          {canActLinked ? t('splitGroups.payNow') : t('splitGroups.settleUp')}
                        </Button>
                      )
                    })()}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="text-center py-6 text-muted-foreground text-sm">
            {t('splitGroups.allSettled')}
          </div>
        )}
      </SectionCard>

      {/* Recent transactions */}
      <SectionCard>
        <SectionHeader
          title={t('splitGroups.recentTransactions')}
          description={t('splitGroups.recentTransactionsHint')}
          action={
            groupTxs && groupTxs.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 h-8 text-xs"
                onClick={() => navigate(`/transactions?group_id=${groupId}`)}
              >
                {t('splitGroups.viewAllTransactions')}
                <ArrowRight size={12} />
              </Button>
            ) : undefined
          }
        />
        {!groupTxs ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : groupTxs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm flex flex-col items-center gap-2">
            <Receipt size={20} className="opacity-50" />
            {t('splitGroups.noTransactions')}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {groupTxs.slice(0, 8).map((tx) => (
              <li
                key={tx.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted cursor-pointer transition-colors"
                onClick={() => navigate(`/transactions?group_id=${groupId}&highlight=${tx.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {tx.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(tx.date + 'T00:00:00').toLocaleDateString(locale)}
                    {tx.category?.name ? ` · ${tx.category.name}` : ''}
                    {tx.splits && tx.splits.length > 0
                      ? ` · ${t('splitGroups.splitWays', { count: tx.splits.length })}`
                      : ''}
                  </p>
                </div>
                <span
                  className={`text-sm font-semibold tabular-nums ml-3 ${
                    tx.type === 'debit' ? 'text-rose-500' : 'text-emerald-600'
                  }`}
                >
                  {formatCurrency(Number(tx.amount), tx.currency, locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Settlements */}
      <SectionCard>
        <SectionHeader
          title={t('splitGroups.settlements')}
          action={
            isOwner ? (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-8"
                onClick={() => openSettleUp()}
              >
                {t('splitGroups.recordSettlement')}
              </Button>
            ) : undefined
          }
        />
        {settlements && settlements.length > 0 ? (
          <ul className="divide-y divide-border">
            {settlements.map((s: GroupSettlement) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm flex items-center gap-1.5">
                    <span className="font-medium">{memberName_(s.from_member_id)}</span>
                    <ArrowRight size={12} className="text-muted-foreground" />
                    <span className="font-medium">{memberName_(s.to_member_id)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(s.date + 'T00:00:00').toLocaleDateString(locale)}
                    {s.notes ? ` · ${s.notes}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums">
                    {formatCurrency(s.amount, s.currency, locale)}
                  </span>
                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSettlementMutation.mutate(s.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-6 text-muted-foreground text-sm">
            {t('splitGroups.noSettlements')}
          </div>
        )}
      </SectionCard>

      {/* Member dialog */}
      <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingMember ? t('splitGroups.editMember') : t('splitGroups.addMember')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('splitGroups.memberName')}</Label>
              <Input value={memberName} onChange={(e) => setMemberName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('splitGroups.memberEmail')}</Label>
              <Input
                type="email"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
              />
              {lookupResult ? (
                <p className="text-xs text-emerald-600 inline-flex items-center gap-1">
                  <Link2 size={11} />
                  {t('splitGroups.willLinkToUser', { email: lookupResult.email })}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t('splitGroups.memberEmailHint')}
                </p>
              )}
            </div>
            <label className="text-sm text-muted-foreground inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={memberIsSelf}
                onChange={(e) => setMemberIsSelf(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              {t('splitGroups.isSelf')}
            </label>
          </div>
          <DialogFooter className={editingMember ? 'flex justify-between sm:justify-between' : ''}>
            {editingMember && (
              <Button
                variant="destructive"
                onClick={() => deleteMemberMutation.mutate(editingMember.id)}
                disabled={deleteMemberMutation.isPending}
              >
                <Trash2 size={14} className="mr-1" />
                {t('common.delete')}
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMemberDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={saveMember}
                disabled={!memberName.trim() || memberMutation.isPending}
              >
                {t('common.save')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settle dialog */}
      <Dialog open={settleOpen} onOpenChange={setSettleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('splitGroups.recordSettlement')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('splitGroups.from')}</Label>
              <select
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                value={settleFrom}
                onChange={(e) => setSettleFrom(e.target.value)}
              >
                <option value="">{t('splitGroups.selectMember')}</option>
                {group.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t('splitGroups.to')}</Label>
              <select
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                value={settleTo}
                onChange={(e) => setSettleTo(e.target.value)}
              >
                <option value="">{t('splitGroups.selectMember')}</option>
                {group.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('splitGroups.amount')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('splitGroups.date')}</Label>
                <Input
                  type="date"
                  value={settleDate}
                  onChange={(e) => setSettleDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('splitGroups.notes')}</Label>
              <textarea
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background resize-none"
                rows={2}
                value={settleNotes}
                onChange={(e) => setSettleNotes(e.target.value)}
              />
            </div>

            {/* Optional account integration — turn the social-ledger
                settlement into a real money movement on the payer's
                side. The receiver's bank entry is matched separately
                via sync. */}
            <div className="space-y-2 pt-2 border-t border-border">
              <label className="text-sm font-medium inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settleAffectAccount}
                  onChange={(e) => setSettleAffectAccount(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                {t('splitGroups.affectAccount')}
              </label>
              {settleAffectAccount && (
                <div className="space-y-1">
                  <select
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                    value={settleAccountId}
                    onChange={(e) => setSettleAccountId(e.target.value)}
                  >
                    <option value="">{t('splitGroups.selectAccount')}</option>
                    {(accountsList ?? []).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.display_name || a.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {t('splitGroups.affectAccountHint')}
                  </p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettleOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={saveSettlement}
              disabled={
                !settleFrom ||
                !settleTo ||
                settleFrom === settleTo ||
                !settleAmount ||
                (settleAffectAccount && !settleAccountId) ||
                settlementMutation.isPending
              }
            >
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
