import { useState } from 'react'
import { Modal } from '@/ui/modal'
import { DropdownMenuItem } from '@/ui/dropdown-menu'
import { RotateCcw } from 'lucide-react'

interface RestoreStockModalProps {
    onOk: () => void
}

export function RestoreStockModal(props: RestoreStockModalProps): JSX.Element {
    const [showModal, setShowModal] = useState(false)

    const handleClick = (): void => {
        setShowModal(true)
    }

    const handleOk = (): void => {
        props.onOk()
        setShowModal(false)
    }

    const handleClose = (): void => {
        setShowModal(false)
    }

    return (
        <>
            <DropdownMenuItem
                onSelect={(e): void => e.preventDefault()}
                onClick={handleClick}
            >
                <RotateCcw className="mr-2 h-4 w-4" />
                Restore stock settings
            </DropdownMenuItem>

            <Modal
                size="lg"
                opened={showModal}
                onClose={handleClose}
                onOk={handleOk}
                success="Restore stock settings"
                close="Cancel"
                title="Restore stock settings"
                description="Settings reset will remove any customizations previously made in Remappr and restore the stock keymap. Continue?"
                showFooter={true}
                xButton={true}
                type="text"
            />
        </>
    )
}
