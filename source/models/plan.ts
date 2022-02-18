import { MemberCostShare } from "./memberCostShare";
import { PlanService } from "./planService";

export interface Plan {
  planCostShares: MemberCostShare;
  linkedPlanServices: Array<PlanService>;
  _org: string;
  objectId: string;
  objectType: string;
  planType: string;
  creationDate: string;
}
