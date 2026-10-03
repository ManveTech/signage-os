import SettingsView from '../../../components/settings/SettingsView';

export default function Settings({ userEmail = '' }: { activeTab?: string; userEmail?: string }) {
  return <SettingsView userEmail={userEmail} isAdmin />;
}
