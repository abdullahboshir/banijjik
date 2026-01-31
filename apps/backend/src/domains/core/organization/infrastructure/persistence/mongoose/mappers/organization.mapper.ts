import { Organization } from "../../../../domain/entities/organization.entity";
import { IOrganizationDocument } from "../models/organization.model";

export class OrganizationMapper {
  public static toDomain(raw: IOrganizationDocument): Organization {
    return new Organization({
      _id: raw._id.toString(),
      id: raw.id,
      name: raw.name,
      slug: raw.slug,
      industry: raw.industry,
      legalType: raw.legalType,
      nature: raw.nature,
      status: raw.status,
      email: raw.email,
      phone: raw.phone,
      supportPhone: raw.supportPhone,
      website: raw.website,
      address: raw.address,
      establishedDate: raw.establishedDate,
      localization: raw.localization,
      deployment: raw.deployment,
      metadata: raw.metadata,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }

  public static toPersistence(organization: Organization): any {
    const json = organization.toJSON();
    return {
      _id: json._id,
      id: json.id,
      name: json.name,
      slug: json.slug,
      industry: json.industry,
      legalType: json.legalType,
      nature: json.nature,
      status: json.status,
      email: json.email,
      phone: json.phone,
      supportPhone: json.supportPhone,
      website: json.website,
      address: json.address,
      establishedDate: json.establishedDate,
      localization: json.localization,
      deployment: json.deployment,
      metadata: json.metadata,
    };
  }
}
