export function getDefaultQaDuration(talkDuration: number): number {
  if (talkDuration >= 15) {
    return 5;
  }

  if (talkDuration <= 5) {
    return 2;
  }

  return 3;
}
