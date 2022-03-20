import { Request, Response } from "express";
import { validatePlan } from "../schema";
import { ajvErrorParser } from "../utils";
import { StatusCode } from "status-code-enum";
import { createClient } from "redis";
import etag from "etag";
import dotenv from "dotenv";
import jwt, { Secret } from "jsonwebtoken";

dotenv.config();
const TOKEN_SECRET: Secret = process.env.TOKEN_SECRET || "token_secret";

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
      .exists(key)
      .then((result) => {
        if (result)
          return res.status(StatusCode.SuccessOK).json({
            message: "Plan already exists.",
          });
        else
          return redisClient
            .set(key, JSON.stringify(body))
            .then(() => {
              return res.status(StatusCode.SuccessOK).json({
                message: "Create plan successfully.",
                data: body,
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

const getToken = (req: Request, res: Response) => {
  const token = jwt.sign(
    { username: "info7255-user", timestamp: new Date().toISOString },
    TOKEN_SECRET,
    { expiresIn: "6000s" }
  );
  return res.status(StatusCode.SuccessOK).json({
    token,
  });
};
const validateToken = ({ headers }: Request, res: Response) => {
  const token = headers["authorization"]?.split("Bearer ")[1];

  if (!token)
    return res
      .status(StatusCode.ClientErrorUnauthorized)
      .json({ isValid: false });
  else {
    jwt.verify(token, TOKEN_SECRET, (err, decoded) => {
      if (err) {
        console.error(err);
        return res
          .status(StatusCode.ClientErrorUnauthorized)
          .json({ isValid: false });
      } else res.status(StatusCode.SuccessOK).json({ isValid: true });
    });
  }
};

export {
  createPlan,
  getPlan,
  getPlans,
  deletePlan,
  deletePlans,
  getToken,
  validateToken,
};
