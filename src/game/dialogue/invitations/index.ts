import { DialogueTopic } from '../../types';
import { NORA_INVITATION_TOPICS } from './nora';
import { CLARA_INVITATION_TOPICS } from './clara';

export const INVITATION_TOPICS: readonly DialogueTopic[] = [
  ...NORA_INVITATION_TOPICS,
  ...CLARA_INVITATION_TOPICS,
];
