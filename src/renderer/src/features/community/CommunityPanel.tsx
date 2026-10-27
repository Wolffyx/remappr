// Pattern check: no GoF pattern (-) — rejected — presentational search panel
// over the community repository; the item dialog does the rest.
//
// The Library's Community tab: search what others published, filter by kind
// and device, sort by new / stars / downloads, narrow to the connected device
// (its firmware's identity() matched against community boards), or paste an
// unlisted item's share link.
import { useCallback, useEffect, useState } from 'react'
import { Cpu, Download, Link2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Segmented } from '@/ui/segmented'
import { AppSelect } from '@/ui/app-select'
import { cloudErrorMessage } from '@/lib/cloud/errors'
import type {
    CommunityHit,
    SearchFilters,
    SearchSort,
} from '@/lib/library/communityLibrary'
import type { LibraryEntry } from '@/lib/library/types'
import useConnectionStore from '@/stores/connectionStore'
import { getCommunity, shareTokenFrom } from './community'
import {
    CommunityItemDialog,
    type CommunityTarget,
} from './CommunityItemDialog'

type TypeFilter = 'all' | 'config' | 'device'
const PAGE_SIZE = 24
const SEARCH_DELAY_MS = 300

interface DeviceMatch {
    deviceId: string
    name: string
}

/** The best community board for the connected device, or null. */
async function matchConnected(): Promise<DeviceMatch | null> {
    const identity = useConnectionStore.getState().service?.identity
    const community = await getCommunity()
    if (!identity || !community) return null
    const [best] = await community.match(await identity.identifiers())
    if (!best) return null
    const item = await community.item(best.deviceId)
    return item ? { deviceId: best.deviceId, name: item.name } : null
}

function HitRow({
    hit,
    onOpen,
}: {
    hit: CommunityHit
    onOpen: () => void
}): JSX.Element {
    const facts = [
        hit.type === 'device' ? 'Board' : 'Config',
        hit.deviceKind,
        hit.target,
        hit.owner && `by ${hit.owner}`,
    ]
    return (
        <li>
            <button
                type="button"
                onClick={onOpen}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-background p-3 text-left hover:border-primary/50"
            >
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-panel-title font-semibold">
                        {hit.name}
                    </span>
                    {hit.summary && (
                        <span className="block truncate text-xs text-muted-foreground">
                            {hit.summary}
                        </span>
                    )}
                    <span className="block text-xs text-muted-foreground">
                        {facts.filter(Boolean).join(' · ')}
                    </span>
                </span>
                <span
                    className="flex items-center gap-1 text-xs text-muted-foreground"
                    title="Downloads"
                >
                    <Download className="size-3.5" /> {hit.downloads}
                </span>
            </button>
        </li>
    )
}

export function CommunityPanel({
    onOpen,
}: {
    onOpen?: (entry: LibraryEntry) => Promise<boolean> | boolean
}): JSX.Element {
    const connected = useConnectionStore((s) => !!s.service?.identity)
    const [query, setQuery] = useState('')
    const [type, setType] = useState<TypeFilter>('all')
    const [sort, setSort] = useState<SearchSort>('new')
    const [forDevice, setForDevice] = useState<DeviceMatch | null>(null)
    const [hits, setHits] = useState<CommunityHit[]>([])
    const [page, setPage] = useState(0)
    const [more, setMore] = useState(false)
    const [loading, setLoading] = useState(false)
    const [shareText, setShareText] = useState('')
    const [target, setTarget] = useState<CommunityTarget | null>(null)

    const runSearch = useCallback(
        async (nextPage: number): Promise<void> => {
            const community = await getCommunity()
            if (!community) return
            const filters: SearchFilters = {
                ...(type !== 'all' ? { type } : {}),
                ...(forDevice ? { device_id: forDevice.deviceId } : {}),
            }
            setLoading(true)
            try {
                const found = await community.search(
                    query.trim(),
                    filters,
                    sort,
                    nextPage,
                )
                setHits((prev) =>
                    nextPage === 0 ? found : [...prev, ...found],
                )
                setPage(nextPage)
                setMore(found.length === PAGE_SIZE)
            } catch (e) {
                toast.error(cloudErrorMessage(e))
            } finally {
                setLoading(false)
            }
        },
        [query, type, sort, forDevice],
    )

    useEffect(() => {
        const timer = setTimeout(() => void runSearch(0), SEARCH_DELAY_MS)
        return () => clearTimeout(timer)
    }, [runSearch])

    const toggleDevice = async (): Promise<void> => {
        if (forDevice) {
            setForDevice(null)
            return
        }
        try {
            const match = await matchConnected()
            if (match) setForDevice(match)
            else toast.info('No community board matches this device yet')
        } catch (e) {
            toast.error(cloudErrorMessage(e))
        }
    }

    const openShare = (): void => {
        const token = shareTokenFrom(shareText)
        if (!token) {
            toast.error('That is not a Remappr share link')
            return
        }
        setShareText('')
        setTarget({ token })
    }

    return (
        <div className="space-y-3">
            <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    aria-label="Search the community"
                    placeholder="Search boards and configs"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-8"
                />
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <Segmented<TypeFilter>
                    label="Kind"
                    value={type}
                    onChange={setType}
                    options={[
                        { value: 'all', label: 'All' },
                        { value: 'config', label: 'Configs' },
                        { value: 'device', label: 'Boards' },
                    ]}
                />
                <AppSelect
                    aria-label="Sort"
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SearchSort)}
                >
                    <option value="new">Newest</option>
                    <option value="downloads">Most downloaded</option>
                    <option value="stars">Most starred</option>
                </AppSelect>
                {connected && (
                    <Button
                        size="sm"
                        variant={forDevice ? 'default' : 'outline'}
                        onClick={() => void toggleDevice()}
                    >
                        <Cpu className="size-3.5" /> For this device
                    </Button>
                )}
            </div>
            {forDevice && (
                <p className="text-sm">
                    This looks like <strong>{forDevice.name}</strong> ·{' '}
                    {hits.length}
                    {more ? '+' : ''} community item
                    {hits.length === 1 ? '' : 's'}
                </p>
            )}

            {hits.length === 0 && !loading ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                    Nothing published matches yet.
                </p>
            ) : (
                <ul className="space-y-2">
                    {hits.map((h) => (
                        <HitRow
                            key={h.id}
                            hit={h}
                            onOpen={() => setTarget({ itemId: h.id })}
                        />
                    ))}
                </ul>
            )}
            {more && (
                <Button
                    variant="ghost"
                    className="w-full"
                    disabled={loading}
                    onClick={() => void runSearch(page + 1)}
                >
                    Show more
                </Button>
            )}

            <div className="flex gap-2 border-t pt-3">
                <Input
                    aria-label="Share link"
                    placeholder="Paste a share link"
                    value={shareText}
                    onChange={(e) => setShareText(e.target.value)}
                />
                <Button
                    variant="outline"
                    disabled={!shareText.trim()}
                    onClick={openShare}
                >
                    <Link2 className="size-4" /> Open
                </Button>
            </div>

            <CommunityItemDialog
                target={target}
                onClose={() => setTarget(null)}
                onOpen={onOpen}
            />
        </div>
    )
}
