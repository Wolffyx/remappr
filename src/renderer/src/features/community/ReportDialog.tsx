// Pattern check: no GoF pattern (-) — rejected — presentational dialog over
// SocialLibrary.report.
//
// Report an item or a comment: a reason and an optional note. Three open
// reports take an item out of the community until a moderator looks.
import { useState } from 'react'
import { Flag } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/ui/button'
import { Label } from '@/ui/label'
import { Modal } from '@/ui/modal'
import { AppSelect } from '@/ui/app-select'
import { cloudErrorMessage } from '@/lib/cloud/errors'
import {
    REPORT_REASONS,
    type ReportReason,
    type ReportTarget,
} from '@/lib/library/socialLibrary'
import { getSocial } from './community'

const ALREADY_REPORTED = /duplicate key|reports_once/

export function ReportDialog({
    target,
    what,
    onClose,
}: {
    target: ReportTarget | null
    /** "this item" / "this comment", for the title. */
    what: string
    onClose: () => void
}): JSX.Element {
    const [reason, setReason] = useState<ReportReason>('malicious_macro')
    const [note, setNote] = useState('')
    const [busy, setBusy] = useState(false)

    const send = async (): Promise<void> => {
        if (!target) return
        setBusy(true)
        try {
            const social = await getSocial()
            await social?.report(target, reason, note.trim())
            toast.success('Thanks — a moderator will look at it')
            setNote('')
            onClose()
        } catch (e) {
            const message = cloudErrorMessage(e)
            toast.error(
                ALREADY_REPORTED.test(message)
                    ? 'You already reported this'
                    : message,
            )
        } finally {
            setBusy(false)
        }
    }

    return (
        <Modal
            size="sm"
            opened={!!target}
            onClose={onClose}
            title={`Report ${what}`}
            headerIcon={<Flag />}
            footer={
                <div className="flex w-full justify-end">
                    <Button
                        variant="destructive"
                        disabled={busy}
                        onClick={() => void send()}
                    >
                        Send report
                    </Button>
                </div>
            }
        >
            <div className="space-y-3">
                <div className="space-y-1.5">
                    <Label>Reason</Label>
                    <AppSelect
                        aria-label="Reason"
                        value={reason}
                        onChange={(e) =>
                            setReason(e.target.value as ReportReason)
                        }
                    >
                        {REPORT_REASONS.map((r) => (
                            <option key={r.id} value={r.id}>
                                {r.label}
                            </option>
                        ))}
                    </AppSelect>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="report-note">Details (optional)</Label>
                    <textarea
                        id="report-note"
                        value={note}
                        maxLength={1000}
                        rows={3}
                        onChange={(e) => setNote(e.target.value)}
                        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    />
                </div>
            </div>
        </Modal>
    )
}
