// pattern-check: skip — one config helper shared by both Vite configs.
//
// A build whose builder folder is the generated stub (REMAPPR_BUILDER=package,
// see scripts/link-remappr.cjs) must load the delivered builder package. Tell
// the app at build time, so deciding the source never loads the builder chunk.
import fs from 'node:fs'
import path from 'node:path'

export function builderSourceDefine(appRoot: string): Record<string, string> {
    const stub = path.join(
        appRoot,
        'src/renderer/src/features/builder/index.tsx',
    )
    const isStub =
        fs.existsSync(stub) &&
        fs.readFileSync(stub, 'utf8').includes('BUILDER_STUB')
    return isStub
        ? { 'import.meta.env.VITE_BUILDER_SOURCE': JSON.stringify('delivered') }
        : {}
}
