import { DEMO_URL } from '@/lib/demo-analysis';

export function DemoButton() {
  return (
    <button
      className="demo-trigger"
      type="button"
      title="Load a sample DeFi analysis"
      aria-label="Load sample DeFi analysis"
      onClick={() => window.location.assign(DEMO_URL)}
    >
      Dummy
    </button>
  );
}
