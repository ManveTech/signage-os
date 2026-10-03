import MediaLibraryView from '../../../../components/media/MediaLibraryView';

export default function MediaLibrary({ userEmail }: { userEmail: string; onNavigate?: (v: string) => void }) {
  return <MediaLibraryView userEmail={userEmail} />;
}
