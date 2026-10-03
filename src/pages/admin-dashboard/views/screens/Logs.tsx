import LogsView from '../../../../components/logs/LogsView';

interface Props {
  userEmail?: string;
  mode?: 'my' | 'all';
  onNavigate?: (view: string) => void;
}

export default function Logs({ userEmail = 'admin@demo.com', mode = 'all', onNavigate }: Props) {
  return <LogsView userEmail={userEmail} mode={mode} role="admin" onNavigate={onNavigate} />;
}
