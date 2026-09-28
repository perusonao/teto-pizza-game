/**
 * Discovery Hint 4.0 (Issue #253), DH4-2B: the E3 flag (OD-DH4-2-5). 構成 / 特徴 requests are wired
 * and verifiable only in a DEV or Preview build (`VITE_PREVIEW_MODE`, which also gives Preview its
 * own save key). A production build leaves both unset, so the request is a no-op there and no
 * production price exists for these families (no 0-Pitz price either). DH4-ECON decides the real
 * prices and flips production.
 */
export const DEDUCTION_HINTS_ENABLED: boolean = !!import.meta.env.DEV || !!import.meta.env.VITE_PREVIEW_MODE;
