import StudentIntakePage from "@/app/student-intake/[token]/page";

export default function RegisterStudentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <StudentIntakePage
      params={params.then(({ slug }) => ({
        token: slug,
      }))}
    />
  );
}
