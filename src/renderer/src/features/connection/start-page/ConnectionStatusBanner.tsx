import { AlertCircle } from 'lucide-react'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/ui/card'
import { ExternalLink } from '@/components/ExternalLink'

export function ConnectionStatusBanner(): JSX.Element {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <Card className="w-full max-w-lg">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                        <AlertCircle className="h-8 w-8 text-destructive" />
                    </div>
                    <CardTitle>
                        This browser can’t connect to keyboards
                    </CardTitle>
                    <CardDescription>
                        Your browser doesn&apos;t support the required features.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Remappr uses either{' '}
                        <ExternalLink href="https://caniuse.com/web-serial">
                            Web Serial
                        </ExternalLink>{' '}
                        or{' '}
                        <ExternalLink href="https://caniuse.com/web-bluetooth">
                            Web Bluetooth
                        </ExternalLink>{' '}
                        (Linux only) to connect to keyboard devices.
                    </p>
                    <div className="text-sm">
                        <p className="font-medium mb-2">To use Remappr:</p>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                            <li>Use a supported browser like Chrome or Edge</li>
                            <li>
                                Or download our{' '}
                                <ExternalLink href="/download">
                                    desktop application
                                </ExternalLink>
                            </li>
                        </ul>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
