import { DialogueTopic } from '../../types';
import { NORA_INVITATION_TOPICS } from './nora';
import { CLARA_INVITATION_TOPICS } from './clara';
import { ARTHUR_INVITATION_TOPICS } from './arthur';

export const INVITATION_TOPICS: readonly DialogueTopic[] = [
  ...NORA_INVITATION_TOPICS,
  ...CLARA_INVITATION_TOPICS,
  // LR-5 (doc 24 §2.1 L5-S5): Arthur's quartet spreads after Clara's, keeping
  // the registry's fixed module order (nora → clara → arthur). Golden
  // snapshot regenerated 96 → 100; justification recorded in
  // scripts/dialogue-topics-golden-justification.md.
  ...ARTHUR_INVITATION_TOPICS,
];
