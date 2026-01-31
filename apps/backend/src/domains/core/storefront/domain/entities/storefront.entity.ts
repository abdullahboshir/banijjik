import {
  StorefrontStatusType,
  IStorefrontSection,
  IStorefrontTheme,
  IStorefrontSEO,
  IStorefrontHero,
  IStorefrontAbout,
  IStorefrontSocialMedia,
  IStorefrontPolicies,
  STOREFRONT_STATUS,
  OrganizationIndustryType,
} from "@banijjik/contracts";

export interface StorefrontProps {
  _id?: string;
  id?: string;
  organizationId: string;
  slug: string;
  industry: OrganizationIndustryType;
  status: StorefrontStatusType;
  theme: IStorefrontTheme;
  seo: IStorefrontSEO;
  hero?: IStorefrontHero;
  about?: IStorefrontAbout;
  socialMedia?: IStorefrontSocialMedia;
  policies?: IStorefrontPolicies;
  sections: IStorefrontSection[];
  customCss?: string;
  publishedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Storefront {
  private props: StorefrontProps;

  constructor(props: StorefrontProps) {
    this.props = {
      ...props,
      id: props.id ?? crypto.randomUUID(),
      status: props.status ?? STOREFRONT_STATUS.DRAFT,
      sections: props.sections ?? [],
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };
  }

  get _id(): string | undefined {
    return this.props._id;
  }

  get id(): string | undefined {
    return this.props.id;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }

  get slug(): string {
    return this.props.slug;
  }

  get industry(): OrganizationIndustryType {
    return this.props.industry;
  }

  get status(): StorefrontStatusType {
    return this.props.status;
  }

  get theme(): IStorefrontTheme {
    return this.props.theme;
  }

  get seo(): IStorefrontSEO {
    return this.props.seo;
  }

  get hero(): IStorefrontHero | undefined {
    return this.props.hero;
  }

  get about(): IStorefrontAbout | undefined {
    return this.props.about;
  }

  get socialMedia(): IStorefrontSocialMedia | undefined {
    return this.props.socialMedia;
  }

  get policies(): IStorefrontPolicies | undefined {
    return this.props.policies;
  }

  get sections(): IStorefrontSection[] {
    return [...this.props.sections].sort((a, b) => a.order - b.order);
  }

  get customCss(): string | undefined {
    return this.props.customCss;
  }

  get publishedAt(): Date | undefined {
    return this.props.publishedAt;
  }

  updateMetadata(slug?: string, status?: StorefrontStatusType) {
    if (slug) this.props.slug = slug;
    if (status) {
      if (
        status === STOREFRONT_STATUS.PUBLISHED &&
        this.props.status !== STOREFRONT_STATUS.PUBLISHED
      ) {
        this.props.publishedAt = new Date();
      }
      this.props.status = status;
    }
    this.touch();
  }

  updateBranding(theme?: Partial<IStorefrontTheme>, customCss?: string) {
    if (theme) this.props.theme = { ...this.props.theme, ...theme };
    if (customCss !== undefined) this.props.customCss = customCss;
    this.touch();
  }

  updateHero(hero: IStorefrontHero) {
    this.props.hero = hero;
    this.touch();
  }

  updateAbout(about: IStorefrontAbout) {
    this.props.about = about;
    this.touch();
  }

  updateSocialMedia(socialMedia: IStorefrontSocialMedia) {
    this.props.socialMedia = socialMedia;
    this.touch();
  }

  updatePolicies(policies: IStorefrontPolicies) {
    this.props.policies = policies;
    this.touch();
  }

  updateSEO(seo: Partial<IStorefrontSEO>) {
    this.props.seo = { ...this.props.seo, ...seo };
    this.touch();
  }

  updateSections(sections: IStorefrontSection[]) {
    this.props.sections = sections;
    this.touch();
  }

  private touch() {
    this.props.updatedAt = new Date();
  }

  toPrimitives() {
    return {
      ...this.props,
    };
  }
}
