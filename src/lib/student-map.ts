export type MapStudent = {
  id: string;
  name: string;
  address: string;
  mobileNumber: string;
  status: string;
  assignedInstructorIds: string[];
};
export type MapEvent = {
  id: string;
  studentId: string;
  start: string;
  instructorId: string;
};
export type MapData = {
  students: MapStudent[];
  events: MapEvent[];
  instructors: { id: string; name: string }[];
};
export type MapLocation = { lat: number; lng: number };

export function filterMapStudents(
  data: MapData,
  search: string,
  mode: string,
  date: string,
  instructor: string,
) {
  const query = search.trim().toLowerCase();
  const events = data.events
    .filter((event) => {
      const start = new Date(event.start);
      const localDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
      return (
        start.getTime() >= Date.now() &&
        (!date || localDate === date) &&
        (!instructor || event.instructorId === instructor)
      );
    })
    .sort((a, b) => a.start.localeCompare(b.start));
  return data.students
    .filter(
      (student) =>
        (!query ||
          `${student.name} ${student.address}`.toLowerCase().includes(query)) &&
        (!instructor ||
          student.assignedInstructorIds.includes(instructor) ||
          events.some((event) => event.studentId === student.id)) &&
        (!(mode === "upcoming" || date) ||
          events.some((event) => event.studentId === student.id)),
    )
    .map((student) => ({
      ...student,
      nextEvent: events.find((event) => event.studentId === student.id),
    }));
}

// Group pins by screen-sized geographic cells; identical addresses remain selectable in a list.
export function clusterMapPoints<T extends MapLocation>(
  points: T[],
  zoom: number,
): T[][] {
  const cells = new Map<string, T[]>();
  const size = 60 / (256 * 2 ** zoom);
  for (const point of points) {
    const sin = Math.sin((point.lat * Math.PI) / 180);
    const x = (point.lng + 180) / 360;
    const y = 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
    const key = `${Math.floor(x / size)}:${Math.floor(y / size)}`;
    cells.set(key, [...(cells.get(key) || []), point]);
  }
  return [...cells.values()];
}
