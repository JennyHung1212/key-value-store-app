import { Request, Response } from "express";
import { validatePlan } from "../schema";
import { ajvErrorParser } from "../utils";
import { StatusCode } from "status-code-enum";
import { createClient } from "redis";
import etag from "etag";

const redisClient = createClient();
(async () => {
  redisClient.on("error", (err) => console.log("Redis Client Error", err));
  await redisClient.connect();
})();

const createPlan = async ({ body, headers }: Request, res: Response) => {
  const isValid = await validatePlan(body);

  if (isValid) {
    const key: string = `plan:${body.objectId}`;
    return redisClient
      .set(key, JSON.stringify(body))
      .then(() => {
        return res.status(StatusCode.SuccessOK).json({
          message: "Create plan successfully.",
        });
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
  const id: string = params.id;
  const key: string = `plan:${id}`;
  const ETag: string | undefined = headers["if-none-match"];

  return redisClient
    .get(key)
    .then((data) => {
      if (!data)
        return res.status(StatusCode.ClientErrorNotFound).json({
          message: "Plan not found.",
        });
      else {
        if (ETag === etag(data))
          return res.status(StatusCode.RedirectNotModified).json({});
        return res.status(StatusCode.SuccessOK).json(JSON.parse(data));
      }
    })
    .catch((e) => {
      console.error(e);
      return res.status(StatusCode.ServerErrorInternal).json();
    });
};

const getPlans = async ({ body, headers }: Request, res: Response) => {
  return redisClient
    .keys("plan:*")
    .then((keys) => {
      return redisClient
        .mGet(keys)
        .then((data) => {
          if (!data)
            return res.status(StatusCode.ClientErrorNotFound).json({
              message: "Plan not found.",
            });
          else {
            return res
              .status(StatusCode.SuccessOK)
              .json({ plans: data.map((str) => JSON.parse(str || "")) });
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
  const id: string = params.id;
  const key: string = `plan:${id}`;
  return redisClient
    .exists(key)
    .then((result) => {
      if (!result)
        return res.status(StatusCode.ClientErrorNotFound).json({
          message: "Plan not found.",
        });
      else
        return redisClient
          .del(key)
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

const deletePlans = async ({ body, headers }: Request, res: Response) => {
  return redisClient
    .keys("plan:*")
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

export { createPlan, getPlan, getPlans, deletePlan, deletePlans };
