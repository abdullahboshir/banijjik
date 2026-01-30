export class LoginHistory {
  private constructor(
    private readonly timestamp: Date,
    private readonly ip: string,
    private readonly userAgent: string,
  ) {}

  static create(props: {
    timestamp: Date;
    ip: string;
    userAgent: string;
  }): LoginHistory {
    return new LoginHistory(props.timestamp, props.ip, props.userAgent);
  }

  toObject() {
    return {
      timestamp: this.timestamp,
      ip: this.ip,
      userAgent: this.userAgent,
    };
  }
}
