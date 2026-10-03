import VideoCallsView from '../../../components/calls/VideoCallsView';

export default function VideoConferencing({ userEmail = '' }: { userEmail?: string }) {
  // Admins aren't tied to one organization; the call record just needs a value.
  const organizationId = localStorage.getItem('signageos_org_id') || 'platform';
  return <VideoCallsView isAdmin organizationId={organizationId} userEmail={userEmail} />;
}
