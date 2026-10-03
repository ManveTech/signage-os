import LicenseBillingView from './LicenseBillingView';

interface Props {
  activeTab?: string;
  userEmail?: string;
  onNavigate?: (view: string) => void;
}

export default function Licenses({ userEmail = '', onNavigate }: Props) {
  return <LicenseBillingView userEmail={userEmail} onNavigate={onNavigate} />;
}
