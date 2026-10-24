import { EnrollmentsPage } from "../../../../src/enrollment/enrollments-page";
export default async function Page({ params }: { params: Promise<{ orgSlug: string }> }) {
  return <EnrollmentsPage orgSlug={(await params).orgSlug} />;
}
