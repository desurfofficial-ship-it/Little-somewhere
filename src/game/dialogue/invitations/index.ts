import { DialogueTopic } from '../../types';
import { NORA_INVITATION_TOPICS } from './nora';
import { CLARA_INVITATION_TOPICS } from './clara';
import { ARTHUR_INVITATION_TOPICS } from './arthur';

export const INVITATION_TOPICS: readonly DialogueTopic[] = [
  ...NORA_INVITATION_TOPICS,
  ...CLARA_INVITATION_TOPICS,
  ...ARTHUR_INVITATION_TOPICS,
];
