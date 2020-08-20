import PBXObject from "./pbx_object";

export default class PBXTargetProxy extends PBXObject {
  setContainerPortal(containerPortal: PBXObject) {
    this._defn["containerPortal"] = containerPortal._id;
  }
}
