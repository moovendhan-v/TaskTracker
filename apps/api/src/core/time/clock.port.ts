/** Source of the current time. Inject this instead of calling `new Date()` in business logic. */
export abstract class Clock {
  abstract now(): Date;
}

export class SystemClock extends Clock {
  now(): Date {
    return new Date();
  }
}

/** Test double with a settable time. */
export class FixedClock extends Clock {
  constructor(private current: Date) {
    super();
  }

  now(): Date {
    return new Date(this.current);
  }

  set(date: Date): void {
    this.current = date;
  }
}
