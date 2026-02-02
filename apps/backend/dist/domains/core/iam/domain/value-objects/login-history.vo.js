export class LoginHistory {
    constructor(timestamp, ip, userAgent) {
        this.timestamp = timestamp;
        this.ip = ip;
        this.userAgent = userAgent;
    }
    static create(props) {
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
//# sourceMappingURL=login-history.vo.js.map