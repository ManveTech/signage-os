import PlaylistsView from '../../../components/playlists/PlaylistsView';

interface Props {
  onNavigate?: (v: string) => void;
  userEmail?: string;
}

export default function ClientPlaylists({ onNavigate = () => {}, userEmail = 'admin@demo.com' }: Props) {
  return (
    <PlaylistsView
      scope="clients"
      userEmail={userEmail}
      title="Client Playlists"
      subtitle="Playlists your clients' screens play — tap one to see its slides and where it plays"
      createView="playlists-create"
      screensView="screens-all"
      groupsView="screens-groups-all"
      onNavigate={onNavigate}
      allowBulkDelete
    />
  );
}
