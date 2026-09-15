import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/server/firebase-admin";
import {
  requireRateLimitedUser,
  RequestSecurityError,
  requestSecurityErrorResponse,
} from "@/lib/server/request-security";

export const runtime = "nodejs";
const fields = [
  "name",
  "address",
  "pickupAddress",
  "mobileNumber",
  "status",
  "assignedInstructorIds",
  "instructorId",
  "mergedIntoStudentId",
];

export async function POST(request: NextRequest) {
  try {
    const actor = await requireRateLimitedUser(request, "student-map", 60);
    const body = await request.json();
    if (
      typeof body.tenantId !== "string" ||
      !body.tenantId ||
      body.tenantId.includes("/")
    )
      throw new RequestSecurityError("Workspace is required.", 400);
    const tenant = getAdminFirestore().collection("tenants").doc(body.tenantId);
    const [tenantDoc, memberDoc] = await Promise.all([
      tenant.get(),
      tenant.collection("members").doc(actor.uid).get(),
    ]);
    const member = memberDoc.data();
    if (
      tenantDoc.data()?.status !== "active" ||
      member?.status !== "active" ||
      !["schoolAdmin", "soloInstructor", "schoolInstructor"].includes(
        member.role,
      )
    ) {
      throw new RequestSecurityError(
        "You do not have access to this workspace.",
        403,
      );
    }
    const studentsRef = tenant.collection("students");
    const snapshots =
      member.role === "schoolInstructor"
        ? await Promise.all([
            studentsRef
              .where("assignedInstructorIds", "array-contains", actor.uid)
              .select(...fields)
              .get(),
            studentsRef
              .where("instructorId", "==", actor.uid)
              .select(...fields)
              .get(),
          ])
        : [await studentsRef.select(...fields).get()];
    const students = Array.from(
      new Map(
        snapshots
          .flatMap((snapshot) => snapshot.docs)
          .map((doc) => [
            doc.id,
            { ...doc.data(), id: doc.id } as Record<string, any>,
          ]),
      ).values(),
    )
      .filter(
        (s) =>
          ["active", "booked"].includes(s.status) && !s.mergedIntoStudentId,
      )
      .map((s) => ({
        id: s.id as string,
        name: String(s.name || "Student"),
        address: String(
          s.address ||
            [
              s.pickupAddress?.street,
              s.pickupAddress?.city,
              s.pickupAddress?.province,
              s.pickupAddress?.postalCode,
            ]
              .filter(Boolean)
              .join(", "),
        ),
        mobileNumber: String(s.mobileNumber || ""),
        status: String(s.status),
        assignedInstructorIds: [
          ...new Set<string>([
            ...(Array.isArray(s.assignedInstructorIds)
              ? s.assignedInstructorIds
              : []),
            ...(s.instructorId ? [s.instructorId] : []),
          ]),
        ],
      }));
    const ids = new Set(students.map((s) => s.id));
    const [eventsDoc, membersDoc] = await Promise.all([
      tenant
        .collection("events")
        .where("start", ">=", new Date().toISOString())
        .select("studentId", "start", "instructorId", "lessonStatus")
        .get(),
      member.role === "schoolInstructor"
        ? null
        : tenant
            .collection("members")
            .where("status", "==", "active")
            .select("displayName", "email")
            .get(),
    ]);
    const events = eventsDoc.docs
      .map((doc) => ({ ...doc.data(), id: doc.id }) as Record<string, any>)
      .filter(
        (e) =>
          ids.has(e.studentId) &&
          e.lessonStatus !== "cancelled" &&
          e.lessonStatus !== "no-show",
      )
      .map((e) => ({
        id: String(e.id),
        studentId: String(e.studentId),
        start: String(e.start),
        instructorId: typeof e.instructorId === "string" ? e.instructorId : "",
      }));
    const instructors = membersDoc
      ? membersDoc.docs.map((doc) => ({
          id: doc.id,
          name: String(
            doc.data().displayName || doc.data().email || "Instructor",
          ),
        }))
      : [{ id: actor.uid, name: String(member.displayName || "My students") }];
    return NextResponse.json(
      { students, events, instructors },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return requestSecurityErrorResponse(
      error,
      "Could not load the student map. Please try again.",
    );
  }
}
