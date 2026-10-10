export function check(flags: {
  first: boolean;
  second: boolean;
  third: boolean;
  fourth: boolean;
}): number {
  if (flags.first) {
    if (flags.second) {
      if (flags.third) {
        if (flags.fourth) {
          return 1;
        }
      }
    }
  }
  return 0;
}
