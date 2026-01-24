/**
 * MemberProfile Entity
 * Platinum Standard: Contextual role of a person within a specific business.
 */

import { ProfileType } from '../value-objects';

export interface IMemberProfileProps {
  id?: string;
  personId: string;
  organizationId: string;
  type: ProfileType;
  metadata: Record<string, any>; // Dynamic business-specific data
  status: 'active' | 'inactive' | 'suspended';
  joinedAt: Date;
}

export class MemberProfile {
  private props: IMemberProfileProps;

  constructor(props: IMemberProfileProps) {
    this.props = {
      ...props,
      metadata: props.metadata || {},
      status: props.status || 'active',
      joinedAt: props.joinedAt || new Date(),
    };
  }

  public get id(): string | undefined { return this.props.id; }
  public get personId(): string { return this.props.personId; }
  public get organizationId(): string { return this.props.organizationId; }
  public get type(): ProfileType { return this.props.type; }
  public get metadata(): Record<string, any> { return this.props.metadata; }
  public get status(): 'active' | 'inactive' | 'suspended' { return this.props.status; }
  public get joinedAt(): Date { return this.props.joinedAt; }

  /**
   * Update metadata dynamically
   */
  public updateMetadata(key: string, value: any): void {
    this.props.metadata[key] = value;
  }

  public toPrimitives() {
    return {
      id: this.props.id,
      personId: this.props.personId,
      organizationId: this.props.organizationId,
      type: this.props.type,
      metadata: this.props.metadata,
      status: this.props.status,
      joinedAt: this.props.joinedAt,
    };
  }
}
