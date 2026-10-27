// Pattern check: no GoF pattern (-) — rejected — a dialog orchestrating the
// community repository, the library store and the sync store; no logic beyond
// sequencing.
//
// Publish a synced library entry: unlisted (a link only) or public (listed in
// the community), with a license and a changelog. Each publish stamps the
// current version as a release; later edits stay private until the next one.
// Board items can carry a photo.
import { useEffect, useState } from 'react'
import { Copy, Globe, Link2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { Modal } from '@/ui/modal'
import { Segmented } from '@/ui/segmented'
import { AppSelect } from '@/ui/app-select'
import { cloudErrorMessage } from '@/lib/cloud/errors'
import {
    LICENSES,
    type License,
    type PublishStatus,
    type Visibility,
} from '@/lib/library/communityLibrary'
import type { LibraryEntry } from '@/lib/library/types'
import useAuthStore from '@/stores/authStore'
import useLibraryStore from '@/stores/libraryStore'
import useSyncStore from '@/stores/syncStore'
import { getCommunity, shareUrl } from './community'

const IMAGE_TYPES = 'image/webp,image/png,image/jpeg'
const IMAGE_MAX_BYTES = 2 * 1024 * 1024

function statusLine(status: PublishStatus | null): string {
    if (!status || status.publishedVersion === null) return 'Not published yet.'
    const where =
        status.visibility === 'public'
            ? 'Public'
            : status.visibility === 'unlisted'
              ? 'Unlisted'
              : 'Private'
    const behind =
        status.headVersion > status.publishedVersion
            ? ' · newer changes not published'
            : ''
    return `${where} · ${status.license ?? 'no license'}${behind}`
}

/** Make sure the entry's latest edit is in the cloud; resolves its item id. */
async function syncedItemId(localId: string): Promise<string> {
    await useSyncStore.getState().syncNow()
    const entry = useLibraryStore
        .getState()
        .entries.find((e) => e.localId === localId)
    if (
        !entry?.sync.itemId ||
        entry.sync.dirty ||
        entry.sync.state !== 'synced'
    )
        throw new Error(
            'It is not in sync with your account yet. Sync it, then publish.',
        )
    return entry.sync.itemId
}

function UsernamePrompt(): JSX.Element {
    const updateProfile = useAuthStore((s) => s.updateProfile)
    const [name, setName] = useState('')
    const save = async (): Promise<void> => {
        try {
            await updateProfile({ username: name.trim() })
        } catch (e) {
            toast.error(cloudErrorMessage(e))
        }
    }
    return (
        <div className="space-y-1.5 rounded-lg border border-dashed p-3">
            <Label htmlFor="publish-username">Pick a username first</Label>
            <div className="flex gap-2">
                <Input
                    id="publish-username"
                    value={name}
                    onChange={(e) => setName(e.target.value.toLowerCase())}
                    placeholder="shown on what you publish"
                />
                <Button
                    variant="outline"
                    disabled={!name.trim()}
                    onClick={() => void save()}
                >
                    Save
                </Button>
            </div>
        </div>
    )
}

export function PublishDialog({
    entry,
    onClose,
}: {
    entry: LibraryEntry | null
    onClose: () => void
}): JSX.Element {
    const username = useAuthStore((s) => s.profile?.username ?? null)
    const userId = useAuthStore((s) => s.user?.id ?? null)
    const [status, setStatus] = useState<PublishStatus | null>(null)
    const [visibility, setVisibility] = useState<Visibility>('public')
    const [license, setLicense] = useState<License>('CC-BY-4.0')
    const [changelog, setChangelog] = useState('')
    const [image, setImage] = useState<File | null>(null)
    const [link, setLink] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const itemId = entry?.sync.itemId ?? null

    useEffect(() => {
        if (!itemId) return
        let live = true
        void (async () => {
            const community = await getCommunity()
            const s = (await community?.status(itemId)) ?? null
            const token =
                s?.visibility === 'unlisted'
                    ? await community?.shareToken(itemId)
                    : null
            if (!live) return
            setStatus(s)
            if (s?.license) setLicense(s.license)
            if (s && s.visibility !== 'private') setVisibility(s.visibility)
            setLink(token ? shareUrl(token) : null)
        })().catch((e: unknown) => toast.error(cloudErrorMessage(e)))
        return () => {
            live = false
            setStatus(null)
            setLink(null)
            setChangelog('')
            setImage(null)
        }
    }, [itemId])

    const run = async (task: () => Promise<void>): Promise<void> => {
        setBusy(true)
        try {
            await task()
        } catch (e) {
            toast.error(cloudErrorMessage(e))
        } finally {
            setBusy(false)
        }
    }

    const attachImage = async (
        localId: string,
        owner: string,
        id: string,
    ): Promise<void> => {
        if (!image || !entry) return
        const community = await getCommunity()
        if (!community) return
        const path = await community.uploadImage(owner, id, image, image.name)
        await useLibraryStore
            .getState()
            .update(localId, { extra: { ...entry.extra, imagePath: path } })
    }

    const publish = (): Promise<void> =>
        run(async () => {
            if (!entry || !userId || !itemId) return
            await attachImage(entry.localId, userId, itemId)
            const id = await syncedItemId(entry.localId)
            const community = await getCommunity()
            if (!community) return
            const release = await community.publish(
                id,
                visibility,
                license,
                changelog.trim(),
            )
            const token =
                visibility === 'unlisted'
                    ? await community.shareToken(id)
                    : null
            setLink(token ? shareUrl(token) : null)
            setStatus(await community.status(id))
            setChangelog('')
            toast.success(`Published release ${release} of "${entry.name}"`)
        })

    const unpublish = (): Promise<void> =>
        run(async () => {
            const community = await getCommunity()
            if (!community || !itemId) return
            await community.unpublish(itemId)
            setLink(null)
            setStatus(await community.status(itemId))
            toast.success('It is private again; old links stop working')
        })

    const rotate = (): Promise<void> =>
        run(async () => {
            const community = await getCommunity()
            if (!community || !itemId) return
            setLink(shareUrl(await community.rotateShareToken(itemId)))
            toast.success('New link made; the old one stops working')
        })

    const copy = async (): Promise<void> => {
        if (!link) return
        await navigator.clipboard.writeText(link)
        toast.success('Link copied')
    }

    const pickImage = (file: File | undefined): void => {
        if (file && file.size > IMAGE_MAX_BYTES) {
            toast.error('Pick an image under 2 MB')
            return
        }
        setImage(file ?? null)
    }

    const published = !!status && status.visibility !== 'private'

    return (
        <Modal
            size="sm"
            opened={!!entry}
            onClose={onClose}
            title={`Publish "${entry?.name ?? ''}"`}
            subtitle={statusLine(status)}
            headerIcon={<Globe />}
            footer={
                <div className="flex w-full flex-wrap justify-end gap-2">
                    {published && (
                        <Button
                            variant="ghost"
                            disabled={busy}
                            onClick={() => void unpublish()}
                        >
                            Make private
                        </Button>
                    )}
                    <Button
                        disabled={busy || !username}
                        onClick={() => void publish()}
                    >
                        {published ? 'Publish update' : 'Publish'}
                    </Button>
                </div>
            }
        >
            <div className="space-y-4">
                {!username && <UsernamePrompt />}
                <Label className="block">Who can see it</Label>
                <Segmented<Visibility>
                    label="Who can see it"
                    value={visibility}
                    onChange={setVisibility}
                    options={[
                        {
                            value: 'public',
                            label: 'Public',
                            title: 'Listed in the community',
                        },
                        {
                            value: 'unlisted',
                            label: 'Unlisted',
                            title: 'Only people with the link',
                        },
                    ]}
                />
                <div className="space-y-1.5">
                    <Label>License</Label>
                    <AppSelect
                        aria-label="License"
                        value={license}
                        onChange={(e) => setLicense(e.target.value as License)}
                    >
                        {LICENSES.map((l) => (
                            <option key={l.id} value={l.id}>
                                {l.label}
                            </option>
                        ))}
                    </AppSelect>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="publish-changelog">What changed</Label>
                    <textarea
                        id="publish-changelog"
                        value={changelog}
                        maxLength={2000}
                        rows={3}
                        onChange={(e) => setChangelog(e.target.value)}
                        placeholder={
                            published
                                ? 'Shown with this release'
                                : 'Optional for the first release'
                        }
                        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    />
                </div>
                {entry?.type === 'device' && (
                    <div className="space-y-1.5">
                        <Label htmlFor="publish-image">Photo (optional)</Label>
                        <Input
                            id="publish-image"
                            type="file"
                            accept={IMAGE_TYPES}
                            onChange={(e) => pickImage(e.target.files?.[0])}
                        />
                    </div>
                )}
                {link && (
                    <div className="space-y-1.5">
                        <Label>
                            <Link2 className="mr-1 inline size-3.5" />
                            Share link
                        </Label>
                        <div className="flex gap-2">
                            <Input
                                readOnly
                                value={link}
                                onFocus={(e) => e.target.select()}
                            />
                            <Button
                                variant="outline"
                                size="icon"
                                aria-label="Copy link"
                                onClick={() => void copy()}
                            >
                                <Copy className="size-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                aria-label="Make a new link"
                                disabled={busy}
                                onClick={() => void rotate()}
                            >
                                <RefreshCw className="size-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    )
}
