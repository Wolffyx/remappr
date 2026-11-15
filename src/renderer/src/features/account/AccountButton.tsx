// pattern-check: skip — header trigger reusing Modal + AccountSection.
//
// The header's account entry: the avatar when signed in, a person icon when not.
// Opens the same Account panel as Settings → Account.
import { UserRound } from 'lucide-react'
import { Modal } from '@/ui/modal'
import useAuthStore from '@/stores/authStore'
import { AccountPanel } from './AccountSection'

function AccountIcon(): JSX.Element {
    const avatar = useAuthStore((s) => s.profile?.avatar_url)
    if (avatar) {
        return (
            <img
                src={avatar}
                alt=""
                className="size-5 rounded-full"
                referrerPolicy="no-referrer"
            />
        )
    }
    return <UserRound />
}

export function AccountButton(): JSX.Element {
    return (
        <Modal
            size="md"
            title="Account"
            subtitle="Optional: cloud sync and publishing"
            headerIcon={<UserRound />}
            type="icon"
            icon={<AccountIcon />}
            variant="ghost"
            showFooter={false}
        >
            <AccountPanel />
        </Modal>
    )
}
