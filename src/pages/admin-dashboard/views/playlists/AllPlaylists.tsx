import PlaylistsView from '../../../../components/playlists/PlaylistsView';

interface Props {
  onNavigate: (v: string) => void;
  userEmail?: string;
}

export default function AllPlaylists({ onNavigate, userEmail = 'admin@demo.com' }: Props) {
  return (
    <PlaylistsView
      userEmail={userEmail}
      title="My Channel Playlists"
      subtitle="Playlists for your own screens — tap one to see its slides and where it plays"
      createView="my-create-playlist"
      onNavigate={onNavigate}
      allowBulkDelete
    />
  );
}
