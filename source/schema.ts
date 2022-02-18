import Ajv, { JSONSchemaType, ValidateFunction } from "ajv";
import { Plan } from "./models/plan";

const planCostSharesSchema: JSONSchemaType<Plan["planCostShares"]> = {
  type: "object",
  properties: {
    deductible: { type: "integer", nullable: false },
    copay: { type: "integer", nullable: false },
    _org: { type: "string", nullable: false },
    objectId: { type: "string", nullable: false },
    objectType: { type: "string", nullable: false },
  },
  required: ["deductible", "copay", "_org", "objectId", "objectType"],
  additionalProperties: true,
} as const;

const linkedPlanServicesSchema: JSONSchemaType<Plan["linkedPlanServices"]> = {
  type: "array",
  items: {
    type: "object",
    properties: {
      linkedService: {
        type: "object",
        properties: {
          _org: { type: "string", nullable: false },
          objectId: { type: "string", nullable: false },
          objectType: { type: "string", nullable: false },
          name: { type: "string", nullable: false },
        },
        required: ["_org", "objectId", "objectType", "name"],
        additionalProperties: true,
      },
      planserviceCostShares: planCostSharesSchema,
      _org: { type: "string", nullable: false },
      objectId: { type: "string", nullable: false },
      objectType: { type: "string", nullable: false },
    },
    required: [
      "linkedService",
      "planserviceCostShares",
      "_org",
      "objectId",
      "objectType",
    ],
    additionalProperties: true,
  },
  uniqueItems: true,
  nullable: false,
} as const;

const planSchema: JSONSchemaType<Plan> = {
  type: "object",
  properties: {
    planCostShares: planCostSharesSchema,
    linkedPlanServices: linkedPlanServicesSchema,
    planType: { type: "string", nullable: false },
    creationDate: { type: "string", nullable: false },
    _org: { type: "string", nullable: false },
    objectId: { type: "string", nullable: false },
    objectType: { type: "string", nullable: false },
  },
  required: [
    "planCostShares",
    "linkedPlanServices",
    "planType",
    "creationDate",
    "_org",
    "objectId",
    "objectType",
  ],
  additionalProperties: true,
  nullable: false,
} as const;

const ajv: Ajv = new Ajv({ allErrors: true });
export const validatePlan: ValidateFunction<Plan> = ajv.compile(planSchema);
