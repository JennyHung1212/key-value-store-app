import http from "http";
import express, { Express } from "express";
import morgan from "morgan";
import routes from "./routes";
import { StatusCode } from "status-code-enum";

const app: Express = express();

app.use(morgan("dev"));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

/** Enable strong validation */
app.enable("etag");
app.set("etag", "strong");

/** Corse policy and headers */
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "origin, X-Requested-With,Content-Type,Accept, Authorization"
  );

  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Methods", "GET PATCH DELETE POST");
    return res.status(StatusCode.SuccessOK).json({});
  }
  next();
});

/** Routes and error handling */
app.use("/", routes);
app.use((req, res) => {
  return res.status(StatusCode.ClientErrorNotFound).json({
    message: "End point not found.",
  });
});

/** Server */
const httpServer = http.createServer(app);
const PORT: any = process.env.PORT ?? 3000;
httpServer.listen(PORT, () =>
  console.log(`The server is running on port ${PORT}`)
);
