import PBXObject from "./pbx_object";

export default class PBXGroup extends PBXObject {
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
