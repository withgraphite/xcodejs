import PBXFileReference from "./pbx_file_reference";
import PBXObject from "./pbx_object";
import PBXProj from "./pbx_project";
import { generateUUID } from "./utils";

// 41EFD79D24E82A3800CFD822 /* NextcloudOld.framework in Embed Frameworks */ = {
//   isa = a;
//   fileRef = 41EFD79B24E82A3800CFD822 /* NextcloudOld.framework */;
//   settings = {
//     ATTRIBUTES = (
//       CodeSignOnCopy,
//       RemoveHeadersOnCopy,
//     );
//   };
// };

type PBXBuildFileData = {
  isa: string;
  fileRef: string;
  settings: { ATTRIBUTES: string[] };
};

const DEFAULTS = {
  isa: "PBXBuildFile",
  settings: { ATTRIBUTES: ["CodeSignOnCopy", "RemoveHeadersOnCopy"] },
};

export default class PBXBuildFile extends PBXObject {
  constructor(id: string, proj: PBXProj, data: PBXBuildFileData) {
    super(generateUUID([]), proj, data);
  }

  static createFromFramework(
    fileRef: PBXFileReference,
    proj: PBXProj
  ): PBXBuildFile {
    return new PBXBuildFile(generateUUID([]), proj, {
      ...DEFAULTS,
      fileRef: fileRef._id,
    });
  }

  path(): string {
    return this._defn["path"];
  }

  setPath(path: string) {
    this._defn["path"] = path;
  }

  addChild(child: PBXObject) {
    this.addChildren([child]);
  }

  children(): PBXObject[] {
    return this._defn["children"].map((childId: string) => {
      return new PBXObject(childId, this._proj);
    });
  }

  addChildren(children: PBXObject[]) {
    this._defn["children"] = this._defn["children"].concat(
      children.map((child) => child._id)
    );
  }
}
