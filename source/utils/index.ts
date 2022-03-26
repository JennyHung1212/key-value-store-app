import { ErrorObject } from "ajv";
import jwt, { Secret } from "jsonwebtoken";
import { RedisClientType } from "redis";
import { Plan } from "../models/plan";

export const OBJECT_TYPES = {
  PLAN: "plan",
  MEMBER_COST_SHARE: "membercostshare",
  PLAN_SERVICE: "planservice",
  SERVICE: "service",
};

export const ajvErrorParser = async (
  validationErrors: ErrorObject[] | null | undefined
) => {
  const errors: Array<Object> = [];
  validationErrors?.forEach(({ params, keyword, message }) => {
    errors.push({
      param: params.missingProperty,
      key: keyword,
      message,
    });
  });

  return errors;
};

export const createJWTToken = (secret: Secret) => {
  return jwt.sign(
    {
      username: "info7255-user",
      uuid: "5a7f12d5-51d5-403f-be99-531a3e9fac1c",
      timestamp: new Date().toISOString,
    },
    secret,
    { expiresIn: "6000s" }
  );
};

export const validateJWTToken = (token: string, secret: Secret) => {
  token = token?.split("Bearer ")[1];
  return jwt.verify(token, secret, (err, decoded) => {
    if (err) {
      console.error(err);
      return false;
    } else return true;
  });
};

export const deconstructPlanObject = (body: Plan) => {
  const planKey = constructObjectKey(body.objectId, OBJECT_TYPES.PLAN);
  const plan: any = {
    ...body,
    planCostShares: {},
    linkedPlanServices: [],
  };
  const keyValuePairs = [];

  const { planCostShares, linkedPlanServices } = body;
  const planCostSharesKey = constructObjectKey(
    planCostShares.objectId,
    OBJECT_TYPES.MEMBER_COST_SHARE
  );
  plan.planCostShares = {
    objectId: planCostShares.objectId,
    objectType: planCostShares.objectType,
  };
  keyValuePairs.push({ key: planCostSharesKey, value: planCostShares });

  linkedPlanServices.forEach((o: any) => {
    const { linkedService, planserviceCostShares } = o;
    keyValuePairs.push({
      key: constructObjectKey(linkedService.objectId, OBJECT_TYPES.SERVICE),
      value: linkedService,
    });
    keyValuePairs.push({
      key: constructObjectKey(
        planserviceCostShares.objectId,
        OBJECT_TYPES.MEMBER_COST_SHARE
      ),
      value: planserviceCostShares,
    });
    keyValuePairs.push({
      key: constructObjectKey(o.objectId, OBJECT_TYPES.PLAN_SERVICE),
      value: {
        ...o,
        planserviceCostShares: {
          objectId: planserviceCostShares.objectId,
          objectType: planserviceCostShares.objectType,
        },
        linkedService: {
          objectId: linkedService.objectId,
          objectType: linkedService.objectType,
        },
      },
    });

    plan.linkedPlanServices.push({
      objectId: o.objectId,
      objectType: o.objectType,
    });
  });

  keyValuePairs.push({ key: planKey, value: plan });
  return keyValuePairs;
};

export const constructPlanObject = async (plan: any, redisClient: any) => {
  const fullPlan = { ...plan };
  const { planCostShares, linkedPlanServices } = fullPlan;
  fullPlan.planCostShares = await redisClient.json.get(
    constructObjectKey(planCostShares.objectId, planCostShares.objectType)
  );
  for (let i = 0; i < linkedPlanServices.length; i++) {
    const { objectId, objectType } = linkedPlanServices[i];
    linkedPlanServices[i] = await redisClient.json.get(
      constructObjectKey(objectId, objectType)
    );
    const { linkedService, planserviceCostShares } = linkedPlanServices[i];
    linkedPlanServices[i].linkedService = await redisClient.json.get(
      constructObjectKey(linkedService.objectId, linkedService.objectType)
    );
    linkedPlanServices[i].planserviceCostShares = await redisClient.json.get(
      constructObjectKey(
        planserviceCostShares.objectId,
        planserviceCostShares.objectType
      )
    );
  }
  return fullPlan;
};

export const constructObjectKey = (objectId: String, objectType: String) => {
  return `${objectType}:${objectId}`;
};
