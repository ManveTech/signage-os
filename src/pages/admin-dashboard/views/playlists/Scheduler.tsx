import SchedulerView from '../../../../components/playlists/SchedulerView';

export default function Scheduler({ userEmail = '', isAdmin = false }: { userEmail?: string; isAdmin?: boolean }) {
  return <SchedulerView userEmail={userEmail} isAdmin={isAdmin} />;
}
