// Pattern check: no GoF pattern (-) — rejected — one settings card with an
// export button and a confirm-by-email delete dialog.
//
// Settings → Account → Your data: download everything the cloud keeps about
// you, or delete the account. Deleting asks for the account's email; items
// saved on this device stay on it.
import { useState } from 'react'
import { Download, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { Modal } from '@/ui/modal'
import { downloadExports } from '@/lib/blob'
import { deleteAccount, exportAccount } from '@/lib/cloud/account'
import { cloudErrorMessage } from '@/lib/cloud/errors'
import useAuthStore from '@/stores/authStore'
import useSyncStore from '@/stores/syncStore'

const PRIVACY_URL = 'https://docs.remappr.com/legal/privacy'

export function AccountData(): JSX.Element {
    const email = useAuthStore((s) => s.user?.email ?? '')
    const disableSync = useSyncStore((s) => s.disable)
    const [exporting, setExporting] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [typed, setTyped] = useState('')

    const handleExport = async (): Promise<void> => {
        setExporting(true)
        try {
            const data = await exportAccount()
            const day = new Date().toISOString().slice(0, 10)
            downloadExports([
                {
                    filename: `remappr-account-${day}.json`,
                    mime: 'application/json',
                    content: JSON.stringify(data, null, 2),
                },
            ])
        } catch (err) {
            toast.error(cloudErrorMessage(err))
        } finally {
            setExporting(false)
        }
    }

    const closeConfirm = (): void => {
        setConfirmOpen(false)
        setTyped('')
    }

    const handleDelete = async (): Promise<void> => {
        setDeleting(true)
        try {
            disableSync()
            await deleteAccount(typed)
            closeConfirm()
            toast.success('Your account is deleted')
        } catch (err) {
            toast.error(cloudErrorMessage(err))
        } finally {
            setDeleting(false)
        }
    }

    const matches = typed.trim().toLowerCase() === email.toLowerCase()

    return (
        <div className="space-y-3 rounded-xl border bg-background p-4">
            <div>
                <div className="text-sm font-medium">Your data</div>
                <p className="text-xs text-muted-foreground">
                    Download a copy of everything kept in your account, or
                    delete it.{' '}
                    <a
                        href={PRIVACY_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-2"
                    >
                        Privacy policy
                    </a>
                </p>
            </div>
            <div className="flex flex-wrap gap-2">
                <Button
                    size="sm"
                    variant="outline"
                    disabled={exporting}
                    onClick={() => void handleExport()}
                >
                    <Download className="size-3.5" />
                    {exporting ? 'Preparing…' : 'Download my data'}
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    onClick={() => setConfirmOpen(true)}
                >
                    <Trash2 className="size-3.5" /> Delete account
                </Button>
            </div>

            <Modal
                size="sm"
                opened={confirmOpen}
                onClose={closeConfirm}
                title="Delete account"
                subtitle="This cannot be undone."
                headerIcon={<Trash2 />}
                footer={
                    <div className="flex w-full justify-end gap-2">
                        <Button variant="outline" onClick={closeConfirm}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={!matches || deleting}
                            onClick={() => void handleDelete()}
                        >
                            {deleting ? 'Deleting…' : 'Delete for good'}
                        </Button>
                    </div>
                }
            >
                <div className="space-y-3 text-sm">
                    <p className="text-muted-foreground">
                        Your profile, cloud library, published items, stars,
                        device photos and builder devices are removed. Your
                        comments stay in their threads as “[deleted]”, without
                        their text. Items saved on this device stay here.
                    </p>
                    <div className="space-y-1.5">
                        <Label htmlFor="account-delete-confirm">
                            Type {email} to confirm
                        </Label>
                        <Input
                            id="account-delete-confirm"
                            value={typed}
                            autoComplete="off"
                            onChange={(e) => setTyped(e.target.value)}
                        />
                    </div>
                </div>
            </Modal>
        </div>
    )
}
