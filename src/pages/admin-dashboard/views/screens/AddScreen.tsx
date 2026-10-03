import AddScreenFlow from '../../../../components/screens/AddScreenFlow';

export default function AddScreen({ mode = 'client', onNavigate, userEmail = 'admin@demo.com' }: { mode?: 'client' | 'my'; onNavigate?: (view: string) => void; userEmail?: string }) {
  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto">
      <div className="mb-5">
        <h1 className="display text-2xl sm:text-3xl text-ink-950">Add screen</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {mode === 'my' ? 'Add a display to your own channel' : 'Add a display for one of your clients'}
        </p>
      </div>
      <AddScreenFlow
        mode={mode === 'my' ? 'admin-my' : 'admin-client'}
        userEmail={userEmail}
        onDone={() => onNavigate?.(mode === 'my' ? 'my-screens-list' : 'screens-all')}
        onSwitchToMine={mode === 'my' ? undefined : () => onNavigate?.('screens-add-my')}
      />
    </div>
  );
}
