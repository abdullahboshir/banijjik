import { Person, PersonRepository } from "../../domain";
import { CreatePersonDto } from "../dto/create-person.dto";
import crypto from "crypto";

export class CreatePersonUseCase {
  constructor(private readonly personRepository: PersonRepository) {}

  async execute(dto: CreatePersonDto): Promise<Person> {
    const person = Person.create({
      personId: crypto.randomUUID(),
      userId: dto.userId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      phone: dto.phone,
      gender: dto.gender,
      dateOfBirth: dto.dateOfBirth,
      designation: dto.designation,
      profileAttributes: dto.profileAttributes,
      status: undefined, // Let domain default handle it
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    if (dto.industry) {
      person.validateIndustryAttributes(dto.industry);
    }

    await this.personRepository.save(person);
    return person;
  }
}
