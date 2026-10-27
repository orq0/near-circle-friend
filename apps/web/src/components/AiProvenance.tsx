import type { AdviceSource, ClosenessDisplaySource } from '../types';

export function closenessSourceLabel(source: ClosenessDisplaySource): string {
  switch (source) {
    case 'user_choice':
      return 'Your choice';
    case 'ai_estimate':
      return 'AI estimate';
    case 'demo_profile':
      return 'Demo profile';
    case 'none':
      return 'No estimate';
  }
}

export function adviceSourceLabel(source: AdviceSource): string {
  switch (source) {
    case 'meta_live':
      return 'Live AI suggestion';
    case 'meta_cached':
      return 'Recent AI suggestion';
    case 'demo_fixture':
      return 'Demo suggestion';
    case 'unavailable':
      return 'AI unavailable';
  }
}

export function ModelDisclosure(): React.ReactElement {
  return (
    <p className="ai-disclosure">
      Prototype powered by Muse Spark 1.3 via Meta Model API; proposed production
      integration would use native Meta AI subject to Meta&apos;s first-party approval
      and support.
    </p>
  );
}
