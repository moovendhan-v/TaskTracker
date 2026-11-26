import { pickElement } from '@taskflow/bug-capture';

/** Runs in the page: lets the reporter click the broken element; the result is read back by the extension. */
const holder = window as unknown as { __taskflowPick?: ReturnType<typeof pickElement> };
holder.__taskflowPick = pickElement();
