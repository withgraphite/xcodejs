import PBXObject from "./pbx_object";
import PBXTargetProxy from "./pbx_target_proxy";

export default class PBXTargetDependency extends PBXObject {
  targetProxy() {
    return new PBXTargetProxy(this._defn["targetProxy"], this._proj);
  }
}
