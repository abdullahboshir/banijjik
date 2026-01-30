import { IUserRepository } from '../repositories';

export class UniqueEmailPolicy {
  constructor(private readonly userRepository: IUserRepository) {}

  async isSatisfiedBy(email: string): Promise<boolean> {
    const user = await this.userRepository.findByEmail(email);
    return !user;
  }
}
