export type FileCategory = 
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'document'
  | 'archive'
  | 'text'
  | 'other';

export interface FileMetadata {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: number;
  expiresAt: number | null; // null means never
  downloadLimit: number | null; // null means unlimited
  downloadCount: number;
  requireConfirmation: boolean;
  isExpired: boolean;
  isDeleted: boolean;
  category: FileCategory;
  ownerToken?: string;
}

export type ExpirationOption = 'never' | '10m' | '1h' | '24h' | '7d' | '30d';
export type DownloadLimitOption = 'unlimited' | 1 | 5 | 10 | 25 | 50;

export interface ShareSettings {
  expiration: ExpirationOption;
  downloadLimit: DownloadLimitOption;
  requireConfirmation: boolean;
}

export interface UserHistoryItem {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: number;
  ownerToken: string;
  category: FileCategory;
}
