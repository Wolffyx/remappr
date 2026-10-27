// Must stay the first import: it configures zod before any schema is used.
import './zodConfig'
import { takeStorageMigration } from '@/lib/storageMigration'

// Stores read localStorage when their modules load, so the one-time hand-over
// of the old desktop storage must land before the app is imported.
void takeStorageMigration().finally(() => import('./boot'))
