export interface SnapshotRefreshVerificationOptions {
  sourcePath?: string;
  snapshotPath?: string;
  refreshStartedAt?: string;
}

export interface SnapshotRefreshVerification {
  collectors: Record<string, number>;
  missingRequired: string[];
  missingOptional: string[];
  integrity: string;
  offers: number;
  observations: number;
  fresh: number;
  unsafe: number;
}

export function verifySnapshotRefresh(options?: SnapshotRefreshVerificationOptions): SnapshotRefreshVerification;
