// pattern-check: skip — a settings section of small components bound to
// githubStore.
//
// Settings → Integrations: Connect GitHub (plan §6c A2, P10e). The Remappr
// GitHub App is the normal way (the user picks which repositories it may
// use); a personal access token is the advanced fallback. Needs no Remappr
// account.
import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/ui/collapsible'
import { githubAppConfig, installUrl } from '@/lib/github/appAuth'
import { isElectron } from '@/transport'
import useGithubStore from '@/stores/githubStore'

function ConnectedRow(): JSX.Element {
    const { account, via, disconnect } = useGithubStore()
    const config = githubAppConfig()
    return (
        <div className="flex flex-wrap items-center gap-3">
            {account?.avatarUrl && (
                <img
                    src={account.avatarUrl}
                    alt=""
                    className="size-8 rounded-full"
                />
            )}
            <div className="min-w-0 flex-1 text-sm">
                Connected as{' '}
                <span className="font-semibold">@{account?.login}</span>
                <span className="block text-xs text-muted-foreground">
                    {via === 'app'
                        ? 'Through the Remappr GitHub App'
                        : 'With a personal access token'}
                </span>
            </div>
            {via === 'app' && config && (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(installUrl(config), '_blank')}
                >
                    Choose repositories
                </Button>
            )}
            <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                    void disconnect().then(() =>
                        toast.success('GitHub disconnected'),
                    )
                }
            >
                Disconnect
            </Button>
        </div>
    )
}

function PasteCode(): JSX.Element {
    const pasteCode = useGithubStore((s) => s.pasteCode)
    const [text, setText] = useState('')
    return (
        <form
            className="flex gap-2"
            onSubmit={(e) => {
                e.preventDefault()
                void pasteCode(text)
            }}
        >
            <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste the code from the browser"
                aria-label="GitHub code"
            />
            <Button type="submit" variant="outline" disabled={!text.trim()}>
                Use code
            </Button>
        </form>
    )
}

function ConnectRow(): JSX.Element {
    const { status, connect, cancel } = useGithubStore()
    if (!githubAppConfig())
        return (
            <p className="text-sm text-muted-foreground">
                This build has no GitHub App; use a personal access token below.
            </p>
        )
    if (status !== 'connecting')
        return <Button onClick={() => void connect()}>Connect GitHub</Button>
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
                Waiting for GitHub in your browser…
                <Button variant="ghost" size="sm" onClick={cancel}>
                    Cancel
                </Button>
            </div>
            {isElectron() && <PasteCode />}
        </div>
    )
}

function PersonalToken(): JSX.Element {
    const saveToken = useGithubStore((s) => s.saveToken)
    const [token, setToken] = useState('')
    return (
        <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                <ChevronDown className="size-3" />
                Advanced: personal access token
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
                <p className="text-xs text-muted-foreground">
                    For setups the GitHub App cannot reach. A classic token
                    needs the <code>repo</code> and <code>workflow</code>{' '}
                    scopes; a fine-grained one needs Contents and Workflows
                    (read and write) and Actions (read) on your repositories. It
                    is kept on this device only.
                </p>
                <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                        e.preventDefault()
                        void saveToken(token).then(() => setToken(''))
                    }}
                >
                    <Label htmlFor="github-pat" className="sr-only">
                        Personal access token
                    </Label>
                    <Input
                        id="github-pat"
                        type="password"
                        autoComplete="off"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="github_pat_… or ghp_…"
                    />
                    <Button
                        type="submit"
                        variant="outline"
                        disabled={!token.trim()}
                    >
                        Save token
                    </Button>
                </form>
            </CollapsibleContent>
        </Collapsible>
    )
}

export function IntegrationsSection(): JSX.Element {
    const { status, error, init } = useGithubStore()
    useEffect(() => {
        void init()
    }, [init])
    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold">Integrations</h3>
            <section className="space-y-3 rounded-xl border border-border p-4">
                <div>
                    <h4 className="text-panel-title font-semibold">GitHub</h4>
                    <p className="text-xs text-muted-foreground">
                        Keep library items in your own GitHub repositories and
                        build firmware there. No Remappr account needed.
                    </p>
                </div>
                {status === 'loading' ? null : status === 'connected' ? (
                    <ConnectedRow />
                ) : (
                    <ConnectRow />
                )}
                {error && (
                    <p className="text-xs text-[var(--danger)]">{error}</p>
                )}
                {status !== 'connected' && <PersonalToken />}
            </section>
        </div>
    )
}
