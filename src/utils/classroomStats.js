export function countClassroomStatuses(classrooms = []) {
  return classrooms.reduce((counts, classroom) => {
    if (classroom?.status === "active") counts.active++;
    else counts.inactive++;
    return counts;
  }, { active: 0, inactive: 0 });
}
