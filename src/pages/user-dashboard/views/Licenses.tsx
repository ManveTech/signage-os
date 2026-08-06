import LicenseBillingView from './LicenseBillingView';

interface Props {
  activeTab?: string;
  userEmail?: string;
}

export default function Licenses({ userEmail = 'priya@demo.com' }: Props) {
  return <LicenseBillingView userEmail={userEmail} />;
}
