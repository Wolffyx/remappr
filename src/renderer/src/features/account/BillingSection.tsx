// Pattern check: no GoF pattern (-) — rejected — a settings card and its
// dialog over lib/cloud/billing; same shape as BuilderDevices.
//
// Settings → Account → Plan: what this account has, Upgrade (Stripe
// Checkout) and Manage billing (the Stripe Billing Portal). After a checkout
// in the browser, coming back to the window reads the plan again; a plan that
// grants the builder then activates this device on its own (licenseStore).
import { useCallback, useEffect, useState } from 'react'
import { CreditCard, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { createLogger } from '@shared/logger'
import { Button } from '@/ui/button'
import { Modal } from '@/ui/modal'
import {
    openBillingPortal,
    paidPlans,
    priceLabel,
    startCheckout,
    type PaidPlan,
} from '@/lib/cloud/billing'
import { getCloudClient } from '@/lib/cloud/client'
import { cloudErrorMessage } from '@/lib/cloud/errors'
import { refreshPlan } from '@/lib/entitlements'
import useAuthStore from '@/stores/authStore'
import { isElectron } from '@/transport'

const log = createLogger('Billing')
/** valid_until carries the 7-day grace after the paid period (migration 300). */
const GRACE_MS = 7 * 86_400_000

/** The last day a subscription is paid for. */
const paidThrough = (validUntil: string): string =>
    new Date(new Date(validUntil).getTime() - GRACE_MS).toLocaleDateString()

/** Set while a checkout is open elsewhere: focus then reads the plan. */
const PENDING_KEY = 'remappr.checkout.pending'

interface Owned {
    plan: string
    type: 'one_time' | 'subscription' | 'comp'
    status: string
    validUntil: string | null
}

const pending = {
    get: (): boolean => {
        try {
            return sessionStorage.getItem(PENDING_KEY) === '1'
        } catch {
            return false
        }
    },
    set: (on: boolean): void => {
        try {
            if (on) sessionStorage.setItem(PENDING_KEY, '1')
            else sessionStorage.removeItem(PENDING_KEY)
        } catch {
            // Private mode: the focus refresh just does not happen.
        }
    },
}

async function ownedPurchases(): Promise<Owned[]> {
    const client = await getCloudClient()
    if (!client) return []
    const { data, error } = await client
        .from('purchases')
        .select('plan_key, type, status, valid_until')
        .order('created_at', { ascending: false })
    if (error) throw error
    return data.map((p) => ({
        plan: p.plan_key,
        type: p.type as Owned['type'],
        status: p.status,
        validUntil: p.valid_until,
    }))
}

const isLive = (p: Owned): boolean =>
    p.status === 'active' &&
    (!p.validUntil || new Date(p.validUntil).getTime() > Date.now())

function UpgradeDialog({
    plans,
    opened,
    onClose,
}: {
    plans: PaidPlan[]
    opened: boolean
    onClose: () => void
}): JSX.Element {
    const [busy, setBusy] = useState<string | null>(null)
    const electron = isElectron()

    const buy = (plan: PaidPlan): void => {
        setBusy(plan.key)
        pending.set(true)
        startCheckout(plan.key, electron)
            .then(() => {
                if (electron) {
                    toast.info('Finish the purchase in your browser', {
                        description:
                            'Come back here when it is done; Remappr picks it up.',
                    })
                    onClose()
                }
            })
            .catch((e: unknown) => {
                pending.set(false)
                toast.error(cloudErrorMessage(e))
            })
            .finally(() => setBusy(null))
    }

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            size="sm"
            title="Upgrade"
            subtitle="Payment happens on Stripe; Remappr never sees your card."
            headerIcon={<Sparkles />}
            showFooter={false}
        >
            <ul className="space-y-2">
                {plans.map((p) => (
                    <li
                        key={p.key}
                        className="flex items-center gap-3 rounded-lg border px-3 py-2"
                    >
                        <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold">
                                {p.name}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                                {priceLabel(p) ?? 'Price shown at checkout'}
                            </span>
                        </span>
                        <Button
                            size="sm"
                            disabled={busy !== null}
                            onClick={() => buy(p)}
                        >
                            {busy === p.key ? 'Opening…' : 'Buy'}
                        </Button>
                    </li>
                ))}
            </ul>
        </Modal>
    )
}

export function BillingSection(): JSX.Element | null {
    const signedIn = useAuthStore((s) => s.status === 'signed_in')
    const [plans, setPlans] = useState<PaidPlan[] | null>(null)
    const [owned, setOwned] = useState<Owned[]>([])
    const [upgrading, setUpgrading] = useState(false)
    const [opening, setOpening] = useState(false)

    const load = useCallback(
        (): Promise<void> =>
            Promise.all([paidPlans(), ownedPurchases()])
                .then(([list, mine]) => {
                    setPlans(list)
                    setOwned(mine)
                })
                .catch((e: unknown) => {
                    log.warn('billing read failed', e)
                    setPlans([])
                }),
        [],
    )

    useEffect(() => {
        if (!signedIn) return
        void load()
    }, [signedIn, load])

    // Back from Checkout in the browser: read the plan and purchases again.
    useEffect(() => {
        const onFocus = (): void => {
            if (!pending.get()) return
            void refreshPlan()
            void load().then(() => pending.set(false))
        }
        window.addEventListener('focus', onFocus)
        return () => window.removeEventListener('focus', onFocus)
    }, [load])

    if (!signedIn) return null

    const live = owned.filter(isLive)
    const names = new Map((plans ?? []).map((p) => [p.key, p.name]))
    const lifetime = live.some((p) => p.type === 'one_time')
    const billed = owned.some((p) => p.type !== 'comp')
    const canUpgrade = !lifetime && (plans?.length ?? 0) > 0

    const manage = (): void => {
        setOpening(true)
        openBillingPortal(isElectron())
            .catch((e: unknown) => toast.error(cloudErrorMessage(e)))
            .finally(() => setOpening(false))
    }

    return (
        <div className="space-y-2 rounded-xl border bg-background p-4">
            <div className="flex items-center gap-2">
                <CreditCard className="size-4" />
                <span className="flex-1 text-panel-title font-semibold">
                    Plan
                </span>
            </div>
            {live.length === 0 ? (
                <p className="text-sm">Free</p>
            ) : (
                <ul className="space-y-1 text-sm">
                    {live.map((p) => (
                        <li key={`${p.plan}${p.validUntil}`}>
                            <span className="font-semibold">
                                {names.get(p.plan) ?? p.plan}
                            </span>
                            {p.type === 'subscription' && p.validUntil && (
                                <span className="text-xs text-muted-foreground">
                                    {' '}
                                    · paid through {paidThrough(p.validUntil)}
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            )}
            {plans?.length === 0 && live.length === 0 && (
                <p className="text-xs text-muted-foreground">
                    Paid plans are not on sale yet.
                </p>
            )}
            <div className="flex flex-wrap gap-2">
                {canUpgrade && (
                    <Button size="sm" onClick={() => setUpgrading(true)}>
                        <Sparkles className="size-3.5" /> Upgrade
                    </Button>
                )}
                {billed && (
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={opening}
                        onClick={manage}
                    >
                        Manage billing
                    </Button>
                )}
            </div>
            <UpgradeDialog
                plans={plans ?? []}
                opened={upgrading}
                onClose={() => setUpgrading(false)}
            />
        </div>
    )
}
