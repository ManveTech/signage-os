import PlaylistsView from '../../../../components/playlists/PlaylistsView';

interface Props {
  onNavigate: (v: string) => void;
  userEmail: string;
}

export default function AllPlaylists({ onNavigate, userEmail }: Props) {
  return (
    <PlaylistsView
      userEmail={userEmail}
      title="Playlists"
      subtitle="What your screens play — tap one to see its slides and where it plays"
      createView="playlists-create"
      onNavigate={onNavigate}
    />
  );
}
