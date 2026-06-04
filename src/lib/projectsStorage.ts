/*
  projectsStorage.ts — Firestore CRUD for the "projects" collection.

  All saved projects are stored in Firestore so every device that opens
  the app sees the same list. sourceThumb (base64 data URL) is stripped
  before writing — it is too large for a Firestore document and the
  Dashboard already renders a color-based fallback thumbnail.
*/

import type { Project } from "./types";

function stripUndefined(val: unknown): unknown {
  if (val === null || typeof val !== "object") return val;
  if (Array.isArray(val)) return val.map(stripUndefined);
  return Object.fromEntries(
    Object.entries(val as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, stripUndefined(v)])
  );
}

type UnsubFn = () => void;

/**
 * Subscribe to all projects ordered by updatedAt desc.
 * Calls onUpdate immediately with the cached snapshot, then on every change.
 * Returns an unsubscribe function.
 */
export function subscribeToProjects(onUpdate: (projects: Project[]) => void): UnsubFn {
  let unsub: UnsubFn = () => {};

  Promise.all([import("./firebase"), import("firebase/firestore")]).then(
    ([{ db }, { collection, onSnapshot, orderBy, query }]) => {
      const q = query(collection(db, "projects"), orderBy("updatedAt", "desc"));
      unsub = onSnapshot(
        q,
        (snap) => {
          const projects = snap.docs.map((d) => d.data() as Project);
          onUpdate(projects);
        },
        (err) => console.error("[projectsStorage] onSnapshot error:", err)
      );
    }
  );

  return () => unsub();
}

/** Write (create or update) a project. sourceThumb is stripped. */
export async function upsertProject(project: Project): Promise<void> {
  const [{ db }, { doc, setDoc }] = await Promise.all([
    import("./firebase"),
    import("firebase/firestore"),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { sourceThumb: _omit, ...rest } = project;
  await setDoc(doc(db, "projects", project.id), stripUndefined(rest));
}

/** Delete a project by id. */
export async function removeProject(id: string): Promise<void> {
  const [{ db }, { doc, deleteDoc }] = await Promise.all([
    import("./firebase"),
    import("firebase/firestore"),
  ]);
  await deleteDoc(doc(db, "projects", id));
}
