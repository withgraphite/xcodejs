import PBXBuildConfigList from "./pbx_build_config_list";
import PBXBuildPhase from "./pbx_build_phase";
import PBXObject from "./pbx_object";
import PBXTargetDependency from "./pbx_target_dependency";

export default class PBXNativeTarget extends PBXObject {
  toString(): string {
    return this.get("name");
  }
  productType(): string {
    return this._defn["productType"];
  }

  setProductType(productType: string) {
    this._defn["productType"] = productType;
  }

  addBuildPhase(buildPhase: PBXBuildPhase) {
    this._defn["buildPhases"].push(buildPhase._id);
  }

  product(): PBXObject {
    return new PBXObject(this._defn["productReference"], this._proj);
  }

  name(): string {
    return this._defn["name"];
  }

  dependencies(): ReadonlyArray<PBXTargetDependency> {
    return this._defn["dependencies"].map((dependencyId: string) => {
      return new PBXTargetDependency(dependencyId, this._proj);
    });
  }

  buildConfigurationList() {
    return new PBXBuildConfigList(
      this._defn["buildConfigurationList"],
      this._proj
    );
  }

  defaultConfigurationName(): string {
    return this._defn["defaultConfigurationName"];
  }

  buildPhases(): ReadonlyArray<PBXBuildPhase> {
    return this._defn["buildPhases"].map((buildPhaseId: string) => {
      return new PBXBuildPhase(buildPhaseId, this._proj);
    });
  }
}
