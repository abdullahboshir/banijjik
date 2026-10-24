import { EnrollmentDetailPage } from "../../../../../src/enrollment/enrollment-detail-page";
export default async function Page({
  params,
}: {
  params: Promise<{ orgSlug: string; enrollmentId: string }>;
}) {
  const value = await params;
  return <EnrollmentDetailPage orgSlug={value.orgSlug} enrollmentId={value.enrollmentId} />;
}
