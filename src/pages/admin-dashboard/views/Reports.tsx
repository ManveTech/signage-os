import ReportsView, { ReportsSection } from '../../../components/reports/ReportsView';

const SECTION_BY_TAB: Record<string, ReportsSection> = {
  'Overview': 'overview',
  'Screen Reports': 'screens',
  'Media Reports': 'media',
  'Device Logs': 'activity',
};

export default function Reports({ activeTab = 'Overview', userEmail = '', onNavigate }: { activeTab?: string; userEmail?: string; onNavigate?: (view: string) => void }) {
  return <ReportsView scope="all" userEmail={userEmail} initialSection={SECTION_BY_TAB[activeTab] || 'overview'} onNavigate={onNavigate} />;
}
