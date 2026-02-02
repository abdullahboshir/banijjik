export class DomainEvent {
    constructor() {
        this.occurredOn = new Date();
    }
}
export class UserRegisteredEvent extends DomainEvent {
    constructor(userId, email, organizationId) {
        super();
        this.userId = userId;
        this.email = email;
        this.organizationId = organizationId;
    }
}
export class UserLoggedInEvent extends DomainEvent {
    constructor(userId, email, timestamp) {
        super();
        this.userId = userId;
        this.email = email;
        this.timestamp = timestamp;
    }
}
//# sourceMappingURL=identity.events.js.map