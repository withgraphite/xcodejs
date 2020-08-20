import PBXBuildFile from "./pbx_build_file";
import PBXBuildPhase from "./pbx_build_phase";
import PBXProj from "./pbx_project";
import { generateUUID } from "./utils";

// 615D539424D9DCCC000AB088 /* Embed Frameworks */ = {
//     isa = PBXCopyFilesBuildPhase;
//     buildActionMask = 2147483647;
//     dstPath = "";
//     dstSubfolderSpec = 10;
//     files = (
//         41EFD7A924E861C000CFD822 /* NextcloudOld.framework in Embed Frameworks */,
//     );
//     name = "Embed Frameworks";
//     runOnlyForDeploymentPostprocessing = 0;
// };

type PBXCopyFilesBuildPhaseData = {
  isa: string;
  buildActionMask: string;
  dstPath: string;
  dstSubfolderSpec: number;
  files: string[];
  name: string;
  runOnlyForDeploymentPostprocessing: number;
};

const DEFAULTS = {
  isa: "PBXCopyFilesBuildPhase",
  buildActionMask: "2147483647",
  dstPath: "",
  dstSubfolderSpec: 10,
  name: "Embed Frameworks",
  runOnlyForDeploymentPostprocessing: 0,
};

export default class PBXCopyFilesBuildPhase extends PBXBuildPhase {
  constructor(
    id: string,
    proj: PBXProj,
    data: PBXCopyFilesBuildPhaseData | null = null
  ) {
    super(generateUUID([]), proj, data);
  }

  static createForBuildFiles(
    buildFiles: PBXBuildFile[],
    proj: PBXProj
  ): PBXCopyFilesBuildPhase {
    return new PBXCopyFilesBuildPhase(generateUUID([]), proj, {
      ...DEFAULTS,
      files: buildFiles.map((file) => file._id),
    });
  }

  inputPaths(): string[] {
    return this._defn["inputPaths"];
  }

  setInputPaths(inputPaths: string[]) {
    this._defn["inputPaths"] = inputPaths;
  }

  shellScript(): string {
    return this._defn["shellScript"];
  }

  setShellScript(shellScript: string) {
    this._defn["shellScript"] = shellScript;
  }
}
