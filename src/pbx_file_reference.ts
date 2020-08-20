import path from "path";
import PBXGroup from "./pbx_group";
import PBXObject from "./pbx_object";
import PBXProj from "./pbx_project";
import { generateUUID } from "./utils";

function findParents(id: string, group: PBXGroup): PBXGroup[] | null {
  for (const child of group.children()) {
    if (child._id === id) {
      return [group];
    } else if (child.isa() === "PBXGroup") {
      const foundPath = findParents(id, new PBXGroup(child._id, child._proj));
      if (foundPath !== null) {
        return [group].concat(foundPath);
      }
    }
  }

  return null;
}

// 41EFD79B24E82A3800CFD822 /* NextcloudOld.framework */ = {
//   isa = PBXFileReference;
//   lastKnownFileType = wrapper.framework;
//   name = NextcloudOld.framework;
//   path = "../../../../Users/gregfoster/monologue/test-data/frameworks/test-frameworks/NextcloudOld.framework";
//   sourceTree = "<group>";
// };

type PBXFileReferenceData = {
  isa: string;
  lastKnownFileType: string;
  name: string;
  path: string;
  sourceTree: string;
};

const DEFAULTS = {
  isa: "PBXFileReference",
  lastKnownFileType: "wrapper.framework",
  sourceTree: "<group>",
};

export default class PBXFileReference extends PBXObject {
  constructor(
    id: string,
    proj: PBXProj,
    data: PBXFileReferenceData | null = null
  ) {
    super(generateUUID([]), proj, data);
  }

  static createFromFrameworkPath(
    frameworkPath: string,
    proj: PBXProj
  ): PBXFileReference {
    return new PBXFileReference(generateUUID([]), proj, {
      ...DEFAULTS,
      name: path.basename(frameworkPath),
      path: frameworkPath,
    });
  }

  path(): string {
    return this._defn["path"];
  }

  fullPath(): string {
    const parents = findParents(this._id, this._proj.rootObject().mainGroup());

    if (parents === null) {
      throw "ERROR! Child (" + this._id + ") could not be found in tree!";
    }

    return path.join(
      this._proj._srcRoot,
      path.join(
        ...parents.map((ancestor) => {
          return ancestor.path() || "";
        })
      ),
      this.path()
    );
  }
}
