import AddScreenFlow from '../../../../components/screens/AddScreenFlow';

interface AddScreenProps {
  userEmail?: string;
  onNavigate?: (view: string) => void;
}

export default function AddScreen({ userEmail = 'priya@demo.com', onNavigate }: AddScreenProps) {
  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto">
      <div className="mb-5">
        <h1 className="display text-2xl sm:text-3xl text-ink-950">Add screen</h1>
        <p className="text-sm text-gray-500 mt-0.5">Connect a new display to your account</p>
      </div>
      <AddScreenFlow mode="client" userEmail={userEmail} onDone={() => onNavigate?.('my-screens-list')} />
    </div>
  );
}
