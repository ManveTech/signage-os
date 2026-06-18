export type NavItem = {
  id: string;
  label: string;
  icon: string;
  children?: NavItem[];
};

export type Screen = {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'warning' | 'active' | 'suspended' | 'pairing';
  playlist: string;
  playlistId?: string;
  location: string;
  licenseType: string;
  lastHeartbeat: string;
  playerVersion: string;
  storageUsed: number;
  thumbnail: string;
  groupId?: string;
  schedulePlaylist?: string;
  scheduleDate?: string;
  scheduleTime?: string;
  clear_cache?: boolean;
  assignedToUserEmail?: string;
  volume?: number;
  onlineSince?: string;
  force_sync?: boolean;
};

export type ScreenGroup = {
  id: string;
  name: string;
  desc: string;
  color: string;
  playlist: string;
  library?: string;
  libraryAssignedDate?: string;
  libraryAssignedTime?: string;
  orgId?: string;
  schedulePlaylist?: string;
  scheduleDate?: string;
  scheduleTime?: string;
  scheduleLibrary?: string;
  volume?: number;
  clear_cache?: boolean;
  force_sync?: boolean;
};

export type MediaItem = {
  id: string;
  title: string;
  type: 'image' | 'layout' | 'ticker';
  duration: number;
  resolution: string;
  fileSize: string;
  fileSizeBytes: number;
  uploadedBy: string;
  createdDate: string;
  expiryDate: string;
  tags: string[];
  status: 'active' | 'archived' | 'expired';
  thumbnail: string;
  width?: number;
  height?: number;
  mimeType?: string;
  fileData?: string;
  fileName?: string;
};

export type Playlist = {
  id: string;
  name: string;
  mediaCount: number;
  assignedScreens: number;
  active: boolean;
  scheduleStatus: string;
  createdDate: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  mobile: string;
  company: string;
  role: 'super_admin' | 'org_admin' | 'content_manager' | 'viewer';
  status: 'active' | 'inactive';
  licenseCount: number;
  screensAssigned: number;
  lastLogin: string;
  twoFAEnabled: boolean;
  address?: string;
};

export type License = {
  id: string;
  type: 'lite' | 'pro';
  expiryDate: string;
  status: 'active' | 'expired' | 'revoked';
  featuresEnabled: string[];
  assignedTo?: string;
  orgId?: string;
};

export type Organization = {
  id: string;
  name: string;
  adminName: string;
  email: string;
  planType: string;
  screensAllowed: number;
  storageLimit: number;
  subscriptionStatus: 'active' | 'suspended' | 'expired';
  renewalDate: string;
};

export type Ticket = {
  id: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  createdDate: string;
  lastUpdated: string;
};
