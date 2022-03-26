import { Request, Response } from "express";
import { validatePlan } from "../schema";
import {
  ajvErrorParser,
  createJWTToken,
  validateJWTToken,
  deconstructPlanObject,
  constructObjectKey,
  OBJECT_TYPES,
  constructPlanObject,
} from "../utils";
import { StatusCode } from "status-code-enum";
import { createClient } from "redis";
import etag from "etag";
import dotenv from "dotenv";
import jwt, { Secret } from "jsonwebtoken";
import { Plan } from "../models/plan";
import { AnySchema } from "ajv";

dotenv.config();
const TOKEN_SECRET: Secret = process.env.TOKEN_SECRET || "token_secret";

const redisClient = createClient();
(async () => {
  redisClient.on("error", (err) => console.log("Redis Client Error", err));
  await redisClient.connect();
})();

const createPlan = async ({ body, headers }: Request, res: Response) => {
  const token = headers["authorization"];
  const isTokenValid = !token ? false : validateJWTToken(token, TOKEN_SECRET);
  if (!isTokenValid)
    return res.status(StatusCode.ClientErrorUnauthorized).json();

  const isValid = await validatePlan(body);
  if (isValid) {
    const planKey: string = constructObjectKey(
      body.objectId,
      OBJECT_TYPES.PLAN
    );
    return redisClient
      .exists(planKey)
      .then((result) => {
        if (result)
          return res.status(StatusCode.SuccessOK).json({
            message: "Plan already exists.",
          });
        else {
          const keyValuePairs = deconstructPlanObject(body);
          Promise.all(
            keyValuePairs.map(({ key, value }) =>
              redisClient.json.set(key, "$", value)
            )
          )
            .then(() => {
              return res.status(StatusCode.SuccessOK).json({
                message: "Create plan successfully.",
                data: { id: body.objectId },
              });
            })
            .catch((e) => {
              throw e;
            });
        }
      })
      .catch((e) => {
        console.error(e);
        return res.status(StatusCode.ServerErrorInternal).json();
      });
  } else {
    const errors = await ajvErrorParser(validatePlan.errors);
    return res.status(StatusCode.ClientErrorBadRequest).json({
      message: "Some properties are invalid or missing.",
      errors,
    });
  }
};

const getPlan = async ({ body, headers, params }: Request, res: Response) => {
  const token = headers["authorization"];
  const isTokenValid = !token ? false : validateJWTToken(token, TOKEN_SECRET);
  if (!isTokenValid)
    return res.status(StatusCode.ClientErrorUnauthorized).json();

  const id: string = params.id;
  const key: string = constructObjectKey(id, OBJECT_TYPES.PLAN);
  const ETag: string | undefined = headers["if-none-match"];

  return redisClient.json
    .get(key)
    .then(async (data) => {
      if (!data)
        return res.status(StatusCode.ClientErrorNotFound).json({
          message: "Plan not found.",
        });
      else {
        const plan: any = await constructPlanObject(data, redisClient);

        if (ETag === etag(JSON.stringify(plan)))
          return res.status(StatusCode.RedirectNotModified).json();
        return res.status(StatusCode.SuccessOK).json(plan);
      }
    })
    .catch((e) => {
      console.error(e);
      return res.status(StatusCode.ServerErrorInternal).json();
    });
};

const getPlans = async ({ body, headers }: Request, res: Response) => {
  const token = headers["authorization"];
  const isTokenValid = !token ? false : validateJWTToken(token, TOKEN_SECRET);
  if (!isTokenValid)
    return res.status(StatusCode.ClientErrorUnauthorized).json();

  const ETag: string | undefined = headers["if-none-match"];

  return redisClient
    .keys("plan:*")
    .then((keys) => {
      return redisClient.json
        .mGet(keys, "$")
        .then(async (data) => {
          if (!data)
            return res.status(StatusCode.ClientErrorNotFound).json({
              message: "Plan not found.",
            });
          else {
            data = data.flat();
            const plans = [];
            for (let i = 0; i < data.length; i++) {
              const plan: any = await constructPlanObject(data[i], redisClient);

              plans.push(plan);
            }
            if (ETag === etag(JSON.stringify(plans)))
              return res.status(StatusCode.RedirectNotModified).json();
            return res.status(StatusCode.SuccessOK).json(plans);
          }
        })
        .catch((e) => {
          throw e;
        });
    })
    .catch((e) => {
      console.error(e);
      return res.status(StatusCode.ServerErrorInternal).json();
    });
};

const deletePlan = async (
  { body, headers, params }: Request,
  res: Response
) => {
  const token = headers["authorization"];
  const isTokenValid = !token ? false : validateJWTToken(token, TOKEN_SECRET);
  if (!isTokenValid)
    return res.status(StatusCode.ClientErrorUnauthorized).json();

  const id: string = params.id;
  const key: string = constructObjectKey(id, OBJECT_TYPES.PLAN);
  const ETag: string | undefined = headers["if-match"];

  return redisClient
    .exists(key)
    .then(async (result) => {
      if (!result)
        return res.status(StatusCode.ClientErrorNotFound).json({
          message: "Plan not found.",
        });
      else {
        const plan: any = await redisClient.json.get(key);
        const fullPlan: any = await constructPlanObject(
          { ...plan, linkedPlanServices: [...plan.linkedPlanServices] },
          redisClient
        );

        if (ETag !== etag(JSON.stringify(fullPlan)))
          return res.status(StatusCode.ClientErrorPreconditionFailed).json();

        return redisClient.json
          .del(key)
          .then(() => {
            return res.status(StatusCode.SuccessNoContent).json({
              message: "Delete plan successfully.",
            });
          })
          .catch((e) => {
            throw e;
          });
      }
    })
    .catch((e) => {
      console.error(e);
      return res.status(StatusCode.ServerErrorInternal).json();
    });
};

