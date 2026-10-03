import ProfileView from '../../../components/profile/ProfileView';

export default function Profile({ userEmail = '', onNavigate }: { userEmail?: string; onNavigate?: (view: string) => void } = {}) {
  return <ProfileView role="admin" userEmail={userEmail} onNavigate={onNavigate} />;
}
