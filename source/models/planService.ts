import { Service } from "./service";
import { MemberCostShare } from "./memberCostShare";

export interface PlanService {
  linkedService: Service;
  planserviceCostShares: MemberCostShare;
  _org: string;
  objectId: string;
  objectType: string;
}
