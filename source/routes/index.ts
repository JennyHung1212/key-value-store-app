import express from "express";
import {
  createPlan,
  getPlan,
  getPlans,
  deletePlan,
  deletePlans,
  updatePlan,
  getToken,
  validateToken,
} from "../controller";
const router = express.Router();

router.post("/v1/plan", createPlan);
router.get("/v1/plan", getPlans);
router.get("/v1/plan/:id", getPlan);
router.delete("/v1/plan", deletePlans);
router.delete("/v1/plan/:id", deletePlan);
router.patch("/v1/plan/:id", updatePlan);
router.get("/v1/token", getToken);
router.post("/v1/validate", validateToken);

export = router;
