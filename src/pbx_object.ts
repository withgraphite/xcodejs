import PBXProj from "./pbx_project";

export default class PBXObject {
  _defn: any;
  _id: string;
  _proj: PBXProj;

  constructor(
    id: string,
    proj: PBXProj,
    data: Record<string, any> | null = null
  ) {
    this._id = id;
    this._proj = proj;
    if (data != null) {
      proj._defn["objects"][id] = data;
    }
    this._defn = proj._defn["objects"][id];
  }

  get(id: string) {
    return this._defn[id];
  }

  set(key: string, value: any) {
    this._defn[key] = value;
  }

  remove() {
    this._proj.removeNode(this._id);
  }

  updateProj(proj: PBXProj) {
    this._proj = proj;
    this._defn = proj._defn["objects"][this._id];

    return this;
  }

  // convenience

  isa() {
    return this.get("isa");
  }
}
