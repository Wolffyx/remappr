import NOTICE from '../../../../../NOTICE?raw'
import { Modal } from '@/ui/modal'

export function LicenseNoticeModal(): JSX.Element {
    return (
        <>
            <Modal size="lg" kind="readonly" type="text" text=" License">
                <div className="overflow-auto max-h-full">
                    <p className="mr-2">
                        Remappr is released under the open source Apache 2.0
                        license. A copy of the NOTICE file from the Remappr
                        repository is included here:
                    </p>
                    <pre className="m-4 font-mono text-xs">{NOTICE}</pre>
                </div>
            </Modal>
        </>
    )
}
