import { isClassroomExpired } from "./classroomExpiration.js";

export function isActiveClassroom(classroom) {
  return classroom?.status === "active" && !isClassroomExpired(classroom);
}

export function countActiveClassrooms(classrooms = []) {
  return classrooms.filter(isActiveClassroom).length;
}
