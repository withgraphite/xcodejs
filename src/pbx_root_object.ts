import PBXBuildConfigList from "./pbx_build_config_list";
import PBXGroup from "./pbx_group";
import PBXNativeTarget from "./pbx_native_target";
import PBXObject from "./pbx_object";

export default class PBXRootObject extends PBXObject {
  targets(): ReadonlyArray<PBXNativeTarget> {
    return this._defn["targets"].map((targetId: string) => {
      return new PBXNativeTarget(targetId, this._proj);
    });
  }

  applicationTargets(): ReadonlyArray<PBXNativeTarget> {
    return this.targets().filter((target: PBXNativeTarget) => {
      return target.productType() === "com.apple.product-type.application";
    });
  }

  removeTarget(target: PBXNativeTarget) {
    this._defn["targets"] = this._defn["targets"].filter(
      (targetId: string) => targetId !== target._id
    );
  }

  setTargets(newTargets: PBXNativeTarget[]) {
    this._defn["targets"] = newTargets.map((target) => target._id);
  }

  addTargets(targets: ReadonlyArray<PBXNativeTarget>) {
    this._defn["targets"] = this._defn["targets"].concat(
      targets.map((target) => target._id)
    );
  }

  buildConfigurationList() {
    return new PBXBuildConfigList(
      this._defn["buildConfigurationList"],
      this._proj
    );
  }

  mainGroup() {
    return new PBXGroup(this._defn["mainGroup"], this._proj);
  }
}
