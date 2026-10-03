import LogsView from '../../../../components/logs/LogsView';

interface Props {
  userEmail?: string;
  mode?: 'my' | 'all';
  onNavigate?: (view: string) => void;
}

export default function Logs({ userEmail = 'priya@demo.com', mode = 'my', onNavigate }: Props) {
  return <LogsView userEmail={userEmail} mode={mode} role="user" onNavigate={onNavigate} />;
}
