const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
function load(file, imports = {}) {
  const compiled = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  vm.runInNewContext(code, {
    exports: compiled.exports,
    module: compiled,
    require: (name) => imports[name] || require(name),
    Date,
    Set,
    Map,
  });
  return compiled.exports;
}
const { filterMapStudents, clusterMapPoints } = load("src/lib/student-map.ts");
const future = new Date(Date.now() + 86400000).toISOString();
const students = [
  {
    id: "a",
    name: "Alpha",
    address: "Toronto",
    assignedInstructorIds: ["one"],
  },
  { id: "b", name: "Beta", address: "Ottawa", assignedInstructorIds: ["two"] },
];
const data = {
  students,
  events: [{ id: "e", studentId: "a", start: future, instructorId: "one" }],
  instructors: [],
};
test("current includes unscheduled students; upcoming requires future appointments", () => {
  assert.equal(filterMapStudents(data, "", "current", "", "").length, 2);
  assert.equal(filterMapStudents(data, "", "upcoming", "", "")[0].id, "a");
  assert.equal(filterMapStudents(data, "Ottawa", "current", "", "")[0].id, "b");
  assert.equal(filterMapStudents(data, "", "current", "", "two")[0].id, "b");
  assert.equal(
    filterMapStudents(data, "", "current", "2000-01-01", "").length,
    0,
  );
});
test("clusters preserve every student at overlapping coordinates", () => {
  const points = [
    { id: "a", lat: 43.65, lng: -79.38 },
    { id: "b", lat: 43.65, lng: -79.38 },
    { id: "c", lat: 45.4, lng: -75.7 },
  ];
  const clusters = clusterMapPoints(points, 16);
  assert.equal(clusters.length, 2);
  assert.equal(clusters.flat().length, 3);
  assert.equal(clusters[0].length, 2);
});

class SecurityError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}
function endpoint({
  role = "schoolInstructor",
  memberStatus = "active",
  tenantStatus = "active",
  authenticated = true,
} = {}) {
  let queries = 0;
  const studentRecords = [
    {
      id: "mine",
      name: "Mine",
      address: "Toronto",
      status: "active",
      assignedInstructorIds: ["actor"],
      licenseNumber: "NEVER_RETURN",
    },
    { id: "legacy", name: "Legacy", status: "booked", instructorId: "actor" },
    {
      id: "other",
      name: "Other",
      status: "active",
      assignedInstructorIds: ["someone-else"],
    },
    {
      id: "inactive",
      name: "Inactive",
      status: "deactivated",
      assignedInstructorIds: ["actor"],
    },
    {
      id: "merged",
      name: "Merged",
      status: "active",
      mergedIntoStudentId: "mine",
      assignedInstructorIds: ["actor"],
    },
  ];
  const records = {
    students: studentRecords,
    members: [{ id: "actor", status: "active", displayName: "Instructor" }],
    events: [
      { id: "ok", studentId: "mine", start: future },
      { id: "other-event", studentId: "other", start: future },
      {
        id: "cancelled",
        studentId: "mine",
        start: future,
        lessonStatus: "cancelled",
      },
      {
        id: "no-show",
        studentId: "mine",
        start: future,
        lessonStatus: "no-show",
      },
    ],
  };
  const snapshot = (item) => ({ id: item.id, data: () => item });
  function collection(name, filters = []) {
    return {
      doc: () => ({
        get: async () => ({ data: () => ({ role, status: memberStatus }) }),
      }),
      where: (...filter) => collection(name, [...filters, filter]),
      select: () => collection(name, filters),
      get: async () => {
        queries++;
        return {
          docs: records[name]
            .filter((record) =>
              filters.every(([field, op, value]) =>
                op === "array-contains"
                  ? record[field]?.includes(value)
                  : op === ">="
                    ? record[field] >= value
                    : record[field] === value,
              ),
            )
            .map(snapshot),
        };
      },
    };
  }
  const route = load("src/app/api/students/map/route.ts", {
    "next/server": {
      NextResponse: {
        json: (data, options) => ({ data, status: options?.status || 200 }),
      },
    },
    "@/lib/server/firebase-admin": {
      getAdminFirestore: () => ({
        collection: () => ({
          doc: () => ({
            get: async () => ({ data: () => ({ status: tenantStatus }) }),
            collection,
          }),
        }),
      }),
    },
    "@/lib/server/request-security": {
      RequestSecurityError: SecurityError,
      requireRateLimitedUser: async () => {
        if (!authenticated) throw new SecurityError("Unauthenticated", 401);
        return { uid: "actor" };
      },
      requestSecurityErrorResponse: (error) => ({
        status: error.status || 500,
      }),
    },
  });
  return {
    call: () => route.POST({ json: async () => ({ tenantId: "workspace" }) }),
    queries: () => queries,
  };
}
test("instructor scope excludes unassigned, inactive, merged and cancelled records", async () => {
  const result = await endpoint().call();
  assert.equal(result.status, 200);
  assert.equal(
    result.data.students
      .map((s) => s.id)
      .sort()
      .join(","),
    "legacy,mine",
  );
  assert.equal(result.data.events.map((e) => e.id).join(","), "ok");
  assert.equal(JSON.stringify(result.data).includes("NEVER_RETURN"), false);
});
test("admin can see current students across instructors within the tenant", async () => {
  const result = await endpoint({ role: "schoolAdmin" }).call();
  assert.equal(result.data.students.length, 3);
});
test("authentication and membership fail closed before student reads", async () => {
  for (const options of [
    { authenticated: false },
    { memberStatus: "disabled" },
    { tenantStatus: "suspended" },
    { role: "student" },
  ]) {
    const api = endpoint(options);
    assert.ok([401, 403].includes((await api.call()).status));
    assert.equal(api.queries(), 0);
  }
});
