import { ensureFreshAnonymousUser, isInvalidAuthTokenError, renewAnonymousUser } from "../firebase/auth.js";
import { createClassroom } from "../firebase/classroomRepository.js";
import { reconnectDatabase } from "../firebase/connection.js";

export async function createClassroomFlow(values, dependencies = {}) {
  const ensureFresh = dependencies.ensureFresh || ensureFreshAnonymousUser;
  const renew = dependencies.renew || renewAnonymousUser;
  const reconnect = dependencies.reconnect || reconnectDatabase;
  const create = dependencies.create || createClassroom;
  const invalidToken = dependencies.invalidToken || isInvalidAuthTokenError;
  let user = await ensureFresh();
  try {
    return { id: await create(user.uid, values), user };
  } catch (error) {
    if (!invalidToken(error)) throw error;
    user = await renew();
    reconnect();
    return { id: await create(user.uid, values), user };
  }
}
