import React from 'react';

interface ScreenSubNavProps {
  activeTab?: string;
  onNavigate?: (view: string) => void;
  role?: string;
  logsMode?: string;
  onLogsModeChange?: (mode: 'my' | 'all') => void;
}

export default function ScreenSubNav(_props: ScreenSubNavProps) {
  return null;
}