const deletePlans = async ({ body, headers }: Request, res: Response) => {
  const token = headers["authorization"];
  const isTokenValid = !token ? false : validateJWTToken(token, TOKEN_SECRET);
  if (!isTokenValid)
    return res.status(StatusCode.ClientErrorUnauthorized).json();

  return redisClient
    .keys("*")
    .then((keys) => {
      if (!keys.length)
        return res.status(StatusCode.ClientErrorNotFound).json({
          message: "No plan.",
        });
      else
        return redisClient
          .del(keys)
          .then(() => {
            return res.status(StatusCode.SuccessNoContent).json({
              message: "Delete plan successfully.",
            });
          })
          .catch((e) => {
            throw e;
          });
    })
    .catch((e) => {
      console.error(e);
      return res.status(StatusCode.ServerErrorInternal).json();
    });
};

const updatePlan = async (
  { body, headers, params }: Request,
  res: Response
) => {
  const token = headers["authorization"];
  const isTokenValid = !token ? false : validateJWTToken(token, TOKEN_SECRET);
  if (!isTokenValid)
    return res.status(StatusCode.ClientErrorUnauthorized).json();

  const id: string = params.id;
  const key: string = constructObjectKey(id, OBJECT_TYPES.PLAN);
  const ETag: string | undefined = headers["if-none-match"];

  await redisClient
    .exists(key)
    .then((result) => {
      if (!result)
        return res.status(StatusCode.ClientErrorNotFound).json({
          message: "Plan not found.",
        });
    })
    .catch((e) => {
      console.error(e);
      return res.status(StatusCode.ServerErrorInternal).json();
    });

  const { planCostShares, linkedPlanServices, _org, planType } = body;
  if (!planCostShares && !linkedPlanServices && !_org && !planType)
    return res.status(StatusCode.ClientErrorBadRequest).json();

  try {
    const plan: any = await redisClient.json.get(key);
    const fullPlan: any = await constructPlanObject(
      { ...plan, linkedPlanServices: [...plan.linkedPlanServices] },
      redisClient
    );

    if (ETag === etag(JSON.stringify(fullPlan)))
      return res.status(StatusCode.ClientErrorPreconditionFailed).json();

    if (_org) plan._org = _org;
    if (planType) plan.planType = planType;

    if (planCostShares) {
      const { deductible, _org, copay, objectId } = planCostShares;
      if (!objectId) return res.status(StatusCode.ClientErrorBadRequest).json();
      if (plan.planCostShares.objectId !== objectId) {
        plan.planCostShares.objectId = objectId;
        await redisClient.json.set(
          constructObjectKey(objectId, OBJECT_TYPES.MEMBER_COST_SHARE),
          "$",
          planCostShares
        );
      } else {
        await redisClient.json
          .get(constructObjectKey(objectId, OBJECT_TYPES.MEMBER_COST_SHARE))
          .then((data: any) => {
            if (deductible) data.deductible = deductible;
            if (_org) data._org = _org;
            if (copay) data.copay = copay;

            return redisClient.json.set(
              constructObjectKey(objectId, OBJECT_TYPES.MEMBER_COST_SHARE),
              "$",
              data
            );
          })
          .catch((e) => {
            console.error(e);
            return res.status(StatusCode.ServerErrorInternal).json();
          });
      }
    }
    if (linkedPlanServices) {
      for (const linkedPlanService of linkedPlanServices) {
        await redisClient.json.set(
          constructObjectKey(
            linkedPlanService.objectId,
            OBJECT_TYPES.PLAN_SERVICE
          ),
          "$",
          {
            ...linkedPlanService,
            linkedService: {
              objectId: linkedPlanService.linkedService.objectId,
              objectType: OBJECT_TYPES.SERVICE,
            },
            planserviceCostShares: {
              objectId: linkedPlanService.planserviceCostShares.objectId,
              objectType: OBJECT_TYPES.MEMBER_COST_SHARE,
            },
          }
        );
        await redisClient.json.set(
          constructObjectKey(
            linkedPlanService.linkedService.objectId,
            OBJECT_TYPES.SERVICE
          ),
          "$",
          linkedPlanService.linkedService
        );
        await redisClient.json.set(
          constructObjectKey(
            linkedPlanService.planserviceCostShares.objectId,
            OBJECT_TYPES.MEMBER_COST_SHARE
          ),
          "$",
          linkedPlanService.planserviceCostShares
        );
        if (
          !plan.linkedPlanServices.find(
            (o: any) => o.objectId === linkedPlanService.objectId
          )
        )
          plan.linkedPlanServices.push({
            objectId: linkedPlanService.objectId,
            objectType: OBJECT_TYPES.PLAN_SERVICE,
          });
      }
    }

    await redisClient.json.set(key, "$", plan);
    return res
      .status(StatusCode.SuccessOK)
      .json({ message: "Update plan successfully" });
  } catch (e) {
    console.error(e);
    return res.status(StatusCode.ServerErrorInternal).json();
  }
};

const getToken = (req: Request, res: Response) => {
  const token = createJWTToken(TOKEN_SECRET);
  return res.status(StatusCode.SuccessOK).json({
    token,
  });
};

const validateToken = ({ headers }: Request, res: Response) => {
  const token = headers["authorization"];

  const isValid = !token ? false : validateJWTToken(token, TOKEN_SECRET);

  if (isValid) return res.status(StatusCode.SuccessOK).json({ isValid });
  else return res.status(StatusCode.ClientErrorUnauthorized).json({ isValid });
};

export {
  createPlan,
  getPlan,
  getPlans,
  deletePlan,
  deletePlans,
  updatePlan,
  getToken,
  validateToken,
};
