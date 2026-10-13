import express, { ErrorRequestHandler } from "express";
import path from "path";
import askRouter from "./routes/ask";

export const app = express();
app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.resolve("public")));
app.use("/", askRouter);

const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) { next(error); return; }
  console.error(error);
  if (error?.type === "entity.parse.failed" || error instanceof SyntaxError) {
    res.status(400).json({ error: "Invalid request" });
  } else if (error?.type === "entity.too.large") {
    res.status(413).json({ error: "Invalid request" });
  } else if (typeof error?.status === "number" && error.status >= 400 && error.status < 500) {
    res.status(400).json({ error: "Invalid request" });
  } else {
    res.status(500).json({ error: "Internal server error" });
  }
};
app.use(errorHandler);

if (require.main === module) {
  const port = process.env.PORT || 3000;
  const server = app.listen(port);
  server.once("listening", () => {
    console.log(`Server is running on port ${port}`);
  });
  server.once("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Cannot start server: port ${port} is already in use. Stop the existing server or choose another PORT.`);
    } else {
      console.error("Cannot start server:", error);
    }
    process.exitCode = 1;
  });
}