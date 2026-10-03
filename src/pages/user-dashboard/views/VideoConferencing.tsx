import VideoCallsView from '../../../components/calls/VideoCallsView';

export default function VideoConferencing({ enabled, organizationId, licenseChecked = true, userEmail = '' }: { enabled: boolean; organizationId: string; licenseChecked?: boolean; userEmail?: string }) {
  return <VideoCallsView enabled={enabled} organizationId={organizationId} licenseChecked={licenseChecked} userEmail={userEmail} />;
}
